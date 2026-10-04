import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useForm } from 'react-hook-form'
import type { CastingSlip, CastingSlipImage } from '../api/castingSlips'
import type { OrderImage } from '../api/productionOrders'
import { DialogForm } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'

type Values = { images: OrderImage[] }

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
  const [uploading, setUploading] = useState(false)
  const form = useForm<Values>({ defaultValues: { images: [] } })

  useEffect(() => {
    form.reset({ images: [] })
  }, [slip, form])

  const busy = saving || uploading
  return (
    <Dialog open={Boolean(slip)} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cấp vật tư — phiếu {slip?.code ?? ''}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={({ images }) =>
          onSave(images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height })))
        }
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Chụp ảnh phiếu đúc và vật tư đã cấp.
            </Typography>
            <FormImageField<Values>
              name="images"
              label="Ảnh phiếu đúc và vật tư"
              kind="CASTING_TREE"
              required
              requiredMessage="Chụp ảnh phiếu đúc và vật tư kèm theo"
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
            {saving ? 'Đang lưu…' : 'Lưu — chuyển Chờ đúc'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
