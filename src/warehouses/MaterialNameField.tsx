import { Autocomplete, TextField } from '@mui/material'

export type StockMaterialOption = {
  id: string
  name: string
  sku: string | null
  unitId: string
  unit: string
  qty?: string
  locationCode?: string | null
  priceLayers?: { qty: string; unitPrice: string; source?: 'opening' | 'inbound' }[]
}

export function MaterialNameField({
  value,
  materials,
  readOnly,
  keepMaterialOnType,
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
  sx?: object
  errorText?: string
  onBlur?: () => void
  onChange: (name: string) => void
  onSelect: (material: StockMaterialOption | null) => void
}) {
  if (readOnly) {
    return (
      <TextField
        label="Tên hàng"
        value={value || '—'}
        required
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
        if (!q) return options
        return options.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            (item.sku ?? '').toLowerCase().includes(q),
        )
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
      noOptionsText="Chưa có NVL. Thêm tên hàng ở Tồn."
      renderInput={(params) => (
        <TextField
          {...params}
          label="Tên hàng"
          required
          sx={sx}
          error={Boolean(errorText)}
          helperText={errorText}
        />
      )}
    />
  )
}
