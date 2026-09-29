import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import type { CastingSlip, CastingSlipImage } from '../api/castingSlips'
import type { OrderImage } from '../api/productionOrders'
import { ImageUploadField } from '../orders/ImageUploadField'

/**
 * Bước 7b: phiếu đã in, vật tư (sáp + bạc + hội) đã cấp theo phiếu — thủ kho chụp ảnh phiếu đúc
 * và vật tư kèm theo, Lưu → mọi đơn trên phiếu sang Chờ đúc (F).
 */
export function CastingSlipIssueDialog({
  slip,
  saving,
  onClose,
  onSave,
}: {
  slip: CastingSlip | null
  saving: boolean
  onClose: () => void
  onSave: (images: CastingSlipImage[]) => void
}) {
  const [images, setImages] = useState<OrderImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setImages([])
    setError('')
  }, [slip])

  function submit() {
    if (!images.length) return setError('Chụp ảnh phiếu đúc và vật tư kèm theo')
    onSave(images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height })))
  }

  const busy = saving || uploading
  return (
    <Dialog open={Boolean(slip)} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cấp vật tư — phiếu {slip?.code ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Cấp sáp (cây thông) + bạc + hội theo phiếu đã in, chụp ảnh <strong>phiếu đúc và vật tư kèm theo</strong>.
            Lưu xong {slip?.orders.length ?? 0} đơn trên phiếu sang <strong>Chờ đúc</strong>.
          </Typography>
          <ImageUploadField
            label="Ảnh phiếu đúc và vật tư"
            kind="CASTING_TREE"
            value={images}
            onChange={(next) => {
              setImages(next)
              if (next.length) setError('')
            }}
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
          {saving ? 'Đang lưu…' : 'Lưu — chuyển Chờ đúc'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
