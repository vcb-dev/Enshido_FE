import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useForm } from 'react-hook-form'
import type { IntakeOrder } from '../api/intakeOrders'
import type { OrderImage } from '../api/productionOrders'
import { formatQty, qtyFromApi } from '../api/inventory'
import { DialogForm, FormQtyField } from '../components/ui'
import { confirmWeights, ratioWarning } from '../orders/weightSanity'
import { FormImageField } from '../orders/FormImageField'

type IntakeCastingTreeDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onSave: (payload: { castingTreeWeightGram: number; images: OrderImage[] }) => void
}

type Values = { weight: string; images: OrderImage[] }

export function IntakeCastingTreeDialog({
  order,
  saving,
  onClose,
  onSave,
}: IntakeCastingTreeDialogProps) {
  const [uploading, setUploading] = useState(false)
  const form = useForm<Values>({ defaultValues: { weight: '', images: [] } })

  useEffect(() => {
    if (order) {
      form.reset({
        weight:
          order.castingTreeWeightGram != null && order.castingTreeWeightGram !== ''
            ? qtyFromApi(String(order.castingTreeWeightGram))
            : '',
        images: [],
      })
    }
  }, [order, form])

  async function submit({ weight, images }: Values) {
    const grams = Number(weight)
    // Cây thông = mẫu sáp in ở bước 4 + ống rót: nặng hơn mẫu nhưng không lệch cả trăm lần.
    const printed = Number(order?.productWeightGram ?? 0)
    if (
      !(await confirmWeights([
        ratioWarning(grams, 'Cây thông', printed, 'mẫu sáp đã in', { min: 0.5, max: 100 }),
      ]))
    ) {
      return
    }
    onSave({ castingTreeWeightGram: grams, images })
  }

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cập nhật số liệu cây thông — {order?.code ?? ''}</DialogTitle>
      <DialogForm form={form} onSubmit={submit}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {order ? (
              <Typography variant="body2">
                {order.productName?.trim() || '—'}
                {order.qty ? ` · SL ${formatQty(String(order.qty))}` : null}
              </Typography>
            ) : null}
            <FormQtyField<Values>
              name="weight"
              label="Cân nặng sản phẩm (g)"
              required
              rules={{ validate: (value) => (Number(value) > 0 ? true : 'Nhập cân nặng sản phẩm (gram)') }}
              helperText="VD: 1.250,5"
              size="small"
              fullWidth
              disabled={saving || uploading}
            />
            <FormImageField<Values>
              name="images"
              label="Ảnh cây thông"
              kind="CASTING_TREE"
              required
              onUploadingChange={setUploading}
              readOnly={saving}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving || uploading}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={saving || uploading || !order}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
