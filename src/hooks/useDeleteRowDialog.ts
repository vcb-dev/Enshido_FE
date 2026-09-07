import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

/**
 * State + mutation cho hộp thoại "Xóa dòng": bấm icon thùng rác lưu dòng đang
 * chờ xóa, xác nhận thì gọi API rồi làm mới các queryKey liên quan.
 *
 * ```tsx
 * const del = useDeleteRowDialog({
 *   mutationFn: (row: InboundRow) => deleteWarehouseInboundApi(warehouseCode, row.id),
 *   successMessage: 'Đã xóa phiếu nhập',
 *   invalidateKeys: [['warehouse-inbounds', warehouseCode], ['warehouse-stock', warehouseCode]],
 * })
 * <ConfirmDeleteDialog open={Boolean(del.row)} deleting={del.deleting}
 *   onClose={del.cancel} onConfirm={del.confirm} ... />
 * ```
 */
export function useDeleteRowDialog<T>({
  mutationFn,
  successMessage,
  invalidateKeys,
}: {
  mutationFn: (row: T) => Promise<unknown>
  successMessage: string
  invalidateKeys: unknown[][]
}) {
  const queryClient = useQueryClient()
  const [row, setRow] = useState<T | null>(null)

  const mutation = useMutation({
    mutationFn,
    onSuccess: async () => {
      toast.success(successMessage)
      setRow(null)
      await Promise.all(
        invalidateKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return {
    row,
    request: setRow,
    cancel: () => setRow(null),
    confirm: () => row && mutation.mutate(row),
    deleting: mutation.isPending,
  }
}
