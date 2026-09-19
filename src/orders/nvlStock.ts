import type { QueryClient } from '@tanstack/react-query'

export const NVL_WAREHOUSE_CODE = 'nvl-chinh'

/** Làm mới tồn / phiếu xuất / picker NVL — không đụng kho thành phẩm. */
export function invalidateNvlWarehouse(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', NVL_WAREHOUSE_CODE] })
  void queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', NVL_WAREHOUSE_CODE] })
  void queryClient.invalidateQueries({ queryKey: ['nvl-options'] })
}

/** Đơn mới tự xuất NVL + thành phẩm — làm mới cả kho NVL và sổ thành phẩm. */
export function invalidateNvlStock(queryClient: QueryClient) {
  invalidateNvlWarehouse(queryClient)
  void queryClient.invalidateQueries({ queryKey: ['finished-goods-stock'] })
  void queryClient.invalidateQueries({ queryKey: ['finished-goods-shipments'] })
  void queryClient.invalidateQueries({ queryKey: ['finished-product-options'] })
}
