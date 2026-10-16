import { useEffect } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useForm } from 'react-hook-form'
import type { IntakeOrder } from '../api/intakeOrders'
import { DialogForm, FormTextField } from '../components/ui'

type Values = { reason: string }

type RejectIntakeDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function RejectIntakeDialog({ order, saving, onClose, onConfirm }: RejectIntakeDialogProps) {
  const form = useForm<Values>({ defaultValues: { reason: '' } })

  useEffect(() => {
    if (order) form.reset({ reason: '' })
  }, [order, form])

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Từ chối đơn {order?.code ?? ''}</DialogTitle>
      <DialogForm form={form} onSubmit={(values) => onConfirm(values.reason.trim())}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {order ? (
              <Typography variant="body2">
                Sản phẩm: <strong>{order.productName?.trim() || '—'}</strong>
              </Typography>
            ) : null}
            <FormTextField<Values>
              name="reason"
              label="Lý do từ chối"
              multiline
              minRows={2}
              maxRows={5}
              size="small"
              fullWidth
              disabled={saving}
              placeholder="Tuỳ chọn — ghi rõ lý do để tra cứu sau"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="error"
            disabled={saving || !order}
          >
            {saving ? 'Đang xử lý…' : 'Xác nhận từ chối'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
