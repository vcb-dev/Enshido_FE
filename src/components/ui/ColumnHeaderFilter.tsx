import { Autocomplete, TextField } from '@mui/material'
import { useEffect, useState } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

export type ColumnFilterOption = {
  id: string
  name: string
}

const COLUMN_FILTER_SX = {
  width: '100%',
  minWidth: 0,
  '& .MuiInputBase-root': {
    bgcolor: '#fff',
    fontSize: 12,
    height: 40,
    minHeight: 40,
    boxSizing: 'border-box',
    py: 0,
    alignItems: 'center',
  },
  '& .MuiInputBase-input': {
    py: '0 !important',
    height: '100%',
    boxSizing: 'border-box',
  },
  '& .MuiAutocomplete-input': {
    padding: '0 4px !important',
  },
} as const

/** Ô lọc gọn đặt trên hàng filter, tách khỏi tên cột. */
export function ColumnHeaderFilter({
  valueId,
  options,
  onChange,
  placeholder = 'Tất cả',
}: {
  valueId: string
  options: ColumnFilterOption[]
  onChange: (id: string) => void
  placeholder?: string
}) {
  const selected = options.find((item) => item.id === valueId) ?? null
  return (
    <Autocomplete
      size="small"
      options={options}
      value={selected}
      onChange={(_, next) => onChange(next?.id ?? '')}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      disablePortal={false}
      renderInput={(params) => (
        <TextField {...params} hiddenLabel placeholder={placeholder} />
      )}
      sx={{ ...COLUMN_FILTER_SX, display: 'block' }}
    />
  )
}

/** Ô tìm theo tên, lọc dần khi gõ. */
export function ColumnHeaderSearch({
  value,
  onChange,
  placeholder = 'Tìm tên…',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  const debounced = useDebouncedValue(draft, 250)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (debounced !== value) onChange(debounced)
  }, [debounced, onChange, value])

  return (
    <TextField
      size="small"
      hiddenLabel
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={placeholder}
      sx={COLUMN_FILTER_SX}
    />
  )
}
