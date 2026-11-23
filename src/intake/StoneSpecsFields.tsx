import { Alert, Stack, Typography } from '@mui/material'
import { useWatch } from 'react-hook-form'
import { ctToGram, formatQty, gramToCt } from '../api/inventory'
import { FormCheckbox, FormQtyField, FormTextField } from '../components/ui'

/**
 * Đá theo file 3D của 1 sản phẩm (2026-11-23): thợ 3D đọc số trên file mẫu, máy chủ nhân SL đơn
 * ra tổng cả đơn. TL đá nhập theo ct; API (`stoneWeight3dPerPieceGram`) vẫn theo g.
 */
export type StoneSpecs = { hasStone: boolean; stoneCount3d: string; stoneWeight3dCt: string }

/** Ô đá 3D gửi API — số của 1 sản phẩm. */
export type StoneSpecsPayload = {
  stoneCount3dPerPiece?: number | null
  stoneWeight3dPerPieceGram?: number | null
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

/**
 * Đá theo file 3D của 1 sản phẩm: tích "Đơn có đá" mới hiện ô số viên / TL đá. Không tích = đơn
 * không có đá, bỏ qua khâu Vào đá. Đặt trong `<Form>` có các field của `StoneSpecs`.
 * `qty` = SL đơn để hiện tổng cả đơn ngay dưới ô nhập.
 */
export function StoneSpecsFields({ disabled, qty }: { disabled?: boolean; qty?: number | null }) {
  const hasStone = useWatch<StoneSpecs, 'hasStone'>({ name: 'hasStone' })
  const countRaw = useWatch<StoneSpecs, 'stoneCount3d'>({ name: 'stoneCount3d' })
  const ctRaw = useWatch<StoneSpecs, 'stoneWeight3dCt'>({ name: 'stoneWeight3dCt' })
  const orderQty = qty && qty > 0 ? qty : null
  const ct = Number(ctRaw)
  const count = Number(countRaw)
  const totalParts =
    orderQty != null
      ? [
          ct > 0 ? `${formatQty(String(ct))} ct × ${orderQty} sp = ${formatQty(String(round4(ct * orderQty)))} ct` : null,
          countRaw && count > 0 ? `${count * orderQty} viên` : null,
        ].filter(Boolean)
      : []
  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Đá theo file 3D (1 sản phẩm)
      </Typography>
      <FormCheckbox<StoneSpecs>
        name="hasStone"
        label="Đơn có đá"
        helperText={hasStone ? undefined : 'Không tích = đơn không có đá, bỏ qua khâu Vào đá'}
        disabled={disabled}
      />
      {hasStone ? (
        <>
          <Alert severity="info" sx={{ py: 0.25 }}>
            Nhập số viên và TL đá của <b>1 chiếc</b> đúng như trên file 3D — không nhân số lượng.
            {orderQty != null ? (
              <>
                {' '}Hệ thống tự nhân với SL đơn (<b>{orderQty} sp</b>) để tính hao hụt khâu Vào đá.
              </>
            ) : null}
          </Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <FormTextField<StoneSpecs>
              name="stoneCount3d"
              label="Số viên đá của 1 sản phẩm"
              helperText="Đếm trên 1 chiếc, không nhân SL"
              transform={(next) => next.replace(/[^\d]/g, '')}
              size="small"
              fullWidth
              disabled={disabled}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
            <FormQtyField<StoneSpecs>
              name="stoneWeight3dCt"
              label="TL đá của 1 sản phẩm (ct)"
              required
              rules={{
                validate: (value) => (Number(ctToGram(String(value))) > 0 ? true : 'Nhập TL đá lớn hơn 0'),
              }}
              helperText="1 chiếc trên đơn — không nhập tổng cả đơn"
              size="small"
              fullWidth
              disabled={disabled}
            />
          </Stack>
          {totalParts.length ? (
            <Typography variant="body2" color="text.secondary">
              Cả đơn (hệ thống tự nhân): <b>{totalParts.join(' · ')}</b>
            </Typography>
          ) : null}
        </>
      ) : null}
    </Stack>
  )
}

export function stoneSpecsPayload(value: StoneSpecs): StoneSpecsPayload {
  // Không tích "Đơn có đá": ghi rõ 0 viên / 0 ct để đơn bỏ khâu Vào đá.
  if (!value.hasStone) return { stoneCount3dPerPiece: 0, stoneWeight3dPerPieceGram: 0 }
  return {
    stoneCount3dPerPiece:
      value.stoneCount3d === '' || Number(value.stoneCount3d) === 0 ? null : Number(value.stoneCount3d),
    stoneWeight3dPerPieceGram: Number(ctToGram(value.stoneWeight3dCt)),
  }
}

export function stoneSpecsOf(order: {
  qty?: number | null
  stoneCount3d?: number | null
  stoneWeight3dGram?: string | null
  stoneCount3dPerPiece?: number | null
  stoneWeight3dPerPieceGram?: string | null
} | null): StoneSpecs {
  // Chưa khai gì thì mặc định có đá; chỉ bỏ tích khi đơn đã được ghi rõ không có đá (0 viên / 0 ct).
  const weight = order?.stoneWeight3dGram
  const declaredNone = order?.stoneCount3d === 0 || (weight != null && weight !== '' && Number(weight) === 0)
  const hasStone = !declaredNone
  const qty = order?.qty && order.qty > 0 ? order.qty : 1
  // Số 1 sp = tổng cả đơn ÷ SL (máy chủ trả sẵn; máy chủ cũ thì tự chia).
  const perPieceGram =
    order?.stoneWeight3dPerPieceGram ??
    (weight != null && weight !== '' ? String(round4(Number(weight) / qty)) : null)
  const perPieceCount =
    order?.stoneCount3dPerPiece ?? (order?.stoneCount3d != null ? order.stoneCount3d / qty : null)
  return {
    hasStone,
    // Số viên cũ không chia hết cho SL (khai nhầm) thì để trống cho thợ 3D nhập lại.
    stoneCount3d: hasStone && perPieceCount && Number.isInteger(perPieceCount) ? String(perPieceCount) : '',
    stoneWeight3dCt: hasStone ? gramToCt(perPieceGram) : '',
  }
}
