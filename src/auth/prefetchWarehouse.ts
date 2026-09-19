import type { QueryClient } from '@tanstack/react-query'
import { THANH_PHAM_WAREHOUSE } from '../warehouses/catalog'

export function prefetchWarehouseStock(queryClient: QueryClient, codes: string[]) {
  const materialCodes = codes.filter((code) => code !== THANH_PHAM_WAREHOUSE)
  if (materialCodes.length) {
    void import('../api/inventory').then(({ getWarehouseStockApi }) => {
      for (const code of materialCodes) {
        void queryClient.prefetchQuery({
          queryKey: ['warehouse-stock', code],
          queryFn: () => getWarehouseStockApi(code),
          staleTime: 60_000,
        })
      }
    })
  }
  if (codes.includes(THANH_PHAM_WAREHOUSE)) {
    void import('../api/finishedGoods').then(
      ({ getFinishedGoodsStockApi, listFinishedGoodsReceiptsApi, listAllShipmentsApi }) => {
        void queryClient.prefetchQuery({
          queryKey: ['finished-goods-stock'],
          queryFn: () => getFinishedGoodsStockApi(),
          staleTime: 15_000,
        })
        void queryClient.prefetchQuery({
          queryKey: ['finished-goods-receipts', ''],
          queryFn: () => listFinishedGoodsReceiptsApi(),
          staleTime: 15_000,
        })
        void queryClient.prefetchQuery({
          queryKey: ['finished-goods-shipments', ''],
          queryFn: () => listAllShipmentsApi(),
          staleTime: 15_000,
        })
      },
    )
  }
  void import('../pages/WarehouseDetailPage')
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
