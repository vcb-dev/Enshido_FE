import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import type { IntakeOrder } from '../api/intakeOrders'
import { formatQty } from '../api/inventory'

/** Bước 5–6: thủ kho xác nhận đã nhận sáp → Chờ SX · Đã có Sáp (E). */
export function WarehouseConfirmDialog({
  order,
  saving,
  onClose,
  onConfirm,
}: {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const declared = order?.castingTreeWeightGram ?? order?.productWeightGram ?? null

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Thủ kho xác nhận sáp — {order?.code ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Xác nhận đã kiểm và nhận sáp từ thợ sáp. Đơn chuyển sang trạng thái <strong>Đã có sáp</strong>.
          </Typography>
          <Typography variant="body2">
            Thợ sáp báo: <strong>{declared ? `${formatQty(declared)} g` : '—'}</strong>
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button variant="contained" onClick={onConfirm} disabled={saving}>
          {saving ? 'Đang xác nhận…' : 'Xác nhận đã có sáp'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
