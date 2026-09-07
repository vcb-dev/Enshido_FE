import { useCallback, useState } from 'react'

export type CrudDialogKind = 'create' | 'edit' | 'view'

type CrudDialogState<T> = { kind: 'create' } | { kind: 'edit' | 'view'; row: T }

/**
 * Hộp thoại Thêm / Sửa / Xem dùng chung cho các bảng kho.
 *
 * `open` tách khỏi `state` để hộp thoại chạy hết hiệu ứng đóng rồi mới xoá dữ
 * liệu dòng — nối `clear` vào `slotProps.transition.onExited`.
 */
export function useCrudDialog<T>() {
  const [state, setState] = useState<CrudDialogState<T> | null>(null)
  const [open, setOpen] = useState(false)

  const openCreate = useCallback(() => {
    setState({ kind: 'create' })
    setOpen(true)
  }, [])

  const openEdit = useCallback((row: T) => {
    setState({ kind: 'edit', row })
    setOpen(true)
  }, [])

  const openView = useCallback((row: T) => {
    setState({ kind: 'view', row })
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])
  const clear = useCallback(() => setState(null), [])

  const kind: CrudDialogKind = state?.kind ?? 'create'

  return {
    open,
    kind,
    /** Dòng đang sửa / xem; `null` khi đang thêm mới. */
    row: state && state.kind !== 'create' ? state.row : null,
    readOnly: state?.kind === 'view',
    openCreate,
    openEdit,
    openView,
    close,
    clear,
  }
}
