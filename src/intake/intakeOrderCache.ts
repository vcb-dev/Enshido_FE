import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type {
  IntakeOrder,
  IntakeOrderList,
  IntakeOrderStatus,
  IntakePipelineLists,
} from '../api/intakeOrders'
import type { ProductionOrderListResponse } from '../api/productionOrders'
import {
  patchIntakePipelineCounts,
  scheduleIntakePipelineCountsRefresh,
} from './intakePipelineCountsRefresh'
import { notifyWorkflowChanged } from '../workflow/workflowBroadcast'
import { intakeHasEnteredProduction } from './intakeActions'

const PIPELINE_LIST_STATUSES: IntakeOrderStatus[] = [
  'PENDING_APPROVAL',
  'APPROVED',
  'READY_FOR_PRODUCTION',
  'PENDING_WAREHOUSE_CONFIRMATION',
  'WAX_PRINTED',
  'WAX_CONFIRMED',
  'WAIT_CASTING',
  'CASTING',
  'CAST_PENDING_CONFIRMATION',
  'CAST_DONE',
  'WAIT_COOLING',
]

function emptyList(pageSize = 200): IntakeOrderList {
  return { items: [], total: 0, page: 1, pageSize }
}

/** Danh sách gộp Lệnh sản xuất dùng pipeline-lists — phải patch riêng, không chỉ status-list. */
function patchPipelineLists(queryClient: QueryClient, order: IntakeOrder) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['intake-orders', 'pipeline-lists'] })) {
    const old = query.state.data as IntakePipelineLists | undefined
    if (!old) continue
    const rootsOnly = query.queryKey.some((part) => typeof part === 'object' && part !== null && 'rootsOnly' in part && part.rootsOnly === true)
    queryClient.setQueryData(query.queryKey, rootsOnly && order.reworkOfOrderId
      ? removeOrderFromPipelineLists(old, order.id)
      : moveOrderInPipelineLists(old, order))
  }
}

function removeOrderFromPipelineLists(lists: IntakePipelineLists, orderId: string): IntakePipelineLists {
  const next: IntakePipelineLists = { ...lists }
  for (const status of PIPELINE_LIST_STATUSES) {
    const bucket = next[status]
    if (!bucket?.items.some((item) => item.id === orderId)) continue
    const items = bucket.items.filter((item) => item.id !== orderId)
    next[status] = { ...bucket, items, total: Math.max(0, bucket.total - 1) }
  }
  return next
}

function moveOrderInPipelineLists(lists: IntakePipelineLists, order: IntakeOrder): IntakePipelineLists {
  const without = removeOrderFromPipelineLists(lists, order.id)
  if (intakeHasEnteredProduction(order) || !PIPELINE_LIST_STATUSES.includes(order.status)) return without
  const bucket = without[order.status] ?? emptyList()
  const had = bucket.items.some((item) => item.id === order.id)
  const items = had
    ? bucket.items.map((item) => (item.id === order.id ? order : item))
    : [...bucket.items, order]
  return {
    ...without,
    [order.status]: {
      ...bucket,
      items,
      total: had ? bucket.total : bucket.total + 1,
    },
  }
}

function isIntakeOrderList(data: unknown): data is IntakeOrderList {
  return (
    typeof data === 'object' &&
    data !== null &&
    'items' in data &&
    Array.isArray((data as IntakeOrderList).items)
  )
}

const LIST_SLOT_STATUS: Partial<Record<string, IntakeOrderStatus>> = {
  'pending-list': 'PENDING_APPROVAL',
  'pending-for-all': 'PENDING_APPROVAL',
  'approved-for-all': 'APPROVED',
  'ready-for-all': 'READY_FOR_PRODUCTION',
  'warehouse-pending-for-all': 'PENDING_WAREHOUSE_CONFIRMATION',
  'wax-for-all': 'WAX_PRINTED',
  'wax-confirmed-for-all': 'WAX_CONFIRMED',
  'wait-casting-for-all': 'WAIT_CASTING',
  'casting-for-all': 'CASTING',
  'cast-pending-for-all': 'CAST_PENDING_CONFIRMATION',
  'cast-done-for-all': 'CAST_DONE',
  'wait-cooling-for-all': 'WAIT_COOLING',
}

function listKeyMatchesStatus(queryKey: QueryKey, status: IntakeOrderStatus) {
  const slot = String(queryKey[1] ?? '')
  if (slot.endsWith('-count')) return false
  return LIST_SLOT_STATUS[slot] === status
}

