import type { QueryClient } from '@tanstack/react-query'

export const TOOL_WAREHOUSE_CODE = 'dung-cu'

/** Phiếu dụng cụ đổi tồn thợ, và (cấp / trả) cả tồn / nhập / xuất kho dụng cụ. */
export function invalidateToolQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['tools'] })
  void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', TOOL_WAREHOUSE_CODE] })
  void queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', TOOL_WAREHOUSE_CODE] })
  void queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', TOOL_WAREHOUSE_CODE] })
}
