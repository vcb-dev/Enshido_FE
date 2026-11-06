import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useAppForm } from '../components/ui/form/useAppForm'
import { getIntakeWaxImagesApi, type IntakeOrder } from '../api/intakeOrders'
import type { OrderImage } from '../api/productionOrders'
import { formatQty, qtyFromApi } from '../api/inventory'
import { DialogForm, FormQtyField } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'
import { intakeShowsWaxQty, intakeWaxEnteredQty } from './intakeActions'

type IntakeWaxWeightDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onSave: (payload: { productWeightGram: number; images: OrderImage[] }) => void
}

type Values = { waxWeight: string; images: OrderImage[] }

function valuesOf(order: IntakeOrder | null, images: OrderImage[]): Values {
  const wax = order?.productWeightGram
  return { waxWeight: wax != null && wax !== '' ? qtyFromApi(String(wax)) : '', images }
}

/** Sửa TL sáp + ảnh sáp các lô đã tách / đã lên đúc — hiện SL + TL, ảnh cũ; không đổi SL. */
export function IntakeWaxWeightDialog({ order, saving, onClose, onSave }: IntakeWaxWeightDialogProps) {
  const [uploading, setUploading] = useState(false)
  const form = useAppForm<Values>({ defaultValues: valuesOf(null, []) })
  const showQty = order ? intakeShowsWaxQty(order) : false
  const enteredQty = order ? intakeWaxEnteredQty(order) : 0
  const splitLots = (order?.waxReleasedQty ?? 0) > 0

  const waxImages = useQuery({
    queryKey: ['intake-orders', 'wax-images', order?.id],
    queryFn: () => getIntakeWaxImagesApi(order!.id),
    enabled: Boolean(order),
    staleTime: 0,
  })
  const loaded = waxImages.isSuccess

  useEffect(() => {
    if (order && waxImages.data) form.reset(valuesOf(order, waxImages.data.items))
  }, [order, waxImages.data, form])

  const busy = saving || uploading || !loaded

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Sửa TL / ảnh sáp — {order?.code ?? ''}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={({ waxWeight, images }) => onSave({ productWeightGram: Number(waxWeight), images })}
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {order ? (
              <Typography variant="body2">
                {order.productName?.trim() || '—'}
                {order.qty ? ` · SL ${formatQty(String(order.qty))}` : null}
              </Typography>
            ) : null}
            {showQty ? (
              <TextField
                label="Số lượng"
                value={enteredQty > 0 ? formatQty(String(enteredQty)) : ''}
                size="small"
                fullWidth
                disabled
                helperText="Không đổi số lượng — chỉ sửa trọng lượng và ảnh sáp"
              />
            ) : null}
            <FormQtyField<Values>
              name="waxWeight"
              label="Trọng lượng sáp (g)"
              required
              rules={{ validate: (value) => (Number(value) > 0 ? true : 'Nhập trọng lượng sáp (gram)') }}
              helperText="VD: 1.250,5 — số đang hiện là TL sáp đã nhập"
              size="small"
              fullWidth
              disabled={saving}
            />
            {waxImages.isError ? (
              <Alert severity="error">
                Không tải được ảnh sáp hiện có — {(waxImages.error as Error).message}
              </Alert>
            ) : !loaded ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Đang tải ảnh sáp…
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={0.5}>
                <FormImageField<Values>
                  name="images"
                  label={order?.hasMold ? 'Ảnh sáp' : 'Ảnh sản phẩm / sáp'}
                  kind="PRODUCT"
                  required
                  onUploadingChange={setUploading}
                  readOnly={saving}
                />
                <Typography variant="caption" color="text.secondary">
                  Xoá ảnh sai, thêm ảnh mới (tải file hoặc Ctrl+V).
                  {splitLots ? ' Đơn đã tách lô — bộ ảnh này lưu cho mọi lô.' : ''}
                </Typography>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving || uploading}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !order}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
