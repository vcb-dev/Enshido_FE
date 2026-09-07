import type { ReactNode } from 'react'
import { TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'

/** Giữ chữ đậm màu khi ô bị disabled ở chế độ xem, thay vì xám mờ khó đọc. */
export const READ_ONLY_FIELD_SX = {
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: '#1b2a38',
    color: '#1b2a38',
  },
} as const

export type TextInputProps = Omit<TextFieldProps, 'error' | 'helperText'> & {
  /** Có giá trị thì ô nhập chuyển sang trạng thái lỗi và hiện thông báo này. */
  errorText?: string
  /** Ghi chú hiện khi không có lỗi. */
  helperText?: ReactNode
  /** Chế độ xem: khoá ô nhập nhưng vẫn hiển thị chữ rõ như text thường. */
  readOnly?: boolean
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
  sx,
  ...props
}: TextInputProps) {
  return (
    <TextField
      {...props}
      disabled={disabled || readOnly}
      sx={[readOnly ? READ_ONLY_FIELD_SX : false, ...(Array.isArray(sx) ? sx : [sx ?? false])]}
      error={Boolean(errorText)}
      helperText={errorText ?? helperText}
    />
  )
}
