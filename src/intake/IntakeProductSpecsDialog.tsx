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
import type { IntakeOrder } from '../api/intakeOrders'
import type { OrderImage } from '../api/productionOrders'
import { formatQty, parseQtyInput, qtyFromApi } from '../api/inventory'
import { QtyTextField } from '../components/ui/QtyTextField'
import { ImageUploadField } from '../orders/ImageUploadField'

type IntakeProductSpecsDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onSave: (payload: { productWeightGram: number; images: OrderImage[] }) => void
}

export function IntakeProductSpecsDialog({
  order,
  saving,
  onClose,
  onSave,
}: IntakeProductSpecsDialogProps) {
  const [weight, setWeight] = useState('')
  const [images, setImages] = useState<OrderImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [weightError, setWeightError] = useState('')
  const [imagesError, setImagesError] = useState('')

  useEffect(() => {
    if (order) {
      setWeight(
        order.productWeightGram != null && order.productWeightGram !== ''
          ? qtyFromApi(String(order.productWeightGram))
          : '',
      )
      setImages([])
      setWeightError('')
      setImagesError('')
    }
  }, [order])

  function submit() {
    const parsed = parseQtyInput(weight.trim())
    const grams = parsed ? Number(parsed) : NaN
    if (!parsed || !Number.isFinite(grams) || grams <= 0) {
      setWeightError('Nhập cân nặng sản phẩm (gram)')
      return
    }
    if (!images.length) {
      setImagesError('Thêm ít nhất một ảnh (tải file hoặc Ctrl+V)')
      return
    }
    setWeightError('')
    setImagesError('')
    onSave({ productWeightGram: grams, images })
  }

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cập nhật số liệu sản phẩm — {order?.code ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {order?.hasMold ? (
              <>
                Đơn đã có khuôn — nhập cân nặng và ảnh sản phẩm. Khi lưu, đơn chuyển sang{' '}
                <strong>Chờ thủ kho xác nhận</strong>.
              </>
            ) : (
              <>
                Nhập cân nặng và ảnh sau in sáp. Khi lưu, đơn chuyển sang{' '}
                <strong>Chờ sản xuất · Đã in sáp</strong>.
              </>
            )}
          </Typography>
          {order ? (
            <Typography variant="body2">
              {order.productName?.trim() || '—'}
              {order.qty ? ` · SL ${formatQty(String(order.qty))}` : null}
            </Typography>
          ) : null}
          <QtyTextField
            label="Cân nặng sản phẩm (g)"
            value={weight}
            onChange={(next) => {
              setWeight(next)
              if (next.trim()) setWeightError('')
            }}
            required
            error={Boolean(weightError)}
            helperText={weightError || 'VD: 1.250,5'}
            size="small"
            fullWidth
            disabled={saving || uploading}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
          <Stack spacing={0.5}>
            <ImageUploadField
              label={order?.hasMold ? 'Ảnh sản phẩm' : 'Ảnh sản phẩm / sáp'}
              kind="PRODUCT"
              value={images}
              onChange={(next) => {
                setImages(next)
                if (next.length) setImagesError('')
              }}
              onUploadingChange={setUploading}
              readOnly={saving}
            />
            {imagesError ? (
              <Typography variant="caption" color="error">
                {imagesError}
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving || uploading}>
          Hủy
        </Button>
        <Button
          variant="contained"
          disabled={saving || uploading || !order}
          onClick={submit}
        >
          {saving ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
