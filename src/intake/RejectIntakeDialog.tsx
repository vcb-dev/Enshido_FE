import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import type { IntakeOrder } from '../api/intakeOrders'

type RejectIntakeDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function RejectIntakeDialog({ order, saving, onClose, onConfirm }: RejectIntakeDialogProps) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (order) setReason('')
  }, [order])

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Từ chối đơn {order?.code ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Đơn sẽ chuyển sang trạng thái <strong>Từ chối</strong> và không còn trong hàng chờ duyệt.
          </Typography>
          {order ? (
            <Typography variant="body2">
              Sản phẩm: <strong>{order.productName?.trim() || '—'}</strong>
            </Typography>
          ) : null}
          <TextField
            label="Lý do từ chối"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
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
          variant="contained"
          color="error"
          disabled={saving || !order}
          onClick={() => onConfirm(reason.trim())}
        >
          {saving ? 'Đang xử lý…' : 'Xác nhận từ chối'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
