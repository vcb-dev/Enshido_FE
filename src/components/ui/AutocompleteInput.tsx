import type { ReactNode, Ref } from 'react'
import { Autocomplete, TextField } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export type AutocompleteInputProps<T> = {
  options: T[]
  value: T | null
  onChange: (value: T | null) => void
  getOptionLabel: (option: T) => string
  /** Mặc định so sánh bằng nhãn; truyền vào khi option có `id`. */
  isOptionEqualToValue?: (option: T, value: T) => boolean
  label?: ReactNode
  placeholder?: string
  errorText?: string
  helperText?: ReactNode
  required?: boolean
  disabled?: boolean
  loading?: boolean
  noOptionsText?: ReactNode
  onBlur?: () => void
  inputRef?: Ref<HTMLInputElement>
  sx?: SxProps<Theme>
}

/**
 * Ô chọn có tìm kiếm, dùng khi danh sách dài (NVL, nhà cung cấp, nhân sự...).
 * Chỉ chọn một giá trị và không cho nhập tự do — nhập tự do thì dùng
 * [MaterialNameField](../../warehouses/MaterialNameField.tsx).
 */
export function AutocompleteInput<T>({
  options,
  value,
  onChange,
  getOptionLabel,
  isOptionEqualToValue,
  label,
  placeholder,
  errorText,
  helperText,
  required,
  disabled,
  loading,
  noOptionsText,
  onBlur,
  inputRef,
  sx,
}: AutocompleteInputProps<T>) {
  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, next) => onChange(next)}
      onBlur={onBlur}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={
        isOptionEqualToValue ??
        ((option, next) => getOptionLabel(option) === getOptionLabel(next))
      }
      disabled={disabled}
      loading={loading}
      noOptionsText={noOptionsText ?? 'Không có dữ liệu'}
      autoHighlight
      openOnFocus
      size="small"
      fullWidth
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          inputRef={inputRef}
          error={Boolean(errorText)}
          helperText={errorText ?? helperText}
        />
      )}
    />
  )
}
