import type { ChangeEvent, MouseEvent, ReactNode } from 'react'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'

/** Chữ rõ như ô nhập thường — không xám disabled, không in đậm. */
export const READ_ONLY_FIELD_SX = {
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: '#1c2833',
    color: '#1c2833',
    fontWeight: 400,
  },
  '& .MuiChip-root': { opacity: 1 },
  '& .MuiChip-label': { color: '#1c2833', fontWeight: 400 },
} as const

export type TextInputProps = Omit<TextFieldProps, 'error' | 'helperText'> & {
  /** Có giá trị thì ô nhập chuyển sang trạng thái lỗi và hiện thông báo này. */
  errorText?: string
  /** Ghi chú hiện khi không có lỗi. */
  helperText?: ReactNode
  /** Chế độ xem: khoá ô nhập nhưng vẫn hiển thị chữ rõ như text thường. */
  readOnly?: boolean
  /** Hiện nút X khi ô đang có giá trị. */
  clearable?: boolean
}

export function ClearFieldButton({
  onClear,
  edge = 'end',
}: {
  onClear: () => void
  edge?: 'end' | false
}) {
  return (
    <IconButton
      size="small"
      edge={edge}
      aria-label="Xóa"
      onMouseDown={(event: MouseEvent) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation()
        onClear()
      }}
    >
      <ClearIcon sx={{ fontSize: 16 }} />
    </IconButton>
  )
}

/**
 * Ô nhập văn bản dùng chung. Gộp `error` + `helperText` của MUI về một prop
 * `errorText` để mọi nơi hiển thị lỗi giống nhau.
 * Cỡ `small` và `fullWidth` đã set sẵn trong theme.
 */
export function TextInput({
  errorText,
  helperText,
  readOnly,
  disabled,
  clearable,
  value,
  onChange,
  sx,
  slotProps,
  ...props
}: TextInputProps) {
  const locked = disabled || readOnly
  const text = value == null ? '' : String(value)
  const showClear = Boolean(clearable && !locked && text)
  const inputSlot = slotProps?.input
  const inputSlotProps = inputSlot && typeof inputSlot === 'object' ? inputSlot : {}

  const extraAdornment = 'endAdornment' in inputSlotProps ? inputSlotProps.endAdornment : null
  const endAdornment =
    showClear || extraAdornment ? (
      <InputAdornment position="end">
        {showClear ? (
          <ClearFieldButton
            onClear={() =>
              onChange?.({ target: { value: '' } } as ChangeEvent<HTMLInputElement>)
            }
          />
        ) : null}
        {extraAdornment}
      </InputAdornment>
    ) : undefined

  return (
    <TextField
      {...props}
      value={value}
      onChange={onChange}
      disabled={locked}
      sx={[readOnly ? READ_ONLY_FIELD_SX : false, ...(Array.isArray(sx) ? sx : [sx ?? false])]}
      error={Boolean(errorText)}
      helperText={errorText ?? helperText}
      slotProps={{
        ...slotProps,
        input: {
          ...inputSlotProps,
          endAdornment,
        },
      }}
    />
  )
}