/** Màn Tạo đơn: `['intake-orders', page, pageSize, status, search]`. */
function isCatalogListKey(queryKey: QueryKey) {
  const slot = queryKey[1]
  if (typeof slot === 'number') return true
  return typeof slot === 'string' && /^\d+$/.test(slot)
}

function isStatusListKey(queryKey: QueryKey) {
  return queryKey[1] === 'status-list'
}

function statusListAllows(queryKey: QueryKey, order: IntakeOrder) {
  if (intakeHasEnteredProduction(order)) return false
  const statusFilter = String(queryKey[2] ?? '')
  if (statusFilter && statusFilter !== order.status) return false
  const search = String(queryKey[5] ?? '').trim().toLowerCase()
  if (search) {
    const hay = [order.code, order.sxCode, order.productName, order.description, order.trackingCode]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!hay.includes(search)) return false
  }
  const requestType = String(queryKey[6] ?? '')
  if (requestType && requestType !== order.requestType) return false
  return true
}

function catalogListAllows(queryKey: QueryKey, order: IntakeOrder) {
  const statusFilter = String(queryKey[3] ?? '')
  if (statusFilter && statusFilter !== order.status) return false
  const search = String(queryKey[4] ?? '').trim().toLowerCase()
  if (!search) return true
  const hay = [order.code, order.sxCode, order.productName, order.description, order.trackingCode]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(search)
}

function reconcileOrderInList(
  old: IntakeOrderList,
  queryKey: QueryKey,
  order: IntakeOrder,
): IntakeOrderList | undefined {
  const inList = old.items.some((item) => item.id === order.id)
  const shouldBeHere = isCatalogListKey(queryKey)
    ? catalogListAllows(queryKey, order)
    : isStatusListKey(queryKey)
      ? statusListAllows(queryKey, order)
      : listKeyMatchesStatus(queryKey, order.status)
  if (inList && !shouldBeHere) {
    return {
      ...old,
      items: old.items.filter((item) => item.id !== order.id),
      total: Math.max(0, old.total - 1),
    }
  }
  if (!shouldBeHere) return undefined
  if (inList) {
    return { ...old, items: old.items.map((item) => (item.id === order.id ? order : item)) }
  }
  // Đơn mới lên đầu trang 1 — trang sau để refetch, tránh nhảy sai trang.
  if (isCatalogListKey(queryKey) && Number(queryKey[1]) !== 1) return undefined
  if (isStatusListKey(queryKey) && Number(queryKey[3]) !== 1) return undefined
  return { ...old, items: [order, ...old.items], total: old.total + 1 }
}

function patchIntakeQueries(
  queryClient: QueryClient,
  patch: (old: IntakeOrderList, queryKey: QueryKey) => IntakeOrderList | undefined,
) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['intake-orders'] })) {
    if (query.queryKey[1] === 'pipeline-lists' || query.queryKey[1] === 'pipeline-counts') continue
    const old = query.state.data
    if (!isIntakeOrderList(old)) continue
    const next = patch(old, query.queryKey)
    if (next && next !== old) {
      queryClient.setQueryData(query.queryKey, next)
    }
  }
}

function findNestedRework(queryClient: QueryClient, matches: (order: IntakeOrder) => boolean): IntakeOrder | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['production-orders'] })) {
    const data = query.state.data as ProductionOrderListResponse | undefined
    if (!Array.isArray(data?.items)) continue
    for (const row of data.items) {
      const hit = row.reworks?.find((child) => matches(child.intake))
      if (hit) return hit.intake
    }
  }
  return undefined
}

/** Tìm đơn intake đang có trong cache (pipeline hoặc list). */
export function findIntakeOrderByCodeInCaches(
  queryClient: QueryClient,
  code: string,
): IntakeOrder | undefined {
  const nested = findNestedRework(queryClient, (order) => order.code === code)
  if (nested) return nested
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['intake-orders'] })) {
    if (query.queryKey[1] === 'pipeline-lists') {
      const lists = query.state.data as IntakePipelineLists | undefined
      if (!lists) continue
      for (const status of PIPELINE_LIST_STATUSES) {
        const hit = lists[status]?.items.find((item) => item.code === code)
        if (hit) return hit
      }
      continue
    }
    const old = query.state.data
    if (!isIntakeOrderList(old)) continue
    const hit = old.items.find((item) => item.code === code)
    if (hit) return hit
  }
  return undefined
}

