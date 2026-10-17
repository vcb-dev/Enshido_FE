import type { QueryClient } from '@tanstack/react-query'
import type { CastingSlip, CastingSlipList, CastingSlipStatus } from '../api/castingSlips'
import type { IntakeOrderStatus } from '../api/intakeOrders'
import type { MyCastingSlipItem, MyTickets } from '../api/productionOrders'
import { findIntakeOrderInCaches, moveIntakeOrderInCaches } from '../intake/intakeOrderCache'
import { scheduleMyTicketsRefresh } from '../orders/myTicketsRefresh'
import { notifyWorkflowChanged } from '../workflow/workflowBroadcast'

function patchCastingSlipLists(
  queryClient: QueryClient,
  patch: (items: CastingSlip[]) => CastingSlip[],
) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['casting-slips'] })) {
    const old = query.state.data as CastingSlipList | undefined
    if (!old?.items) continue
    const items = patch(old.items)
    queryClient.setQueryData(query.queryKey, { ...old, items })
  }
}

function updateSlipInTree(slip: CastingSlip, slipId: string, next: CastingSlip): CastingSlip {
  if (slip.id === slipId) return next
  if (!slip.redos?.length) return slip
  const redos = slip.redos.map((child) => (child.id === slipId ? next : child))
  return { ...slip, redos }
}

function toMyCastingSlipItem(slip: CastingSlip): MyCastingSlipItem {
  return {
    id: slip.id,
    code: slip.code,
    status: slip.status as MyCastingSlipItem['status'],
    slipDate: slip.slipDate.slice(0, 10),
    batchOrderCodes: slip.batchOrderCodes,
    waxWeightGram: slip.waxWeightGram,
    issueTotalGram: slip.issueTotalGram,
    orderCount: slip.orders.length,
    startedAt: slip.startedAt,
    confirmedAt: slip.confirmedAt,
  }
}

function myTicketsBucket(status: CastingSlipStatus): 'available' | 'mine' | 'recent' | null {
  if (status === 'WAIT_CASTING') return 'available'
  if (status === 'CASTING' || status === 'PENDING_CONFIRMATION') return 'mine'
  if (status === 'DONE') return 'recent'
  return null
}

/** Phiếu khâu: Chờ nhận = đã cấp vật tư; Đang giữ = thợ đã bấm Nhận. Chưa cấp không hiện. */
export function patchMyTicketsFromCastingSlip(queryClient: QueryClient, slip: CastingSlip) {
  queryClient.setQueryData<MyTickets>(['my-tickets'], (prev) => {
    if (!prev) return prev
    const without = (rows: MyCastingSlipItem[] | undefined) =>
      (rows ?? []).filter((row) => row.id !== slip.id)
    let castingAvailable = without(prev.castingAvailable)
    let castingMine = without(prev.castingMine)
    let castingRecent = without(prev.castingRecent)
    const bucket = myTicketsBucket(slip.status)
    if (bucket) {
      const item = toMyCastingSlipItem(slip)
      if (bucket === 'available') castingAvailable = [item, ...castingAvailable]
      if (bucket === 'mine') castingMine = [item, ...castingMine]
      if (bucket === 'recent') castingRecent = [item, ...castingRecent]
    }
    return { ...prev, castingAvailable, castingMine, castingRecent }
  })
}

export function applyCastingSlipCreated(queryClient: QueryClient, slip: CastingSlip) {
  queryClient.setQueryData(['casting-slip', slip.id], slip)
  patchCastingSlipLists(queryClient, (items) => {
    if (items.some((row) => row.id === slip.id)) {
      return items.map((row) => (row.id === slip.id ? slip : row))
    }
    return [slip, ...items]
  })
  syncIntakeFromSlip(queryClient, slip)
  patchMyTicketsFromCastingSlip(queryClient, slip)
  scheduleMyTicketsRefresh(queryClient)
  void queryClient.invalidateQueries({ queryKey: ['casting-slip-candidates'] })
  notifyWorkflowChanged('casting')
}

export function applyCastingSlipUpdate(queryClient: QueryClient, updated: CastingSlip) {
  queryClient.setQueryData(['casting-slip', updated.id], updated)
  patchCastingSlipLists(queryClient, (items) =>
    items.map((row) => updateSlipInTree(row, updated.id, updated)),
  )
  syncIntakeFromSlip(queryClient, updated)
  patchMyTicketsFromCastingSlip(queryClient, updated)
  scheduleMyTicketsRefresh(queryClient)
  notifyWorkflowChanged('casting')
}

/** Thủ kho báo lỗi đúc — phiếu lỗi + phiếu làm lại dưới phiếu gốc. */
export function applyCastingSlipRejected(
  queryClient: QueryClient,
  failed: CastingSlip,
  redo: CastingSlip,
) {
  const rootId = failed.redoOfSlipId ?? failed.id
  patchCastingSlipLists(queryClient, (items) =>
    items.map((root) => {
      if (root.id !== rootId) return root
      let next = { ...root }
      if (failed.id === root.id) {
        next = { ...next, status: 'CAST_FAILED' as const }
      } else {
        next = {
          ...next,
          redos: (next.redos ?? []).map((r) =>
            r.id === failed.id ? { ...r, status: 'CAST_FAILED' as const } : r,
          ),
        }
      }
      const redos = [...(next.redos ?? []).filter((r) => r.id !== redo.id), redo]
      return { ...next, redos }
    }),
  )
  syncIntakeFromSlip(queryClient, redo)
  patchMyTicketsFromCastingSlip(queryClient, { ...failed, status: 'CAST_FAILED' })
  patchMyTicketsFromCastingSlip(queryClient, redo)
  scheduleMyTicketsRefresh(queryClient)
  notifyWorkflowChanged('casting')
}

export function syncIntakeFromSlip(queryClient: QueryClient, slip: CastingSlip) {
  for (const line of slip.orders) {
    const prev = findIntakeOrderInCaches(queryClient, line.intakeOrderId)
    if (!prev) continue
    moveIntakeOrderInCaches(queryClient, {
      ...prev,
      status: line.status as IntakeOrderStatus,
      castingSlip: { code: slip.code, status: slip.status },
    })
  }
}
