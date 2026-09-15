import { useMemo, type Ref } from 'react'
import { Autocomplete, Box, Stack, TextField, Typography } from '@mui/material'
import { formatQty } from '../api/inventory'
import type { BtpOption } from '../api/productionOrders'
import { cloudinaryThumb } from '../api/uploads'

type PickerItem = {
  id: string
  label: string
  summary: string
  thumb: string | null
  /** Chuỗi gộp để lọc theo mã, tên và thuộc tính. */
  haystack: string
}

/**
 * Ô chọn mã BTP còn tồn cho Đơn BTP: mỗi dòng có ảnh, mã — tên và thuộc tính sản phẩm
 * để nhận ra đúng hàng trước khi chọn.
 */
export function BtpPicker({
  value,
  options,
  current,
  loading,
  disabled,
  autoFocus,
  errorText,
  inputRef,
  onBlur,
  onChange,
}: {
  value: string
  options: BtpOption[]
  /** BTP đơn đang dùng — có thể đã hết tồn nên không nằm trong `options`. */
  current?: { id: string; sku: string | null; name: string } | null
  loading: boolean
  disabled?: boolean
  /** Lên đơn mới: focus sẵn để danh sách mã mở ngay. */
  autoFocus?: boolean
  errorText?: string
  inputRef?: Ref<HTMLInputElement>
  onBlur?: () => void
  onChange: (id: string) => void
}) {
  const items = useMemo(() => {
    const rows: PickerItem[] = options.map((item) => {
      const label = btpLabel(item)
      const summary = btpSummary(item)
      return {
        id: item.id,
        label,
        summary,
        thumb: item.images[0]?.url ?? null,
        haystack: `${label} ${summary}`.toLowerCase(),
      }
    })
    if (current && !rows.some((item) => item.id === current.id)) {
      const label = btpLabel(current)
      rows.unshift({
        id: current.id,
        label,
        summary: 'Đang dùng cho đơn này',
        thumb: null,
        haystack: label.toLowerCase(),
      })
    }
    return rows
  }, [options, current])

  const selected = items.find((item) => item.id === value) ?? null

  return (
    <Autocomplete
      fullWidth
      size="small"
      options={items}
      value={selected}
      onChange={(_, next) => onChange(next?.id ?? '')}
      onBlur={onBlur}
      getOptionLabel={(item) => item.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(rows, state) => {
        const q = state.inputValue.trim().toLowerCase()
        return q ? rows.filter((item) => item.haystack.includes(q)) : rows
      }}
      disabled={disabled}
      disableClearable={Boolean(selected)}
      loading={loading}
      loadingText="Đang tải kho BTP…"
      noOptionsText="Kho BTP không còn mã nào có tồn"
      autoHighlight
      openOnFocus
      renderOption={(props, item) => {
        const { key, ...rest } = props
        return (
          <li key={key} {...rest}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0, width: '100%' }}>
              <Thumb url={item.thumb} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {item.label}
                </Typography>
                <Typography variant="caption" component="div" noWrap color="text.secondary">
                  {item.summary}
                </Typography>
              </Box>
            </Stack>
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Mã BTP"
          required
          autoFocus={autoFocus}
          placeholder="Tìm mã, tên, màu, size…"
          inputRef={inputRef}
          error={Boolean(errorText)}
          helperText={errorText ?? selected?.summary}
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

function btpLabel(item: { sku: string | null; name: string }) {
  return item.sku ? `${item.sku} — ${item.name}` : item.name
}

function btpSummary(item: BtpOption) {
  return [
    `Tồn ${formatQty(item.qty)} ${item.unit}`,
    item.bodyMetal,
    item.productKind,
    item.category,
    item.platingColor ? `xi ${item.platingColor}` : null,
    item.stoneColor ? `đá ${item.stoneColor}` : null,
    item.sizeLabel ? `size ${item.sizeLabel}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
