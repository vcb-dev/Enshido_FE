import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import type { CastingSlip, CastingSlipResultPayload } from '../api/castingSlips'
import type { OrderImage } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { DialogForm, FormQtyField } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'

type Props = {
  slip: Pick<CastingSlip, 'id' | 'code' | 'issueTotalGram' | 'waxWeightGram'> | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CastingSlipResultPayload) => void
}

type Values = { tree: string; silver: string; plaster: string; images: OrderImage[] }

const EMPTY: Values = { tree: '', silver: '', plaster: '', images: [] }

/** Số gram đã chuẩn hoá từ FormQtyField; `null` khi trống / âm (hoặc bằng 0 nếu không cho phép). */
function gram(raw: string, allowZero: boolean) {
  const value = raw.trim() ? Number(raw) : NaN
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value <= 0)) return null
  return value
}

/** Bước 9: thợ đúc nhập kết quả sau đúc — ảnh cân cây thông, bạc và thạch cao đã dùng. */
export function CastingSlipResultDialog({ slip, saving, onClose, onSave }: Props) {
  const [uploading, setUploading] = useState(false)
  const form = useForm<Values>({ defaultValues: EMPTY })

  useEffect(() => {
    if (slip) form.reset(EMPTY)
  }, [slip, form])

  const busy = saving || uploading
  const issued = Number(slip?.issueTotalGram ?? 0)
  // Xem trước hao hụt ngay khi nhập đủ hai số.
  const [tree, silver] = useWatch({ control: form.control, name: ['tree', 'silver'] })
  const previewTree = gram(tree, false)
  const previewUsed = gram(silver, true)
  const preview =
    previewTree != null && previewUsed != null && previewUsed > 0
      ? {
          loss: Math.round((previewUsed - previewTree) * 10000) / 10000,
          percent: ((previewUsed - previewTree) / previewUsed) * 100,
          leftover: Math.max(0, Math.round((issued - previewUsed) * 10000) / 10000),
        }
      : null
  return (
    <Dialog open={Boolean(slip)} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Kết quả đúc — {slip?.code ?? ''}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={(values) =>
          onSave({
            castTreeWeightGram: gram(values.tree, false)!,
            silverUsedGram: gram(values.silver, true)!,
            plasterUsedGram: gram(values.plaster, true)!,
            images: values.images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height })),
          })
        }
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {issued > 0 ? (
              <Typography variant="body2">
                Tổng vật tư giao: <strong>{formatQty(String(issued))} g</strong>
              </Typography>
            ) : null}
            <FormQtyField<Values>
              name="tree"
              label="TL cây thông sau đúc — Trả (g)"
              required
              rules={{
                validate: (value, values) => {
                  const treeGram = gram(String(value ?? ''), false)
                  if (treeGram == null) return 'Nhập trọng lượng cây thông sau đúc (g)'
                  const used = gram(values.silver, true)
                  // Giao ≥ bạc đã dùng ≥ cây thông sau đúc — khớp BE.
                  if (used != null && treeGram > used) return 'TL cây thông sau đúc không được nặng hơn bạc đã dùng'
                  return true
                },
              }}
              size="small"
              fullWidth
              disabled={busy}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormQtyField<Values>
                name="silver"
                label="Bạc đã dùng (g)"
                required
                rules={{
                  validate: (value) => {
                    const used = gram(String(value ?? ''), true)
                    if (used == null) return 'Nhập trọng lượng bạc đã dùng (g)'
                    if (issued > 0 && used > issued) {
                      return `Bạc đã dùng vượt tổng vật tư giao (${formatQty(String(issued))} g)`
                    }
                    return true
                  },
                }}
                size="small"
                fullWidth
                disabled={busy}
              />
              <FormQtyField<Values>
                name="plaster"
                label="Thạch cao đã dùng (g)"
                required
                rules={{
                  validate: (value) => (gram(String(value ?? ''), true) == null ? 'Nhập trọng lượng thạch cao đã dùng (g)' : true),
                }}
                size="small"
                fullWidth
                disabled={busy}
              />
            </Stack>
            {preview ? (
              <Typography variant="body2" color={preview.loss < 0 ? 'error' : undefined}>
                Hao hụt đúc: <strong>{formatQty(String(preview.loss))} g</strong> ({preview.percent.toFixed(2)}%) · Bạc
                giao chưa dùng (trả kho): <strong>{formatQty(String(preview.leftover))} g</strong>
              </Typography>
            ) : null}
            <FormImageField<Values>
              name="images"
              label="Ảnh cân cây thông sau đúc"
              kind="CASTING_TREE"
              required
              requiredMessage="Chụp ảnh cân cây thông sau đúc"
              onUploadingChange={setUploading}
              readOnly={saving}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !slip}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
