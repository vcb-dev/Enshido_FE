import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import type { CastingSlip } from '../api/castingSlips'
import { formatQty } from '../api/inventory'
import { formatDateTime } from '../orders/catalog'
import { IntakeImageThumbs } from './IntakeImageThumbs'

function gram(value: string | null | undefined) {
  if (value == null || value === '') return '—'
  return `${formatQty(value)} g`
}

/** Thủ kho xem lại đúng số liệu thợ đúc vừa nhập — không nhập lại, không cắt cây thông. */
export function CastingSlipConfirmDialog({
  slip,
  saving,
  onClose,
  onConfirm,
}: {
  slip: CastingSlip | null
  saving: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const resultThumbs = (slip?.resultImages ?? []).map((image, index) => ({
    kind: 'CASTING_TREE' as const,
    url: image.url,
    publicId: image.publicId,
    width: image.width,
    height: image.height,
    sortOrder: index,
  }))

  return (
    <Dialog open={Boolean(slip)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Xác nhận — {slip?.code ?? ''}</DialogTitle>
      <DialogContent>
        {slip ? (
          <Stack spacing={1.25} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Số liệu thợ đúc{slip.submittedByName ? ` (${slip.submittedByName})` : ''} vừa nhập
              {slip.submittedAt ? ` · ${formatDateTime(slip.submittedAt)}` : ''}. Kiểm tra rồi xác nhận
              để chuyển phiếu sang Đúc xong.
            </Typography>
            <Typography variant="body2">
              Tổng vật tư giao: <strong>{gram(slip.issueTotalGram)}</strong>
            </Typography>
            <Typography variant="body2">
              TL cây thông sau đúc — Trả: <strong>{gram(slip.castTreeWeightGram)}</strong>
            </Typography>
            <Typography variant="body2">
              Bạc đã dùng: <strong>{gram(slip.silverUsedGram)}</strong>
            </Typography>
            <Typography variant="body2">
              Thạch cao đã dùng: <strong>{gram(slip.plasterUsedGram)}</strong>
            </Typography>
            {slip.leftoverGram != null ? (
              <Typography variant="body2">
                Bạc giao chưa dùng (trả kho): <strong>{gram(slip.leftoverGram)}</strong>
              </Typography>
            ) : null}
            {slip.castLossGram != null ? (
              <Typography
                variant="body2"
                sx={{ fontWeight: 700 }}
                color={Number(slip.castLossGram) < 0 ? 'error' : undefined}
              >
                Hao hụt đúc: {gram(slip.castLossGram)}
                {slip.castLossPercent != null ? ` (${slip.castLossPercent}%)` : ''}
              </Typography>
            ) : null}
            {resultThumbs.length ? <IntakeImageThumbs label="Ảnh cân cây thông sau đúc" images={resultThumbs} /> : null}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button variant="contained" disabled={saving || !slip} onClick={onConfirm}>
          {saving ? 'Đang xác nhận…' : 'Xác nhận'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
