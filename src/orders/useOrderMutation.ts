import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ProductionOrderDetail } from '../api/productionOrders'
import { seedProductionOrder } from './orderCache'

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
      void queryClient.invalidateQueries({ queryKey: ['production-order-costing', code] })
      void queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      toast.success(success)
      const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : (fn: () => void) => window.setTimeout(fn, 0)
      idle(() => {
        void queryClient.invalidateQueries({ queryKey: ['production-orders'], refetchType: 'none' })
        for (const queryKey of [
          ['finished-goods-stock'],
          ['finished-goods-receipts'],
          ['finished-goods-order-options'],
          ['finished-product-options'],
        ]) {
          void queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
        }
      })
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
