import type { ReactNode } from 'react'
import { MenuItem, TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'
import { READ_ONLY_FIELD_SX } from './TextInput'

export type SelectOptionValue = string | number

export type SelectOption<V extends SelectOptionValue = string> = {
  value: V
  label: ReactNode
  disabled?: boolean
}

export type SelectInputProps<V extends SelectOptionValue = string> = Omit<
  TextFieldProps,
  'select' | 'error' | 'helperText' | 'value' | 'onChange' | 'children'
> & {
  options: SelectOption<V>[]
  value: V | ''
  onChange: (value: V | '') => void
  errorText?: string
  helperText?: ReactNode
  /** Dòng trống đầu danh sách, cho phép bỏ chọn. */
  placeholder?: string
  /** Hiện dòng trống ngay cả khi không có `placeholder`. */
  clearable?: boolean
  /** Chế độ xem: hiện nhãn của lựa chọn dưới dạng text tĩnh. */
  readOnly?: boolean
}

/**
 * Ô chọn một giá trị từ danh sách `options`.
 * Dựng trên `TextField select` nên label / lỗi / cỡ giống hệt [TextInput](./TextInput.tsx).
 */
export function SelectInput<V extends SelectOptionValue = string>({
  options,
  value,
  onChange,
  errorText,
  helperText,
  placeholder,
  clearable,
  readOnly,
  disabled,
  sx,
  ...props
}: SelectInputProps<V>) {
  const showEmpty = clearable || placeholder != null

  // Ở chế độ xem, `select` bị tắt và ô hiển thị thẳng nhãn đã chọn — bật select
  // kèm disabled sẽ ra ô trống vì MUI không tìm thấy MenuItem tương ứng.
  if (readOnly) {
    const selected = options.find((option) => option.value === value)
    return (
      <TextField
        {...props}
        disabled
        value={typeof selected?.label === 'string' ? selected.label : (value ?? '—') || '—'}
        sx={[READ_ONLY_FIELD_SX, ...(Array.isArray(sx) ? sx : [sx ?? false])]}
        error={Boolean(errorText)}
        helperText={errorText ?? helperText}
      />
    )
  }

  return (
    <TextField
      {...props}
      select
      disabled={disabled}
      sx={sx}
      value={value}
      onChange={(event) => onChange(event.target.value as V | '')}
      error={Boolean(errorText)}
      helperText={errorText ?? helperText}
    >
      {showEmpty ? (
        <MenuItem value="">
          <em>{placeholder ?? 'Tất cả'}</em>
        </MenuItem>
      ) : null}
      {options.map((option) => (
        <MenuItem key={String(option.value)} value={option.value} disabled={option.disabled}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  )
}
