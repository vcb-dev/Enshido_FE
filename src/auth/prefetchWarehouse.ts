import type { QueryClient } from '@tanstack/react-query'
import { THANH_PHAM_WAREHOUSE } from '../warehouses/catalog'

/** Chỉ kéo kho đang mở / sắp mở — không prefetch cả 4 kho lúc đăng nhập. */
export function prefetchWarehouseStock(queryClient: QueryClient, codes: string[]) {
  const unique = Array.from(new Set(codes)).slice(0, 1)
  const materialCodes = unique.filter((code) => code !== THANH_PHAM_WAREHOUSE)
  if (materialCodes.length) {
    void import('../api/inventory').then(({ getWarehouseStockApi }) => {
      for (const code of materialCodes) {
        if (queryClient.getQueryState(['warehouse-stock', code])) continue
        void queryClient.prefetchQuery({
          queryKey: ['warehouse-stock', code],
          queryFn: () => getWarehouseStockApi(code),
          staleTime: 60_000,
        })
      }
    })
  }
  if (unique.includes(THANH_PHAM_WAREHOUSE)) {
    if (queryClient.getQueryState(['finished-goods-stock'])) return
    void import('../api/finishedGoods').then(({ getFinishedGoodsStockApi }) => {
      void queryClient.prefetchQuery({
        queryKey: ['finished-goods-stock'],
        queryFn: () => getFinishedGoodsStockApi(),
        staleTime: 15_000,
      })
    })
  }
}

export function prefetchStaff(queryClient: QueryClient) {
  void import('../pages/UsersPage')
  void import('../api/auth').then(({ listUsersApi }) => {
    void queryClient.prefetchQuery({
      queryKey: ['users'],
      queryFn: listUsersApi,
      staleTime: 60_000,
    })
  })
}
