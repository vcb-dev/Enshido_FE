import { IconButton, Stack } from '@mui/material'
import { EyeIcon, PencilIcon, TrashIcon } from './icons'

export type RowActionsProps = {
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

/** Cụm nút Xem / Sửa / Xóa ở cột "Hành động"; nút nào không truyền handler thì ẩn. */
export function RowActions({ onView, onEdit, onDelete }: RowActionsProps) {
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
      {onDelete ? (
        <IconButton size="small" aria-label="Xóa" color="error" onClick={onDelete}>
          <TrashIcon />
        </IconButton>
      ) : null}
    </Stack>
  )
}
