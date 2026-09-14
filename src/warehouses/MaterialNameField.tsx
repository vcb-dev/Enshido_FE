import { Autocomplete, TextField } from '@mui/material'

export type StockMaterialOption = {
  id: string
  name: string
  sku: string | null
  unitId: string
  unit: string
  qty?: string
  locationCode?: string | null
  otherClassId?: string | null
  priceLayers?: { qty: string; unitPrice: string; source?: 'opening' | 'inbound' }[]
}

export function MaterialNameField({
  value,
  materials,
  readOnly,
  keepMaterialOnType,
  loading,
  noun = 'NVL',
  nameLabel,
  createLabel = 'Nhập NVL',
  allowCreate,
  sx,
  errorText,
  onBlur,
  onChange,
  onSelect,
}: {
  value: string
  materials: StockMaterialOption[]
  readOnly?: boolean
  keepMaterialOnType?: boolean
  loading?: boolean
  noun?: string
  nameLabel?: string
  createLabel?: string
  allowCreate?: boolean
  sx?: object
  errorText?: string
  onBlur?: () => void
  onChange: (name: string) => void
  onSelect: (material: StockMaterialOption | null) => void
}) {
  const fieldLabel = nameLabel ?? `Tên ${noun}`
  if (readOnly) {
    return (
      <TextField
        label={fieldLabel}
        value={value || '—'}
        disabled
        sx={sx}
      />
    )
  }

  const selected = materials.find((item) => item.name === value) ?? null

  return (
    <Autocomplete
      forcePopupIcon
      options={materials}
      value={selected}
      inputValue={value}
      onBlur={onBlur}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, next) => option.id === next.id}
      filterOptions={(options, state) => {
        const q = state.inputValue.trim().toLowerCase()
        const matched = !q
          ? options
          : options.filter(
              (item) =>
                item.name.toLowerCase().includes(q) ||
                (item.sku ?? '').toLowerCase().includes(q),
            )
        return matched.slice(0, 50)
      }}
      onInputChange={(_, next, reason) => {
        onChange(next)
        if (reason === 'input' && !keepMaterialOnType) onSelect(null)
      }}
      onChange={(_, next) => {
        if (next) {
          onChange(next.name)
          onSelect(next)
          return
        }
        onChange('')
        onSelect(null)
      }}
      autoHighlight
      openOnFocus
      loading={loading}
      noOptionsText={
        loading
          ? `Đang tải ${noun}…`
          : allowCreate
            ? `Chưa có ${noun} khớp. Gõ tên mới.`
            : `Chưa có ${noun}. ${createLabel} ở Tồn.`
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={fieldLabel}
          required
          sx={sx}
          error={Boolean(errorText)}
          helperText={errorText}
        />
      )}
    />
  )
}
