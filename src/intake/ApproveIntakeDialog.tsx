import { useEffect } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import type { IntakeOrder } from '../api/intakeOrders'
import { DialogForm, FormCheckbox } from '../components/ui'

type Values = { hasMold: boolean }

type ApproveIntakeDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onConfirm: (hasMold: boolean) => void
}

export function ApproveIntakeDialog({ order, saving, onClose, onConfirm }: ApproveIntakeDialogProps) {
  const form = useForm<Values>({ defaultValues: { hasMold: false } })
  const hasMold = useWatch({ control: form.control, name: 'hasMold' })

  useEffect(() => {
    if (order) form.reset({ hasMold: false })
  }, [order, form])

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Duyệt đơn {order?.code ?? ''}</DialogTitle>
      <DialogForm form={form} onSubmit={(values) => onConfirm(values.hasMold)}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {order ? (
              <Typography variant="body2">
                Sản phẩm: <strong>{order.productName?.trim() || '—'}</strong>
                {order.qty ? ` · SL ${order.qty}` : null}
              </Typography>
            ) : null}
            <FormCheckbox<Values> name="hasMold" label="Đã có khuôn" disabled={saving} />
            <Typography variant="body2" color="text.secondary">
              {hasMold ? 'Bỏ qua bước 3D.' : 'Cần vẽ 3D trước khi đúc.'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={saving || !order}>
            {saving ? 'Đang duyệt…' : 'Xác nhận duyệt'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
