import type { ReactElement } from 'react'
import { IconButton, Stack, Tooltip } from '@mui/material'
import { EyeIcon, LockIcon, PencilIcon, TrashIcon, UnlockIcon } from './icons'

export type RowActionsProps = {
  onView?: () => void
  onEdit?: () => void
  /** Hiện nút Sửa nhưng không bấm được, vd: phiếu chuyển kho. */
  editDisabled?: boolean
  onLock?: () => void
  locked?: boolean
  onDelete?: () => void
  /** Khoá nút xóa, vd: dòng đang được dùng ở nơi khác. */
  deleteDisabled?: boolean
  /** Tooltip từng nút; bỏ trống thì không hiện tooltip. */
  titles?: { view?: string; edit?: string; delete?: string }
}

/** Bọc tooltip khi có tiêu đề; nút bị khoá cần `<span>` thì Tooltip mới bắt được hover. */
function WithTooltip({
  title,
  disabled,
  children,
}: {
  title?: string
  disabled?: boolean
  children: ReactElement
}) {
  if (!title) return children
  return (
    <Tooltip title={title}>{disabled ? <span>{children}</span> : children}</Tooltip>
  )
}

/** Cụm nút Xem / Sửa / Khóa / Xóa ở cột "Hành động"; nút nào không truyền handler thì ẩn. */
export function RowActions({
  onView,
  onEdit,
  editDisabled,
  onLock,
  locked,
  onDelete,
  deleteDisabled,
  titles,
}: RowActionsProps) {
  return (
    <Stack direction="row" spacing={0} sx={{ justifyContent: 'center' }}>
      {onView ? (
        <WithTooltip title={titles?.view}>
          <IconButton size="small" aria-label={titles?.view ?? 'Xem'} onClick={onView}>
            <EyeIcon />
          </IconButton>
        </WithTooltip>
      ) : null}
      {onEdit ? (
        <WithTooltip title={titles?.edit} disabled={editDisabled}>
          <IconButton
            size="small"
            aria-label={titles?.edit ?? 'Chỉnh sửa'}
            disabled={editDisabled}
            onClick={onEdit}
          >
            <PencilIcon />
          </IconButton>
        </WithTooltip>
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
        <WithTooltip title={titles?.delete} disabled={deleteDisabled}>
          <IconButton
            size="small"
            aria-label={titles?.delete ?? 'Xóa'}
            color="error"
            disabled={deleteDisabled}
            onClick={onDelete}
          >
            <TrashIcon />
          </IconButton>
        </WithTooltip>
      ) : null}
    </Stack>
  )
}
