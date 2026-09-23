import { useMemo, type Ref } from 'react'
import { Autocomplete, Box, Stack, TextField, Typography, createFilterOptions } from '@mui/material'
import { cloudinaryThumb } from '../api/uploads'

export type CatalogPickerItem = {
  id: string
  label: string
  summary: string
  thumb: string | null
}

const filterCatalogOptions = createFilterOptions<CatalogPickerItem>({
  limit: 50,
  stringify: (item) => `${item.label} ${item.summary}`,
})

export function CatalogPicker({
  value,
  options,
  label,
  placeholder,
  loadingText,
  noOptionsText,
  helperText,
  loading,
  required,
  autoFocus,
  errorText,
  inputRef,
  onBlur,
  onChange,
}: {
  value: string
  options: CatalogPickerItem[]
  label: string
  placeholder: string
  loadingText: string
  noOptionsText: string
  helperText?: string
  loading: boolean
  required?: boolean
  autoFocus?: boolean
  errorText?: string
  inputRef?: Ref<HTMLInputElement>
  onBlur?: () => void
  onChange: (id: string) => void
}) {
  const selected = useMemo(() => options.find((item) => item.id === value) ?? null, [options, value])

  return (
    <Autocomplete
      fullWidth
      size="small"
      options={options}
      value={selected}
      onChange={(_, next) => onChange(next?.id ?? '')}
      onBlur={onBlur}
      getOptionLabel={(item) => item.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={filterCatalogOptions}
      loading={loading}
      loadingText={loadingText}
      noOptionsText={noOptionsText}
      autoHighlight
      renderOption={(props, item) => {
        const { key, ...rest } = props
        return (
          <li key={key} {...rest}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start', minWidth: 0, width: '100%', py: 0.5 }}>
              <Thumb url={item.thumb} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'normal' }}>
                  {item.label}
                </Typography>
                {item.summary ? (
                  <Typography variant="caption" component="div" color="text.secondary" sx={{ whiteSpace: 'normal' }}>
                    {item.summary}
                  </Typography>
                ) : null}
              </Box>
            </Stack>
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          multiline
          maxRows={3}
          label={label}
          required={required}
          autoFocus={autoFocus}
          placeholder={placeholder}
          inputRef={inputRef}
          error={Boolean(errorText)}
          helperText={errorText ?? helperText ?? selected?.summary}
          title={selected?.label}
          sx={{
            '& .MuiAutocomplete-input': { whiteSpace: 'pre-wrap' },
            '& .MuiInputBase-root': { alignItems: 'flex-start' },
          }}
        />
      )}
    />
  )
}

function Thumb({ url }: { url: string | null }) {
  const sx = {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 0.5,
    border: '1px solid #d5dbe0',
  }
  if (!url) return <Box sx={{ ...sx, bgcolor: 'action.hover' }} />
  return <Box component="img" src={cloudinaryThumb(url, 80)} alt="" loading="lazy" sx={{ ...sx, objectFit: 'cover' }} />
}