export function findIntakeOrderInCaches(
  queryClient: QueryClient,
  orderId: string,
): IntakeOrder | undefined {
  const nested = findNestedRework(queryClient, (order) => order.id === orderId)
  if (nested) return nested
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['intake-orders'] })) {
    if (query.queryKey[1] === 'pipeline-lists') {
      const lists = query.state.data as IntakePipelineLists | undefined
      if (!lists) continue
      for (const status of PIPELINE_LIST_STATUSES) {
        const hit = lists[status]?.items.find((item) => item.id === orderId)
        if (hit) return hit
      }
      continue
    }
    const old = query.state.data
    if (!isIntakeOrderList(old)) continue
    const hit = old.items.find((item) => item.id === orderId)
    if (hit) return hit
  }
  return undefined
}

/** Cập nhật trạng thái đơn trên mọi cache intake — cột Hành động / chip đổi ngay. */
export function moveIntakeOrderInCaches(
  queryClient: QueryClient,
  order: IntakeOrder,
  opts?: { silent?: boolean },
) {
  const prev = findIntakeOrderInCaches(queryClient, order.id)
  patchPipelineLists(queryClient, order)
  if (order.reworkOfOrderId) {
    void queryClient.invalidateQueries({ queryKey: ['production-orders'], refetchType: 'active' })
  }
  patchIntakeQueries(queryClient, (old, queryKey) => reconcileOrderInList(old, queryKey, order))
  patchIntakePipelineCounts(
    queryClient,
    prev && intakeHasEnteredProduction(prev) ? undefined : prev?.status,
    intakeHasEnteredProduction(order) ? undefined : order.status,
  )
  scheduleIntakePipelineCountsRefresh(queryClient)
  if (!opts?.silent) notifyWorkflowChanged('intake')
}

function intakeLiveFieldsChanged(prev: IntakeOrder, next: IntakeOrder) {
  return (
    prev.status !== next.status ||
    prev.productionOrderCode !== next.productionOrderCode ||
    prev.hasMold !== next.hasMold ||
    prev.model3dUrl !== next.model3dUrl ||
    prev.productWeightGram !== next.productWeightGram ||
    prev.castingTreeWeightGram !== next.castingTreeWeightGram ||
    prev.waxCheckedWeightGram !== next.waxCheckedWeightGram ||
    prev.castingSlip?.code !== next.castingSlip?.code ||
    prev.castingSlip?.status !== next.castingSlip?.status
  )
}

/** Snapshot live lần trước — chỉ gỡ đơn đã từng thấy rồi biến mất, tránh xóa đơn vừa tạo. */
let lastIntakeLiveIds: Set<string> | null = null

/** Vá pipeline từ snapshot live — giữ ảnh cũ, đổi chip/nút ngay khi người khác thao tác. */
export function applyIntakeLiveSnapshot(queryClient: QueryClient, liveItems: IntakeOrder[]) {
  const liveById = new Map(liveItems.map((item) => [item.id, item]))
  if (lastIntakeLiveIds) {
    for (const id of lastIntakeLiveIds) {
      if (liveById.has(id)) continue
      const prev = findIntakeOrderInCaches(queryClient, id)
      if (!prev || !PIPELINE_LIST_STATUSES.includes(prev.status)) continue
      removeIntakeOrderFromCaches(queryClient, id)
    }
  }
  lastIntakeLiveIds = new Set(liveById.keys())

  let refreshCatalog = false
  for (const live of liveItems) {
    const prev = findIntakeOrderInCaches(queryClient, live.id)
    if (
      intakeHasEnteredProduction(live) &&
      !live.productionOrderCode &&
      prev && !intakeHasEnteredProduction(prev)
    ) refreshCatalog = true
    if (prev && !intakeLiveFieldsChanged(prev, live)) continue
    moveIntakeOrderInCaches(queryClient, prev ? { ...prev, ...live, images: prev.images } : live, {
      silent: true,
    })
  }
  // Snapshot không có mã A…: lấy lại bản đầy đủ để nút chi tiết mở đúng phiếu.
  if (refreshCatalog) {
    void queryClient.invalidateQueries({
      queryKey: ['intake-orders'],
      predicate: (query) => isCatalogListKey(query.queryKey),
      refetchType: 'active',
    })
  }
}

