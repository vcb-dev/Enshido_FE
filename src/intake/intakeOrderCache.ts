import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { IntakeOrder, IntakeOrderList } from '../api/intakeOrders'

function pendingListKey(key: QueryKey) {
  const slot = key[1]
  return slot === 'pending-for-all' || slot === 'pending-list' || slot === 'pending-count'
}

function approvedListKey(key: QueryKey) {
  const slot = key[1]
  return slot === 'approved-for-all' || slot === 'approved-count'
}

function readyListKey(key: QueryKey) {
  const slot = key[1]
  return slot === 'ready-for-all' || slot === 'ready-count'
}

function waxListKey(key: QueryKey) {
  const slot = key[1]
  return slot === 'wax-for-all' || slot === 'wax-count'
}

function waxConfirmedListKey(key: QueryKey) {
  const slot = key[1]
  return slot === 'wax-confirmed-for-all' || slot === 'wax-confirmed-count'
}

function warehousePendingListKey(key: QueryKey) {
  const slot = key[1]
  return slot === 'warehouse-pending-for-all' || slot === 'warehouse-pending-count'
}

function patchIntakeQueries(
  queryClient: QueryClient,
  patch: (old: IntakeOrderList, queryKey: QueryKey) => IntakeOrderList | undefined,
) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['intake-orders'] })) {
    const old = query.state.data as IntakeOrderList | undefined
    if (!old) continue
    const next = patch(old, query.queryKey)
    if (next && next !== old) {
      queryClient.setQueryData(query.queryKey, next)
    }
  }
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

function patchApprovedUpsert(old: IntakeOrderList, queryKey: QueryKey, order: IntakeOrder): IntakeOrderList | undefined {
  if (!approvedListKey(queryKey)) return undefined
  if (queryKey[1] === 'approved-count') {
    const bump = old.items.some((item) => item.id === order.id) ? 0 : 1
    return { ...old, total: old.total + bump }
  }
  if (old.items.some((item) => item.id === order.id)) {
    return {
      ...old,
      items: old.items.map((item) => (item.id === order.id ? order : item)),
    }
  }
  return { ...old, items: [...old.items, order], total: old.total + 1 }
}

function patchApprovedRemove(old: IntakeOrderList, queryKey: QueryKey, orderId: string): IntakeOrderList | undefined {
  if (!approvedListKey(queryKey)) return undefined
  if (queryKey[1] === 'approved-count') {
    return { ...old, total: Math.max(0, old.total - 1) }
  }
  if (!old.items.some((item) => item.id === orderId)) return undefined
  return {
    ...old,
    items: old.items.filter((item) => item.id !== orderId),
    total: Math.max(0, old.total - 1),
  }
}

function patchReadyUpsert(old: IntakeOrderList, queryKey: QueryKey, order: IntakeOrder): IntakeOrderList | undefined {
  if (!readyListKey(queryKey)) return undefined
  if (queryKey[1] === 'ready-count') {
    const bump = old.items.some((item) => item.id === order.id) ? 0 : 1
    return { ...old, total: old.total + bump }
  }
  if (old.items.some((item) => item.id === order.id)) {
    return {
      ...old,
      items: old.items.map((item) => (item.id === order.id ? order : item)),
    }
  }
  return { ...old, items: [...old.items, order], total: old.total + 1 }
}

function patchReadyRemove(old: IntakeOrderList, queryKey: QueryKey, orderId: string): IntakeOrderList | undefined {
  if (!readyListKey(queryKey)) return undefined
  if (queryKey[1] === 'ready-count') {
    return { ...old, total: Math.max(0, old.total - 1) }
  }
  if (!old.items.some((item) => item.id === orderId)) return undefined
  return {
    ...old,
    items: old.items.filter((item) => item.id !== orderId),
    total: Math.max(0, old.total - 1),
  }
}

function patchWarehousePendingUpsert(
  old: IntakeOrderList,
  queryKey: QueryKey,
  order: IntakeOrder,
): IntakeOrderList | undefined {
  if (!warehousePendingListKey(queryKey)) return undefined
  if (queryKey[1] === 'warehouse-pending-count') {
    const bump = old.items.some((item) => item.id === order.id) ? 0 : 1
    return { ...old, total: old.total + bump }
  }
  if (old.items.some((item) => item.id === order.id)) {
    return {
      ...old,
      items: old.items.map((item) => (item.id === order.id ? order : item)),
    }
  }
  return { ...old, items: [...old.items, order], total: old.total + 1 }
}

function patchWarehousePendingRemove(
  old: IntakeOrderList,
  queryKey: QueryKey,
  orderId: string,
): IntakeOrderList | undefined {
  if (!warehousePendingListKey(queryKey)) return undefined
  if (queryKey[1] === 'warehouse-pending-count') {
    return { ...old, total: Math.max(0, old.total - 1) }
  }
  if (!old.items.some((item) => item.id === orderId)) return undefined
  return {
    ...old,
    items: old.items.filter((item) => item.id !== orderId),
    total: Math.max(0, old.total - 1),
  }
}

