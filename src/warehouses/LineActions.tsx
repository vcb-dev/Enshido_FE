import { IconButton, Stack, Tooltip } from '@mui/material'
import { PlusIcon, TrashIcon } from '../components/ui'

/** Cộng / thùng rác trên từng dòng Tồn · Nhập · Xuất khi tạo nhiều mã. */
export function LineActions({
  addLabel,
  removeLabel,
  onAdd,
  onRemove,
  removeDisabled,
}: {
  addLabel: string
  removeLabel: string
  onAdd: () => void
  onRemove: () => void
  removeDisabled?: boolean
}) {
  return (
    <Stack direction="row" sx={{ pt: 0.25, flexShrink: 0 }}>
      <Tooltip title={addLabel}>
        <IconButton
          size="small"
          aria-label={addLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onAdd}
        >
          <PlusIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title={removeLabel}>
        <span>
          <IconButton
            size="small"
            aria-label={removeLabel}
            onClick={onRemove}
            disabled={removeDisabled}
          >
            <TrashIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  )
}
