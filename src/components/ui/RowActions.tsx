import { IconButton, Stack } from '@mui/material'
import { EyeIcon, LockIcon, PencilIcon, TrashIcon, UnlockIcon } from './icons'

export type RowActionsProps = {
  onView?: () => void
  onEdit?: () => void
  onLock?: () => void
  locked?: boolean
  onDelete?: () => void
}

/** Cụm nút Xem / Sửa / Khóa / Xóa ở cột "Hành động"; nút nào không truyền handler thì ẩn. */
export function RowActions({ onView, onEdit, onLock, locked, onDelete }: RowActionsProps) {
  return (
    <Stack direction="row" spacing={0} sx={{ justifyContent: 'center' }}>
      {onView ? (
        <IconButton size="small" aria-label="Xem" onClick={onView}>
          <EyeIcon />
        </IconButton>
      ) : null}
      {onEdit ? (
        <IconButton size="small" aria-label="Chỉnh sửa" onClick={onEdit}>
          <PencilIcon />
        </IconButton>
      ) : null}
      {onLock ? (
        <IconButton
          size="small"
          aria-label={locked ? 'Mở khóa' : 'Khóa tài khoản'}
          onClick={onLock}
        >
          {locked ? <UnlockIcon /> : <LockIcon />}
        </IconButton>
      ) : null}
      {onDelete ? (
        <IconButton size="small" aria-label="Xóa" color="error" onClick={onDelete}>
          <TrashIcon />
        </IconButton>
      ) : null}
    </Stack>
  )
}
