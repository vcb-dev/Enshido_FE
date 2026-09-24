import { Box, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { useMemo } from 'react'
import { formatQty } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import type { FinishedGoodsNvlOption } from '../api/finishedGoods'
import { PlusIcon, TextInput, TrashIcon } from '../components/ui'
import { CatalogPicker, type CatalogPickerItem } from '../orders/CatalogPicker'

export type BomLineFormValue = { materialId: string }

function pickerItems(options: FinishedGoodsNvlOption[]): CatalogPickerItem[] {
  return options.map((item) => ({
    id: item.id,
    label: item.sku ? `${item.sku} — ${item.name}` : item.name,
    summary: [
      `Tồn ${formatQty(item.qty)}`,
      item.materialType,
      item.bodyMetal || item.metalKind,
      item.shape,
      item.color,
      item.sizeLabel ? `size ${item.sizeLabel}` : null,
      item.weight ? `${item.weight}g` : null,
      item.locationCode,
    ]
      .filter(Boolean)
      .join(' · '),
    thumb: item.imageUrl,
  }))
}

function dash(value: string | null | undefined) {
  const text = value?.trim()
  return text ? text : '—'
}

export function BomLinesField({
  options,
  loading,
  readOnly,
}: {
  options: FinishedGoodsNvlOption[]
  loading: boolean
  readOnly: boolean
}) {
  const form = useFormContext<{ bomLines: BomLineFormValue[] }>()
  const lines = useFieldArray({ control: form.control, name: 'bomLines' })
  const watched = useWatch({ control: form.control, name: 'bomLines' }) ?? []
  const byId = useMemo(() => new Map(options.map((item) => [item.id, item])), [options])

  function addAfter(index: number) {
    lines.insert(index + 1, { materialId: '' }, { shouldFocus: false })
  }

  function removeAt(index: number) {
    if (lines.fields.length <= 1) {
      form.setValue('bomLines.0.materialId', '')
      return
    }
    lines.remove(index)
  }

  return (
    <Stack spacing={1.25} sx={{ mt: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        NVL cấu thành
      </Typography>
      {lines.fields.map((field, index) => {
        const selectedIds = new Set(
          watched.map((line, i) => (i === index ? '' : line.materialId)).filter(Boolean),
        )
        const available = options.filter((item) => !selectedIds.has(item.id))
        const material = byId.get(watched[index]?.materialId ?? '')
        return (
          <Paper key={field.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Controller
                  control={form.control}
                  name={`bomLines.${index}.materialId`}
                  render={({ field: picker }) => (
                    <CatalogPicker
                      value={picker.value}
                      options={pickerItems(available)}
                      label="Mã NVL"
                      placeholder="Chọn mã trong kho NVL chính…"
                      loadingText="Đang tải kho NVL…"
                      noOptionsText="Kho NVL chính chưa có mã nào"
                      loading={loading}
                      inputRef={picker.ref}
                      onBlur={picker.onBlur}
                      onChange={picker.onChange}
                    />
                  )}
                />
              </Box>
              {readOnly ? null : (
                <Stack direction="row" sx={{ pt: 0.5, flexShrink: 0 }}>
                  <Tooltip title="Thêm mã NVL">
                    <IconButton
                      size="small"
                      aria-label="Thêm mã NVL"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addAfter(index)}
                    >
                      <PlusIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Xóa mã NVL">
                    <span>
                      <IconButton
                        size="small"
                        aria-label="Xóa mã NVL"
                        onClick={() => removeAt(index)}
                        disabled={lines.fields.length <= 1 && !watched[index]?.materialId}
                      >
                        <TrashIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              )}
            </Stack>
            {material ? <NvlSpecGrid material={material} /> : null}
          </Paper>
        )
      })}
    </Stack>
  )
}

export function NvlBomCards({
  lines,
  footer,
}: {
  lines: FinishedGoodsNvlOption[]
  footer?: (material: FinishedGoodsNvlOption, index: number) => ReactNode
}) {
  if (!lines.length) return null
  return (
    <Stack spacing={1.25}>
      {lines.map((material, index) => (
        <Paper key={material.id} variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {material.sku ? `${material.sku} — ${material.name}` : material.name}
          </Typography>
          <NvlSpecGrid material={material} />
          {footer?.(material, index)}
        </Paper>
      ))}
    </Stack>
  )
}

export function NvlSpecGrid({ material }: { material: FinishedGoodsNvlOption }) {
  return (
    <Stack spacing={1.25} sx={{ mt: 1.5 }}>
      {material.imageUrl ? (
        <Box
          component="img"
          src={cloudinaryThumb(material.imageUrl, 160)}
          alt=""
          sx={{
            width: 72,
            height: 72,
            objectFit: 'cover',
            borderRadius: 0.5,
            border: '1px solid #ded3c3',
          }}
        />
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        <TextInput label="Mã NVL" value={dash(material.sku)} readOnly />
        <TextInput label="Tên NVL" value={material.name} readOnly />
        <TextInput label="Đơn vị" value={dash(material.unit)} readOnly />
        <TextInput label="Size" value={dash(material.sizeLabel)} readOnly />
        <TextInput label="Trọng lượng (g)" value={dash(material.weight)} readOnly />
        <TextInput label="Hình dạng" value={dash(material.shape)} readOnly />
        <TextInput label="Màu sắc" value={dash(material.color)} readOnly />
        <TextInput label="Chất loại" value={dash(material.materialType)} readOnly />
        <TextInput label="Chất liệu" value={dash(material.bodyMetal || material.metalKind)} readOnly />
        <TextInput label="Vị trí" value={dash(material.locationCode)} readOnly />
        <TextInput label="Tồn NVL" value={formatQty(material.qty)} readOnly />
        <TextInput
          label="Ghi chú"
          value={dash(material.note)}
          readOnly
          sx={{ gridColumn: { sm: 'span 2' } }}
        />
      </Box>
    </Stack>
  )
}
