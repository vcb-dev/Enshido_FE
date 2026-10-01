import { Stack, TextField, Typography } from '@mui/material'

export type StoneSpecs = { stoneCount3d: string; stoneWeight3dGram: string }

export const EMPTY_STONE_SPECS: StoneSpecs = { stoneCount3d: '', stoneWeight3dGram: '' }

/** Đá theo file 3D của cả đơn — để trống nếu chưa biết, 0 viên = đơn không có đá (bỏ qua Vào đá). */
export function StoneSpecsFields({
  value,
  onChange,
  disabled,
}: {
  value: StoneSpecs
  onChange: (next: StoneSpecs) => void
  disabled?: boolean
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Đá theo file 3D (cả đơn)
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <TextField
          label="Số viên đá"
          value={value.stoneCount3d}
          onChange={(event) => onChange({ ...value, stoneCount3d: event.target.value.replace(/[^\d]/g, '') })}
          helperText="0 = đơn không có đá, bỏ qua khâu Vào đá"
          size="small"
          fullWidth
          disabled={disabled}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
        <TextField
          label="Tổng TL đá (g)"
          value={value.stoneWeight3dGram}
          onChange={(event) =>
            onChange({ ...value, stoneWeight3dGram: event.target.value.replace(',', '.').replace(/[^\d.]/g, '') })
          }
          helperText="Mốc tính hao hụt khâu Vào đá"
          size="small"
          fullWidth
          disabled={disabled}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        />
      </Stack>
    </Stack>
  )
}

export function stoneSpecsPayload(value: StoneSpecs) {
  return {
    stoneCount3d: value.stoneCount3d === '' ? null : Number(value.stoneCount3d),
    stoneWeight3dGram: value.stoneWeight3dGram === '' ? null : Number(value.stoneWeight3dGram),
  }
}

export function stoneSpecsOf(order: {
  stoneCount3d?: number | null
  stoneWeight3dGram?: string | null
} | null): StoneSpecs {
  return {
    stoneCount3d: order?.stoneCount3d != null ? String(order.stoneCount3d) : '',
    stoneWeight3dGram: order?.stoneWeight3dGram != null ? String(Number(order.stoneWeight3dGram)) : '',
  }
}
