import { Stack, Typography } from '@mui/material'
import { ctToGram, gramToCt } from '../api/inventory'
import { FormQtyField, FormTextField } from '../components/ui'

/** TL đá nhập theo ct; API (`stoneWeight3dGram`) vẫn theo g. */
export type StoneSpecs = { stoneCount3d: string; stoneWeight3dCt: string }

export const EMPTY_STONE_SPECS: StoneSpecs = { stoneCount3d: '', stoneWeight3dCt: '' }

/**
 * Đá theo file 3D của cả đơn — để trống nếu chưa biết, 0 viên = đơn không có đá (bỏ qua Vào đá).
 * Đặt trong `<Form>` có hai field `stoneCount3d` / `stoneWeight3dCt` (xem `StoneSpecs`).
 */
export function StoneSpecsFields({ disabled }: { disabled?: boolean }) {
  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Đá theo file 3D (cả đơn)
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <FormTextField<StoneSpecs>
          name="stoneCount3d"
          label="Số viên đá"
          transform={(next) => next.replace(/[^\d]/g, '')}
          helperText="0 = đơn không có đá, bỏ qua khâu Vào đá"
          size="small"
          fullWidth
          disabled={disabled}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
        <FormQtyField<StoneSpecs>
          name="stoneWeight3dCt"
          label="Tổng TL đá (ct)"
          helperText="Mốc tính hao hụt khâu Vào đá"
          size="small"
          fullWidth
          disabled={disabled}
        />
      </Stack>
    </Stack>
  )
}

export function stoneSpecsPayload(value: StoneSpecs) {
  return {
    stoneCount3d: value.stoneCount3d === '' ? null : Number(value.stoneCount3d),
    stoneWeight3dGram: value.stoneWeight3dCt === '' ? null : Number(ctToGram(value.stoneWeight3dCt)),
  }
}

export function stoneSpecsOf(order: {
  stoneCount3d?: number | null
  stoneWeight3dGram?: string | null
} | null): StoneSpecs {
  return {
    stoneCount3d: order?.stoneCount3d != null ? String(order.stoneCount3d) : '',
    stoneWeight3dCt: gramToCt(order?.stoneWeight3dGram),
  }
}
