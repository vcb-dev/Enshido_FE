import type { QueryClient } from '@tanstack/react-query'

export const BTP_WAREHOUSE_CODE = 'btp-cho-vao-da'

/** Đơn BTP tự xuất / hoàn kho BTP — làm mới tồn, phiếu xuất và danh sách mã BTP còn tồn. */
export function invalidateBtpStock(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', BTP_WAREHOUSE_CODE] })
  void queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', BTP_WAREHOUSE_CODE] })
  void queryClient.invalidateQueries({ queryKey: ['btp-options'] })
}
