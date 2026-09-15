import type { QueryClient } from '@tanstack/react-query'

export function prefetchWarehouseStock(queryClient: QueryClient, codes: string[]) {
  void import('../api/inventory').then(({ getWarehouseStockApi }) => {
    for (const code of codes) {
      void queryClient.prefetchQuery({
        queryKey: ['warehouse-stock', code],
        queryFn: () => getWarehouseStockApi(code),
        staleTime: 60_000,
      })
    }
  })
  void import('../pages/WarehouseDetailPage')
}
