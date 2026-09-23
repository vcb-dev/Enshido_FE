import type { ReactNode } from 'react'
import { InputAdornment, MenuItem, TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'
import { ClearFieldButton, READ_ONLY_FIELD_SX } from './TextInput'

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
  /** Gợi ý trong ô khi chưa chọn — không phải một dòng trong dropdown. */
  placeholder?: string
  /** Hiện nút X để bỏ chọn. */
  clearable?: boolean
  /** Cho phép Select hiện giá trị rỗng (ô bắt buộc chưa chọn). */
  displayEmpty?: boolean
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
  displayEmpty,
  readOnly,
  disabled,
  sx,
  slotProps,
  ...props
}: SelectInputProps<V>) {
  const allowEmpty = placeholder != null || Boolean(displayEmpty)
  const emptyHint = placeholder ?? ''

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
      slotProps={{
        ...slotProps,
        select: {
          displayEmpty: allowEmpty,
          renderValue: (selected) => {
            if (selected === '' || selected == null) {
              return <span style={{ color: '#6f6254' }}>{emptyHint}</span>
            }
            const option = options.find((item) => item.value === selected)
            return option?.label ?? String(selected)
          },
          ...(typeof slotProps?.select === 'object' ? slotProps.select : null),
        },
        // Select trống + displayEmpty: label không tự nâng → đè lên placeholder.
        inputLabel: {
          ...(typeof slotProps?.inputLabel === 'object' ? slotProps.inputLabel : null),
          ...(allowEmpty ? { shrink: true } : null),
        },
        input: {
          ...(allowEmpty ? { notched: true } : null),
          ...(typeof slotProps?.input === 'object' ? slotProps.input : null),
          endAdornment:
            clearable && value !== '' && value != null ? (
              <InputAdornment position="end" sx={{ mr: 2 }}>
                <ClearFieldButton onClear={() => onChange('')} />
              </InputAdornment>
            ) : undefined,
        },
      }}
    >
      {allowEmpty ? <MenuItem value="" sx={{ display: 'none' }} /> : null}
      {options.map((option) => (
        <MenuItem key={String(option.value)} value={option.value} disabled={option.disabled}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  )
}
