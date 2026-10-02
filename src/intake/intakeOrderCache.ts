import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type {
  IntakeOrder,
  IntakeOrderList,
  IntakeOrderStatus,
  IntakePipelineLists,
} from '../api/intakeOrders'
import {
  patchIntakePipelineCounts,
  scheduleIntakePipelineCountsRefresh,
} from './intakePipelineCountsRefresh'

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
]

function emptyList(pageSize = 200): IntakeOrderList {
  return { items: [], total: 0, page: 1, pageSize }
}

/** Tab Tất cả dùng pipeline-lists — phải patch riêng, không chỉ pending-list. */
function patchPipelineLists(queryClient: QueryClient, order: IntakeOrder) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['intake-orders', 'pipeline-lists'] })) {
    const old = query.state.data as IntakePipelineLists | undefined
    if (!old) continue
    queryClient.setQueryData(query.queryKey, moveOrderInPipelineLists(old, order))
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
  if (!PIPELINE_LIST_STATUSES.includes(order.status)) return without
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

function pendingListKey(key: QueryKey) {
  const slot = key[1]
  return slot === 'pending-for-all' || slot === 'pending-list' || slot === 'pending-count'
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
}

function listKeyMatchesStatus(queryKey: QueryKey, status: IntakeOrderStatus) {
  const slot = String(queryKey[1] ?? '')
  if (slot.endsWith('-count')) return false
  return LIST_SLOT_STATUS[slot] === status
}

function reconcileOrderInList(
  old: IntakeOrderList,
  queryKey: QueryKey,
  order: IntakeOrder,
): IntakeOrderList | undefined {
  const inList = old.items.some((item) => item.id === order.id)
  const shouldBeHere = listKeyMatchesStatus(queryKey, order.status)
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
  return { ...old, items: [...old.items, order], total: old.total + 1 }
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

/** Tìm đơn intake đang có trong cache (pipeline hoặc list). */
export function findIntakeOrderByCodeInCaches(
  queryClient: QueryClient,
  code: string,
): IntakeOrder | undefined {
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
export function moveIntakeOrderInCaches(queryClient: QueryClient, order: IntakeOrder) {
  const prev = findIntakeOrderInCaches(queryClient, order.id)
  patchPipelineLists(queryClient, order)
  patchIntakeQueries(queryClient, (old, queryKey) => reconcileOrderInList(old, queryKey, order))
  patchIntakePipelineCounts(queryClient, prev?.status, order.status)
  scheduleIntakePipelineCountsRefresh(queryClient)
}

export function refreshIntakeTabCounts(queryClient: QueryClient) {
  scheduleIntakePipelineCountsRefresh(queryClient)
}

function patchPendingRemove(old: IntakeOrderList, queryKey: QueryKey, orderId: string): IntakeOrderList | undefined {
  if (!pendingListKey(queryKey)) return undefined
  if (queryKey[1] === 'pending-count') {
    return { ...old, total: Math.max(0, old.total - 1) }
  }
  if (!old.items.some((item) => item.id === orderId)) return undefined
  return {
    ...old,
    items: old.items.filter((item) => item.id !== orderId),
    total: Math.max(0, old.total - 1),
  }
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
  patchIntakeQueries(queryClient, (old, queryKey) => patchPendingRemove(old, queryKey, order.id))
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['intake-orders', 'pipeline-lists'] })) {
    const old = query.state.data as IntakePipelineLists | undefined
    if (!old) continue
    queryClient.setQueryData(query.queryKey, removeOrderFromPipelineLists(old, order.id))
  }
  refreshIntakeTabCounts(queryClient)
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
