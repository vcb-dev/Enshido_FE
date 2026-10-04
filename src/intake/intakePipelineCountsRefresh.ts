import type { QueryClient } from '@tanstack/react-query'
import type { IntakeOrderStatus, IntakePipelineCounts } from '../api/intakeOrders'

let timer: ReturnType<typeof setTimeout> | undefined

/** Gom refetch badge tab — tránh bão request sau nhiều thao tác liên tiếp. */
export function scheduleIntakePipelineCountsRefresh(queryClient: QueryClient) {
  if (timer !== undefined) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = undefined
    void queryClient.invalidateQueries({ queryKey: ['intake-orders', 'pipeline-counts'] })
  }, 2_500)
}

export function patchIntakePipelineCounts(
  queryClient: QueryClient,
  from: IntakeOrderStatus | undefined,
  to: IntakeOrderStatus | undefined,
) {
  if (from === to) return
  queryClient.setQueriesData<IntakePipelineCounts>(
    { queryKey: ['intake-orders', 'pipeline-counts'] },
    (old) => {
      if (!old) return old
      const next = { ...old }
      if (from && from in next) next[from] = Math.max(0, (next[from] ?? 0) - 1)
      if (to) next[to] = (next[to] ?? 0) + 1
      return next
    },
  )
}
