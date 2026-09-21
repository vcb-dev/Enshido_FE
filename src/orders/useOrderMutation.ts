import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ProductionOrderDetail } from '../api/productionOrders'

/** Mọi thao tác trên đơn trả về chi tiết đơn mới — ghi thẳng vào cache rồi làm mới danh sách. */
export function useOrderMutation<V>(
  code: string,
  fn: (vars: V) => Promise<ProductionOrderDetail>,
  success: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      queryClient.setQueryData(['production-order', code], order)
      // Tiền công, bạc thu hồi thay đổi theo từng lần nhận lại khâu.
      void queryClient.invalidateQueries({ queryKey: ['production-order-costing', code] })
      // Phiếu con đổi trạng thái thì màn "Phiếu của tôi" của thợ cũng đổi.
      void queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      toast.success(success)
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
