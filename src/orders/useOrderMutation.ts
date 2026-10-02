import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ProductionOrderDetail } from '../api/productionOrders'
import { seedProductionOrder } from './orderCache'
import { scheduleMyTicketsRefresh } from './myTicketsRefresh'

/** Mọi thao tác trên đơn trả về chi tiết đơn mới — ghi thẳng vào cache, không refetch cả sổ. */
export function useOrderMutation<V>(
  code: string,
  fn: (vars: V) => Promise<ProductionOrderDetail>,
  success: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
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
      toast.success(success)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
