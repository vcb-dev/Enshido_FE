import type { Ref } from 'react'
import { Autocomplete, TextField } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export type SearchSelectOption = {
  id: string
  name: string
  secondary?: string
}

export function SearchSelect({
  label,
  valueId,
  options,
  required,
  disabled,
  readOnly,
  displayValue,
  placeholder = 'Tìm…',
  allowClear,
  noOptionsText = 'Không có kết quả',
  size = 'medium',
  // Mặc định không portal cho danh sách nằm trên trang. Trong Dialog phải
  // truyền `false`, nếu không popper bị cắt bởi DialogContent có cuộn.
  disablePortal = true,
  errorText,
  helperText,
  inputRef,
  sx,
  onBlur,
  onChange,
}: {
  label: string
  valueId: string
  options: SearchSelectOption[]
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  displayValue?: string
  placeholder?: string
  allowClear?: boolean
  noOptionsText?: string
  size?: 'small' | 'medium'
  disablePortal?: boolean
  /** Có giá trị thì ô chuyển sang trạng thái lỗi và hiện thông báo này. */
  errorText?: string
  helperText?: string
  inputRef?: Ref<HTMLInputElement>
  sx?: SxProps<Theme>
  onBlur?: () => void
  onChange: (id: string) => void
}) {
  if (readOnly) {
    return (
      <TextField
        label={label}
        value={displayValue || options.find((item) => item.id === valueId)?.name || '—'}
        required={required}
        disabled
        sx={sx}
        error={Boolean(errorText)}
        helperText={errorText ?? helperText}
      />
    )
  }

  const selected = options.find((item) => item.id === valueId) ?? null

  return (
    <Autocomplete
      sx={sx}
      fullWidth
      options={options}
      value={selected}
      onChange={(_, next) => onChange(next?.id ?? '')}
      onBlur={onBlur}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(opts, state) => {
        const q = state.inputValue.trim().toLowerCase()
        if (!q) return opts
        return opts.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            (item.secondary ?? '').toLowerCase().includes(q),
        )
      }}
      disableClearable={!allowClear && Boolean(selected)}
      disabled={disabled}
      disablePortal={disablePortal}
      size={size}
      autoHighlight
      openOnFocus
      noOptionsText={noOptionsText}
      renderOption={(props, option) => {
        const { key, ...rest } = props
        return (
          <li key={key} {...rest}>
            {option.secondary ? `${option.name} (${option.secondary})` : option.name}
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          placeholder={placeholder}
          size={size}
          inputRef={inputRef}
          error={Boolean(errorText)}
          helperText={errorText ?? helperText}
        />
      )}
    />
  )
}
