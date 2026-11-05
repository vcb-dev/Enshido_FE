import { useEffect } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { useAppForm } from '../components/ui/form/useAppForm'
import type { IntakeOrder } from '../api/intakeOrders'
import { formatQty, qtyFromApi } from '../api/inventory'
import { DialogForm, FormQtyField } from '../components/ui'

type IntakeWaxWeightDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onSave: (payload: { productWeightGram: number }) => void
}

type Values = { waxWeight: string }

function enteredQtyOf(order: IntakeOrder | null) {
  if (!order) return 0
  if (order.requestType === 'BULK') return order.waxReleasedQty || order.qty
  return order.qty
}

function valuesOf(order: IntakeOrder | null): Values {
  const wax = order?.productWeightGram
  return { waxWeight: wax != null && wax !== '' ? qtyFromApi(String(wax)) : '' }
}

/** Sửa TL sáp các lô đã tách / đã lên đúc — hiện SL + TL cũ, chỉ cho đổi TL. */
export function IntakeWaxWeightDialog({ order, saving, onClose, onSave }: IntakeWaxWeightDialogProps) {
  const form = useAppForm<Values>({ defaultValues: valuesOf(null) })
  const enteredQty = enteredQtyOf(order)

  useEffect(() => {
    if (order) form.reset(valuesOf(order))
  }, [order, form])

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Sửa TL sáp — {order?.code ?? ''}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={({ waxWeight }) => onSave({ productWeightGram: Number(waxWeight) })}
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {order ? (
              <Typography variant="body2">
                {order.productName?.trim() || '—'}
                {order.qty ? ` · SL ${formatQty(String(order.qty))}` : null}
              </Typography>
            ) : null}
            <TextField
              label="Số đơn SX đã nhập"
              value={enteredQty > 0 ? formatQty(String(enteredQty)) : ''}
              size="small"
              fullWidth
              disabled
              helperText="Không đổi số lượng — chỉ sửa trọng lượng sáp"
            />
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={saving || !order}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
