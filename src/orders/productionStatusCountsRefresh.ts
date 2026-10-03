import type { QueryClient } from '@tanstack/react-query'
import type { ProductionStatus } from '../api/productionOrders'

export type ProductionStatusCounts = Record<ProductionStatus | 'ALL', number>

let timer: ReturnType<typeof setTimeout> | undefined

/** Gom refetch badge tab Lệnh SX — tránh bão request sau nhiều thao tác liên tiếp. */
export function scheduleProductionStatusCountsRefresh(queryClient: QueryClient) {
  if (timer !== undefined) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = undefined
    void queryClient.invalidateQueries({ queryKey: ['production-orders', 'status-counts'] })
  }, 2_500)
}

export function patchProductionStatusCounts(
  queryClient: QueryClient,
  from: ProductionStatus | undefined,
  to: ProductionStatus | undefined,
) {
  if (from && to && from === to) return
  if (!from && !to) return
  queryClient.setQueriesData<{ statusCounts: ProductionStatusCounts }>(
    { queryKey: ['production-orders', 'status-counts'] },
    (old) => {
      if (!old?.statusCounts) return old
      const statusCounts = { ...old.statusCounts }
      if (from && to) {
        statusCounts[from] = Math.max(0, (statusCounts[from] ?? 0) - 1)
        statusCounts[to] = (statusCounts[to] ?? 0) + 1
      } else if (from) {
        statusCounts[from] = Math.max(0, (statusCounts[from] ?? 0) - 1)
        statusCounts.ALL = Math.max(0, statusCounts.ALL - 1)
      } else if (to) {
        statusCounts[to] = (statusCounts[to] ?? 0) + 1
        statusCounts.ALL += 1
      }
      return { statusCounts }
    },
  )
}
