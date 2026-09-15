import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

/**
 * Xóa dòng: đóng hộp thoại và toast ngay, API chạy nền. Lỗi thì rollback cache.
 */
export function useDeleteRowDialog<T>({
  mutationFn,
  successMessage,
  invalidateKeys,
  queryKeys,
  onRemoved,
}: {
  mutationFn: (row: T) => Promise<unknown>
  successMessage: string
  invalidateKeys?: unknown[][]
  queryKeys?: unknown[][]
  onRemoved?: (row: T) => void
}) {
  const queryClient = useQueryClient()
  const [row, setRow] = useState<T | null>(null)

  const mutation = useMutation({
    mutationFn,
    onMutate: (removed) => {
      const keys = queryKeys ?? invalidateKeys ?? []
      for (const queryKey of keys) void queryClient.cancelQueries({ queryKey })
      const snapshots = keys.map((queryKey) => ({
        queryKey,
        data: queryClient.getQueryData(queryKey),
      }))
      onRemoved?.(removed)
      return { snapshots }
    },
    onError: (error: Error, _removed, ctx) => {
      toast.error(error.message)
      for (const snap of ctx?.snapshots ?? []) {
        queryClient.setQueryData(snap.queryKey, snap.data)
      }
    },
    onSuccess: () => {
      void Promise.all(
        (invalidateKeys ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
    },
  })

  return {
    row,
    request: setRow,
    cancel: () => setRow(null),
    confirm: () => {
      if (!row || mutation.isPending) return
      const current = row
      setRow(null)
      toast.success(successMessage)
      mutation.mutate(current)
    },
    deleting: false,
  }
}