export function refreshIntakeTabCounts(queryClient: QueryClient) {
  scheduleIntakePipelineCountsRefresh(queryClient)
}

/** Gộp bucket cache thành một danh sách — sort cố định để đổi trạng thái không nhảy dòng. */
export function mergeIntakeQueueItems(
  pendingItems: IntakeOrder[],
  approvedItems: IntakeOrder[],
  readyItems: IntakeOrder[],
  warehousePendingItems: IntakeOrder[] = [],
  waxItems: IntakeOrder[] = [],
  waxConfirmedItems: IntakeOrder[] = [],
  waitCastingItems: IntakeOrder[] = [],
  castingItems: IntakeOrder[] = [],
  castPendingConfirmItems: IntakeOrder[] = [],
  castDoneItems: IntakeOrder[] = [],
  waitCoolingItems: IntakeOrder[] = [],
): IntakeOrder[] {
  const byId = new Map<string, IntakeOrder>()
  for (const item of pendingItems) byId.set(item.id, item)
  for (const item of approvedItems) byId.set(item.id, item)
  for (const item of readyItems) byId.set(item.id, item)
  for (const item of warehousePendingItems) byId.set(item.id, item)
  for (const item of waxItems) byId.set(item.id, item)
  for (const item of waxConfirmedItems) byId.set(item.id, item)
  for (const item of waitCastingItems) byId.set(item.id, item)
  for (const item of castingItems) byId.set(item.id, item)
  for (const item of castPendingConfirmItems) byId.set(item.id, item)
  for (const item of castDoneItems) byId.set(item.id, item)
  for (const item of waitCoolingItems) byId.set(item.id, item)
  return [...byId.values()].sort((a, b) => {
    const tb = Date.parse(b.createdAt) || 0
    const ta = Date.parse(a.createdAt) || 0
    if (tb !== ta) return tb - ta
    return b.code.localeCompare(a.code)
  })
}

/** Đánh dấu stale nhẹ — ưu tiên patch tức thì qua moveIntakeOrderInCaches. */
export function markIntakeOrdersStale(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['intake-orders'], refetchType: 'none' })
  refreshIntakeTabCounts(queryClient)
}

export function afterIntakeApproved(queryClient: QueryClient, order: IntakeOrder) {
  moveIntakeOrderInCaches(queryClient, order)
}

export function afterIntakeRejected(queryClient: QueryClient, order: IntakeOrder) {
  removeIntakeOrderFromCaches(queryClient, order.id)
  notifyWorkflowChanged('intake')
}

export function afterIntakeModel3dAttached(queryClient: QueryClient, order: IntakeOrder) {
  moveIntakeOrderInCaches(queryClient, order)
}

export function afterIntakeProductSpecsSubmitted(queryClient: QueryClient, order: IntakeOrder) {
  moveIntakeOrderInCaches(queryClient, order)
}

export function afterIntakeWarehouseConfirmed(queryClient: QueryClient, order: IntakeOrder) {
  moveIntakeOrderInCaches(queryClient, order)
}

export function afterIntakeCastingTreeUpdated(queryClient: QueryClient, order: IntakeOrder) {
  moveIntakeOrderInCaches(queryClient, order)
}

export function afterIntakeBatchUpdated(queryClient: QueryClient, orders: IntakeOrder[]) {
  for (const order of orders) moveIntakeOrderInCaches(queryClient, order)
}

export function afterIntakeCreated(queryClient: QueryClient, order: IntakeOrder) {
  moveIntakeOrderInCaches(queryClient, order)
}

export function afterIntakeUpdated(queryClient: QueryClient, order: IntakeOrder) {
  moveIntakeOrderInCaches(queryClient, order)
}

export function removeIntakeOrderFromCaches(queryClient: QueryClient, orderId: string) {
  patchIntakeQueries(queryClient, (old) => {
    if (!old.items.some((item) => item.id === orderId)) return undefined
    return {
      ...old,
      items: old.items.filter((item) => item.id !== orderId),
      total: Math.max(0, old.total - 1),
    }
  })
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['intake-orders', 'pipeline-lists'] })) {
    const old = query.state.data as IntakePipelineLists | undefined
    if (!old) continue
    queryClient.setQueryData(query.queryKey, removeOrderFromPipelineLists(old, orderId))
  }
  refreshIntakeTabCounts(queryClient)
}
