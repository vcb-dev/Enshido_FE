import { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material'
import type { IntakeOrder } from '../api/intakeOrders'

type ApproveIntakeDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onConfirm: (hasMold: boolean) => void
}

export function ApproveIntakeDialog({ order, saving, onClose, onConfirm }: ApproveIntakeDialogProps) {
  const [hasMold, setHasMold] = useState(false)

  useEffect(() => {
    if (order) setHasMold(false)
  }, [order])

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Duyệt đơn {order?.code ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Xác nhận chuyển đơn từ <strong>Chờ duyệt</strong> sang{' '}
            <strong>Đã duyệt · Chờ sản xuất</strong>.
          </Typography>
          {order ? (
            <Typography variant="body2">
              Sản phẩm: <strong>{order.productName?.trim() || '—'}</strong>
              {order.qty ? ` · SL ${order.qty}` : null}
            </Typography>
          ) : null}
          <FormControlLabel
            control={
              <Checkbox
                checked={hasMold}
                onChange={(_, checked) => setHasMold(checked)}
                disabled={saving}
              />
            }
            label="Đã có khuôn"
          />
          <Typography variant="body2" color="text.secondary">
            {hasMold
              ? 'Có khuôn — bỏ qua bước vẽ 3D in resin khi lên lệnh sản xuất.'
              : 'Chưa có khuôn (mặc định) — cần vẽ 3D để in resin trước khi đúc.'}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button variant="contained" disabled={saving || !order} onClick={() => onConfirm(hasMold)}>
          {saving ? 'Đang duyệt…' : 'Xác nhận duyệt'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
