import type { QueryClient } from '@tanstack/react-query'
import type { CastingCut, CastingCutList } from '../api/castingCuts'
import { findIntakeOrderByCodeInCaches, moveIntakeOrderInCaches } from '../intake/intakeOrderCache'

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
}

export function removeCastingCutFromCaches(queryClient: QueryClient, cutId: string) {
  patchCastingCutLists(queryClient, (items) => items.filter((row) => row.id !== cutId))
}
