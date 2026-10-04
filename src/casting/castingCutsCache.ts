import type { QueryClient } from '@tanstack/react-query'
import type { CastingCut, CastingCutList } from '../api/castingCuts'
import { getProductionOrderApi } from '../api/productionOrders'
import { findIntakeOrderByCodeInCaches, moveIntakeOrderInCaches } from '../intake/intakeOrderCache'
import { applyProductionOrderDetail } from '../orders/orderCache'
import { notifyWorkflowChanged } from '../workflow/workflowBroadcast'

function patchCastingCutLists(
  queryClient: QueryClient,
  patch: (items: CastingCut[]) => CastingCut[],
) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['casting-cuts'] })) {
    const old = query.state.data as CastingCutList | undefined
    if (!old?.items) continue
    const items = patch(old.items)
    const added = items.length - old.items.length
    queryClient.setQueryData(query.queryKey, {
      ...old,
      items,
      total: Math.max(0, old.total + added),
    })
  }
}

export function applyCastingCutCreated(queryClient: QueryClient, cut: CastingCut) {
  patchCastingCutLists(queryClient, (items) => {
    if (items.some((row) => row.id === cut.id)) {
      return items.map((row) => (row.id === cut.id ? cut : row))
    }
    return [cut, ...items]
  })

  for (const line of cut.lines) {
    const intakeCode = line.order.intakeCode?.trim()
    if (!intakeCode) continue
    const intake = findIntakeOrderByCodeInCaches(queryClient, intakeCode)
    if (intake) {
      moveIntakeOrderInCaches(queryClient, { ...intake, status: 'WAIT_COOLING' })
    }
  }

  void queryClient.invalidateQueries({ queryKey: ['casting-cut-slip-options'], refetchType: 'none' })
  notifyWorkflowChanged('cut')

  const codes = [...new Set(cut.lines.map((line) => line.order.code).filter(Boolean))]
  for (const code of codes) {
    void getProductionOrderApi(code)
      .then((order) => applyProductionOrderDetail(queryClient, order))
      .catch(() => undefined)
  }
}

export function removeCastingCutFromCaches(queryClient: QueryClient, cutId: string) {
  patchCastingCutLists(queryClient, (items) => items.filter((row) => row.id !== cutId))
}
