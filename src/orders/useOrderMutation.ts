import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ProductionOrderDetail } from '../api/productionOrders'
import { seedProductionOrder } from './orderCache'
import { scheduleMyTicketsRefresh } from './myTicketsRefresh'
import { scheduleProductionStatusCountsRefresh } from './productionStatusCountsRefresh'

/** Mọi thao tác trên đơn trả về chi tiết đơn mới — ghi thẳng vào cache, không refetch cả sổ. */
export function useOrderMutation<V>(
  code: string,
  fn: (vars: V) => Promise<ProductionOrderDetail>,
  /** Thông báo khi xong — truyền hàm khi câu chữ tuỳ theo biến (vd. khâu được xác nhận). */
  success: string | ((vars: V) => string),
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (order, vars) => {
      seedProductionOrder(queryClient, order)
      void queryClient.invalidateQueries({
        queryKey: ['production-order-costing', code],
        refetchType: 'none',
      })
      void queryClient.invalidateQueries({
        queryKey: ['production-order-activity', code],
        refetchType: 'none',
      })
      scheduleMyTicketsRefresh(queryClient)
      scheduleProductionStatusCountsRefresh(queryClient)
      toast.success(typeof success === 'function' ? success(vars) : success)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
