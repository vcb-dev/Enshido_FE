import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useAppForm } from '../components/ui/form/useAppForm'
import type { IntakeOrder } from '../api/intakeOrders'
import type { OrderImage } from '../api/productionOrders'
import { formatQty, qtyFromApi } from '../api/inventory'
import { DialogForm, FormQtyField, FormTextField } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'
import { StoneSpecsFields, stoneSpecsOf, stoneSpecsPayload, type StoneSpecs } from './StoneSpecsFields'

type IntakeProductSpecsDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onSave: (payload: {
    productWeightGram: number
    castingTreeWeightGram?: number
    produceQty?: number
    images: OrderImage[]
    stoneCount3d?: number | null
    stoneWeight3dGram?: number | null
  }) => void
}

type Values = StoneSpecs & {
  waxWeight: string
  treeWeight: string
  produceQty: string
  images: OrderImage[]
}

function leftoverOf(order: IntakeOrder | null) {
  if (!order) return 0
  return order.remainingQty ?? Math.max(0, order.qty - (order.waxReleasedQty ?? 0))
}

function intQty(raw: string) {
  const value = raw.trim() ? Number(raw) : NaN
  if (!Number.isInteger(value) || value < 1) return null
  return value
}

function valuesOf(order: IntakeOrder | null): Values {
  return {
    waxWeight:
      order?.productWeightGram != null && order.productWeightGram !== ''
        ? qtyFromApi(String(order.productWeightGram))
        : '',
    treeWeight:
      order?.castingTreeWeightGram != null && order.castingTreeWeightGram !== ''
        ? qtyFromApi(String(order.castingTreeWeightGram))
        : '',
    produceQty: '',
    images: [],
    ...stoneSpecsOf(order),
  }
}

export function IntakeProductSpecsDialog({
  order,
  saving,
  onClose,
  onSave,
}: IntakeProductSpecsDialogProps) {
  const [uploading, setUploading] = useState(false)
  const form = useAppForm<Values>({ defaultValues: valuesOf(null) })

  useEffect(() => {
    if (order) form.reset(valuesOf(order))
  }, [order, form])

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {order?.hasMold ? 'Bơm sáp & cấy cây thông' : 'Cập nhật số liệu sáp'} — {order?.code ?? ''}
      </DialogTitle>
      <DialogForm
        form={form}
        onSubmit={({ waxWeight, treeWeight, produceQty, images, ...stone }) =>
          onSave({
            productWeightGram: Number(waxWeight),
            ...(order?.hasMold ? { castingTreeWeightGram: Number(treeWeight) } : {}),
            ...(order?.requestType === 'BULK' ? { produceQty: intQty(produceQty) ?? undefined } : {}),
            images,
            // Đơn cần 3D đã khai đá ở bước link 3D — không gửi lại để khỏi ghi đè.
            ...(order?.hasMold ? stoneSpecsPayload(stone) : {}),
          })
        }
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {order ? (
              <Typography variant="body2">
                {order.productName?.trim() || '—'}
                {order.qty ? ` · SL ${formatQty(String(order.qty))}` : null}
                {order.requestType === 'BULK' && (order.waxReleasedQty ?? 0) > 0
                  ? ` · đã in sáp ${order.waxReleasedQty}`
                  : null}
              </Typography>
            ) : null}
            {order?.requestType === 'BULK' ? (
              <FormTextField<Values>
                name="produceQty"
                label={`Số đơn SX lần này (tổng ${order.qty})`}
                required
                transform={(value) => value.replace(/\D/g, '')}
                rules={{
                  validate: (value) => {
                    const leftover = leftoverOf(order)
                    const qty = intQty(String(value ?? ''))
                    if (qty == null) return 'Nhập số đơn SX lần này'
                    if (qty > leftover) return `Không vượt số còn lại (${leftover})`
                    return true
                  },
                }}
                helperText={
                  leftoverOf(order) < order.qty
                    ? `Còn ${leftoverOf(order)}/${order.qty} chưa in sáp. Nhập ít hơn tổng nếu đây là lô bổ sung.`
                    : `Còn ${leftoverOf(order)}/${order.qty}. Nhập ít hơn tổng nếu chỉ in một phần.`
                }
                size="small"
                fullWidth
                disabled={saving || uploading}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              />
            ) : null}
            <FormQtyField<Values>
              name="waxWeight"
              label="Trọng lượng sáp (g)"
              required
              rules={{ validate: (value) => (Number(value) > 0 ? true : 'Nhập trọng lượng sáp (gram)') }}
              helperText="VD: 1.250,5"
              size="small"
              fullWidth
              disabled={saving || uploading}
            />
            {order?.hasMold ? (
              <FormQtyField<Values>
                name="treeWeight"
                label="Trọng lượng cây thông (g)"
                required
                rules={{ validate: (value) => (Number(value) > 0 ? true : 'Nhập trọng lượng cây thông (gram)') }}
                helperText="VD: 1.250,5"
                size="small"
                fullWidth
                disabled={saving || uploading}
              />
            ) : null}
            {order?.hasMold ? <StoneSpecsFields disabled={saving || uploading} /> : null}
            <FormImageField<Values>
              name="images"
              label={order?.hasMold ? 'Ảnh sáp / cây thông' : 'Ảnh sản phẩm / sáp'}
              kind="PRODUCT"
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
