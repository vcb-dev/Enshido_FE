import { useEffect } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useAppForm } from '../components/ui/form/useAppForm'
import type { IntakeOrder } from '../api/intakeOrders'
import { qtyFromApi } from '../api/inventory'
import { DialogForm, FormQtyField } from '../components/ui'

type IntakeWaxWeightDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onSave: (payload: { productWeightGram: number }) => void
}

type Values = { waxWeight: string }

function valuesOf(order: IntakeOrder | null): Values {
  const wax = order?.productWeightGram
  return { waxWeight: wax != null && wax !== '' ? qtyFromApi(String(wax)) : '' }
}

/** Sửa TL sáp đã báo — chỉ mở khi bước sau chưa dùng số liệu (`intakeCanEditWaxWeight`). */
export function IntakeWaxWeightDialog({ order, saving, onClose, onSave }: IntakeWaxWeightDialogProps) {
  const form = useAppForm<Values>({ defaultValues: valuesOf(null) })

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
              <Typography variant="body2" color="text.secondary">
                {order.productName?.trim() || '—'}
                {order.status === 'WAX_PRINTED' ? ' · sửa được đến khi cấy cây thông' : ' · sửa được đến khi lên phiếu đúc'}
              </Typography>
            ) : null}
            <FormQtyField<Values>
              name="waxWeight"
              label="Trọng lượng sáp (g)"
              required
              rules={{ validate: (value) => (Number(value) > 0 ? true : 'Nhập trọng lượng sáp (gram)') }}
              helperText="VD: 1.250,5"
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
