import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import type { IntakeOrder } from '../api/intakeOrders'
import { formatQty, parseQtyInput } from '../api/inventory'
import { confirmWeights, ratioWarning } from '../orders/weightSanity'
import { QtyTextField } from '../components/ui/QtyTextField'

/**
 * Bước 5–6: thợ sáp mang sáp ra, thủ kho cân kiểm và xác nhận → Chờ SX · Đã có Sáp (E).
 * Đơn bơm sáp (có khuôn) bắt buộc nhập số cân kiểm; đơn in resin để trống được.
 */
export function WarehouseConfirmDialog({
  order,
  saving,
  onClose,
  onConfirm,
}: {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onConfirm: (checkedWeightGram: number | undefined) => void
}) {
  const [weight, setWeight] = useState('')
  const [error, setError] = useState('')
  const required = order?.hasMold === true
  const declared = order?.castingTreeWeightGram ?? order?.productWeightGram ?? null

  useEffect(() => {
    // Không điền sẵn số của thợ: thủ kho phải tự cân.
    setWeight('')
    setError('')
  }, [order])

  function submit() {
    const raw = weight.trim()
    if (!raw) {
      if (required) return setError('Cân kiểm và nhập trọng lượng sáp')
      return onConfirm(undefined)
    }
    const parsed = parseQtyInput(raw)
    const grams = parsed ? Number(parsed) : NaN
    if (!Number.isFinite(grams) || grams <= 0) return setError('Trọng lượng không hợp lệ')
    if (
      !confirmWeights([
        ratioWarning(grams, 'Cân kiểm', Number(declared ?? 0), 'số thợ báo', { min: 0.5, max: 2 }),
      ])
    ) {
      return
    }
    onConfirm(grams)
  }

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Thủ kho xác nhận sáp — {order?.code ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2">
            Thợ sáp báo: <strong>{declared ? `${formatQty(declared)} g` : '—'}</strong>
          </Typography>
          <QtyTextField
            label="Cân kiểm (g)"
            value={weight}
            onChange={(next) => {
              setWeight(next)
              setError('')
            }}
            required={required}
            error={Boolean(error)}
            helperText={error || (required ? 'Bắt buộc với đơn bơm sáp' : 'Để trống nếu khớp số thợ báo')}
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
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? 'Đang xác nhận…' : 'Xác nhận đã có sáp'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
