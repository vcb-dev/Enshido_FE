import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import type { CastingSlip, CastingSlipResultPayload } from '../api/castingSlips'
import type { OrderImage } from '../api/productionOrders'
import { formatQty, parseQtyInput } from '../api/inventory'
import { confirmWeights, ratioWarning } from '../orders/weightSanity'
import { QtyTextField } from '../components/ui/QtyTextField'
import { ImageUploadField } from '../orders/ImageUploadField'

type Props = {
  slip: CastingSlip | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CastingSlipResultPayload) => void
}

function gram(raw: string, allowZero: boolean) {
  const parsed = parseQtyInput(raw.trim())
  const value = parsed ? Number(parsed) : NaN
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value <= 0)) return null
  return value
}

/** Bước 9: thợ đúc nhập kết quả sau đúc — ảnh cân cây thông, bạc và thạch cao đã dùng. */
export function CastingSlipResultDialog({ slip, saving, onClose, onSave }: Props) {
  const [tree, setTree] = useState('')
  const [silver, setSilver] = useState('')
  const [plaster, setPlaster] = useState('')
  const [images, setImages] = useState<OrderImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slip) return
    setTree('')
    setSilver('')
    setPlaster('')
    setImages([])
    setError('')
  }, [slip])

  function submit() {
    const castTreeWeightGram = gram(tree, false)
    const silverUsedGram = gram(silver, true)
    const plasterUsedGram = gram(plaster, true)
    if (castTreeWeightGram == null) return setError('Nhập trọng lượng cây thông sau đúc (g)')
    if (silverUsedGram == null) return setError('Nhập trọng lượng bạc đã dùng (g)')
    // Giao ≥ bạc đã dùng ≥ cây thông sau đúc — khớp BE.
    if (issued > 0 && silverUsedGram > issued) {
      return setError(`Bạc đã dùng vượt tổng vật tư giao (${formatQty(String(issued))} g)`)
    }
    if (castTreeWeightGram > silverUsedGram) {
      return setError('TL cây thông sau đúc không được nặng hơn bạc đã dùng')
    }
    if (plasterUsedGram == null) return setError('Nhập trọng lượng thạch cao đã dùng (g)')
    if (!images.length) return setError('Chụp ảnh cân cây thông sau đúc')
    setError('')
    const wax = Number(slip?.waxWeightGram ?? 0)
    if (
      !confirmWeights([
        ratioWarning(castTreeWeightGram, 'Cây thông sau đúc', silverUsedGram, 'bạc đã dùng', {
          min: 0.5,
          max: 1,
          note: 'hao hụt đúc trên 50%',
        }),
        ratioWarning(castTreeWeightGram, 'Cây thông sau đúc', wax, 'sáp giao', {
          min: 1,
          max: 100,
          note: 'bạc thường nặng khoảng 10 lần sáp',
        }),
      ])
    ) {
      return
    }
    onSave({
      castTreeWeightGram,
      silverUsedGram,
      plasterUsedGram,
      images: images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height })),
    })
  }

  const busy = saving || uploading
  const issued = Number(slip?.issueTotalGram ?? 0)
  // Xem trước hao hụt ngay khi nhập đủ hai số.
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
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Cân cây thông sau đúc, nhập bạc và thạch cao đã dùng. Lưu xong mang cây thông ra cho{' '}
            <strong>thủ kho kiểm và xác nhận</strong>.
          </Typography>
          {issued > 0 ? (
            <Typography variant="body2">
              Tổng vật tư giao: <strong>{formatQty(String(issued))} g</strong>. Bạc đã dùng không vượt số giao; cây
              thông sau đúc không nặng hơn bạc đã dùng.
            </Typography>
          ) : null}
          <QtyTextField
            label="TL cây thông sau đúc — Trả (g)"
            value={tree}
            onChange={setTree}
            required
            size="small"
            fullWidth
            disabled={busy}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <QtyTextField
              label="Bạc đã dùng (g)"
              value={silver}
              onChange={setSilver}
              required
              size="small"
              fullWidth
              disabled={busy}
            />
            <QtyTextField
              label="Thạch cao đã dùng (g)"
              value={plaster}
              onChange={setPlaster}
              required
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
          <ImageUploadField
            label="Ảnh cân cây thông sau đúc"
            kind="CASTING_TREE"
            value={images}
            onChange={setImages}
            onUploadingChange={setUploading}
            readOnly={saving}
          />
          {error ? (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Hủy
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy || !slip}>
          {saving ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