function patchWaxRemove(old: IntakeOrderList, queryKey: QueryKey, orderId: string): IntakeOrderList | undefined {
  if (!waxListKey(queryKey)) return undefined
  if (queryKey[1] === 'wax-count') {
    return { ...old, total: Math.max(0, old.total - 1) }
  }
  if (!old.items.some((item) => item.id === orderId)) return undefined
  return {
    ...old,
    items: old.items.filter((item) => item.id !== orderId),
    total: Math.max(0, old.total - 1),
  }
}

function patchWaxUpsert(old: IntakeOrderList, queryKey: QueryKey, order: IntakeOrder): IntakeOrderList | undefined {
  if (!waxListKey(queryKey)) return undefined
  if (queryKey[1] === 'wax-count') {
    const bump = old.items.some((item) => item.id === order.id) ? 0 : 1
    return { ...old, total: old.total + bump }
  }
  if (old.items.some((item) => item.id === order.id)) {
    return {
      ...old,
      items: old.items.map((item) => (item.id === order.id ? order : item)),
    }
  }
  return { ...old, items: [...old.items, order], total: old.total + 1 }
}

function patchWaxConfirmedUpsert(
  old: IntakeOrderList,
  queryKey: QueryKey,
  order: IntakeOrder,
): IntakeOrderList | undefined {
  if (!waxConfirmedListKey(queryKey)) return undefined
  if (queryKey[1] === 'wax-confirmed-count') {
    const bump = old.items.some((item) => item.id === order.id) ? 0 : 1
    return { ...old, total: old.total + bump }
  }
  if (old.items.some((item) => item.id === order.id)) {
    return {
      ...old,
      items: old.items.map((item) => (item.id === order.id ? order : item)),
    }
  }
  return { ...old, items: [...old.items, order], total: old.total + 1 }
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
  for (const item of castDoneItems) byId.set(item.id, item)
  return [...byId.values()].sort((a, b) => {
    const tb = Date.parse(b.createdAt) || 0
    const ta = Date.parse(a.createdAt) || 0
    if (tb !== ta) return tb - ta
    return b.code.localeCompare(a.code)
  })
}

/** Đánh dấu stale — không refetch ngay (tránh refetch lệch nhau làm mất dòng giữa chừng). */
export function markIntakeOrdersStale(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['intake-orders'], refetchType: 'none' })
}

/** Cập nhật mọi query intake liên quan trong một lượt patch. */
export function afterIntakeApproved(queryClient: QueryClient, order: IntakeOrder) {
  patchIntakeQueries(queryClient, (old, queryKey) => {
    const pending = patchPendingRemove(old, queryKey, order.id)
    if (pending) return pending
    if (order.status === 'READY_FOR_PRODUCTION') {
      const ready = patchReadyUpsert(old, queryKey, order)
      if (ready) return ready
      return undefined
    }
    const approved = patchApprovedUpsert(old, queryKey, order)
    if (approved) return approved
    return undefined
  })
}

export function afterIntakeRejected(queryClient: QueryClient, order: IntakeOrder) {
  patchIntakeQueries(queryClient, (old, queryKey) => patchPendingRemove(old, queryKey, order.id))
}

export function afterIntakeModel3dAttached(queryClient: QueryClient, order: IntakeOrder) {
  patchIntakeQueries(queryClient, (old, queryKey) => {
    const approved = patchApprovedRemove(old, queryKey, order.id)
    if (approved) return approved
    const ready = patchReadyUpsert(old, queryKey, order)
    if (ready) return ready
    return undefined
  })
}

export function afterIntakeProductSpecsSubmitted(queryClient: QueryClient, order: IntakeOrder) {
  patchIntakeQueries(queryClient, (old, queryKey) => {
    const approved = patchApprovedRemove(old, queryKey, order.id)
    if (approved) return approved
    const ready = patchReadyRemove(old, queryKey, order.id)
    if (ready) return ready
    if (order.status === 'PENDING_WAREHOUSE_CONFIRMATION') {
      const warehouse = patchWarehousePendingUpsert(old, queryKey, order)
      if (warehouse) return warehouse
      return undefined
    }
    const wax = patchWaxUpsert(old, queryKey, order)
    if (wax) return wax
    return undefined
  })
}

export function afterIntakeWarehouseConfirmed(queryClient: QueryClient, order: IntakeOrder) {
  patchIntakeQueries(queryClient, (old, queryKey) => {
    const warehouse = patchWarehousePendingRemove(old, queryKey, order.id)
    if (warehouse) return warehouse
    const confirmed = patchWaxConfirmedUpsert(old, queryKey, order)
    if (confirmed) return confirmed
    return undefined
  })
}

export function afterIntakeCastingTreeUpdated(queryClient: QueryClient, order: IntakeOrder) {
  patchIntakeQueries(queryClient, (old, queryKey) => {
    const wax = patchWaxRemove(old, queryKey, order.id)
    if (wax) return wax
    const warehouse = patchWarehousePendingUpsert(old, queryKey, order)
    if (warehouse) return warehouse
    return undefined
  })
}
