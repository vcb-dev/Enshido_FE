import { Stack, Typography } from '@mui/material'
import { useWatch } from 'react-hook-form'
import { ctToGram, gramToCt } from '../api/inventory'
import { FormCheckbox, FormQtyField, FormTextField } from '../components/ui'

/** TL đá nhập theo ct; API (`stoneWeight3dGram`) vẫn theo g. */
export type StoneSpecs = { hasStone: boolean; stoneCount3d: string; stoneWeight3dCt: string }

/** Mặc định tích "Đơn có đá" để người nhập thấy ngay hai ô số viên / TL đá. */
export const EMPTY_STONE_SPECS: StoneSpecs = { hasStone: true, stoneCount3d: '', stoneWeight3dCt: '' }

/**
 * Đá theo file 3D của cả đơn: tích "Đơn có đá" mới hiện ô số viên / TL đá. Không tích = đơn không
 * có đá, bỏ qua khâu Vào đá. Đặt trong `<Form>` có các field của `StoneSpecs`.
 */
export function StoneSpecsFields({ disabled }: { disabled?: boolean }) {
  const hasStone = useWatch<StoneSpecs, 'hasStone'>({ name: 'hasStone' })
  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Đá theo file 3D (cả đơn)
      </Typography>
      <FormCheckbox<StoneSpecs>
        name="hasStone"
        label="Đơn có đá"
        helperText={hasStone ? undefined : 'Không tích = đơn không có đá, bỏ qua khâu Vào đá'}
        disabled={disabled}
      />
      {hasStone ? (
        <Stack direction="row" spacing={1.5}>
          <FormTextField<StoneSpecs>
            name="stoneCount3d"
            label="Số viên đá"
            transform={(next) => next.replace(/[^\d]/g, '')}
            size="small"
            fullWidth
            disabled={disabled}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
          <FormQtyField<StoneSpecs>
            name="stoneWeight3dCt"
            label="Tổng TL đá (ct)"
            required
            rules={{
              validate: (value) => (Number(ctToGram(String(value))) > 0 ? true : 'Nhập TL đá lớn hơn 0'),
            }}
            helperText="Mốc tính hao hụt khâu Vào đá"
            size="small"
            fullWidth
            disabled={disabled}
          />
        </Stack>
      ) : null}
    </Stack>
  )
}

export function stoneSpecsPayload(value: StoneSpecs) {
  // Không tích "Đơn có đá": ghi rõ 0 viên / 0 ct để đơn bỏ khâu Vào đá.
  if (!value.hasStone) return { stoneCount3d: 0, stoneWeight3dGram: 0 }
  return {
    stoneCount3d: value.stoneCount3d === '' || Number(value.stoneCount3d) === 0 ? null : Number(value.stoneCount3d),
    stoneWeight3dGram: Number(ctToGram(value.stoneWeight3dCt)),
  }
}

export function stoneSpecsOf(order: {
  stoneCount3d?: number | null
  stoneWeight3dGram?: string | null
} | null): StoneSpecs {
  // Chưa khai gì thì mặc định có đá; chỉ bỏ tích khi đơn đã được ghi rõ không có đá (0 viên / 0 ct).
  const weight = order?.stoneWeight3dGram
  const declaredNone = order?.stoneCount3d === 0 || (weight != null && weight !== '' && Number(weight) === 0)
  const hasStone = !declaredNone
  return {
    hasStone,
    stoneCount3d: hasStone && order?.stoneCount3d ? String(order.stoneCount3d) : '',
    stoneWeight3dCt: hasStone ? gramToCt(order?.stoneWeight3dGram) : '',
  }
}
