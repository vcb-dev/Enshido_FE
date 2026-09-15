import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

/**
 * State + mutation cho hộp thoại "Xóa dòng": bấm icon thùng rác lưu dòng đang
 * chờ xóa, xác nhận thì gọi API rồi làm mới các queryKey liên quan.
 */
export function useDeleteRowDialog<T>({
  mutationFn,
  successMessage,
  invalidateKeys,
  onRemoved,
}: {
  mutationFn: (row: T) => Promise<unknown>
  successMessage: string
  invalidateKeys?: unknown[][]
  onRemoved?: (row: T) => void
}) {
  const queryClient = useQueryClient()
  const [row, setRow] = useState<T | null>(null)

  const mutation = useMutation({
    mutationFn,
    onSuccess: (_data, removed) => {
      toast.success(successMessage)
      setRow(null)
      onRemoved?.(removed)
      void Promise.all(
        (invalidateKeys ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
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
