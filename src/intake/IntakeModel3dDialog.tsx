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

type IntakeModel3dDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onSave: (model3dUrl: string) => void
}

export function IntakeModel3dDialog({ order, saving, onClose, onSave }: IntakeModel3dDialogProps) {
  const [model3dUrl, setModel3dUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (order) {
      setModel3dUrl(order.model3dUrl?.trim() ?? '')
      setError('')
    }
  }, [order])

  function submit() {
    const value = model3dUrl.trim()
    if (!value) {
      setError('Nhập link file 3D')
      return
    }
    setError('')
    onSave(value)
  }

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cập nhật đơn {order?.code ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Dán link file 3D. Khi lưu, đơn chuyển sang{' '}
            <strong>Chờ SX · Đã có 3D / khuôn (C)</strong>.
          </Typography>
          {order ? (
            <Typography variant="body2">
              {order.productName?.trim() || '—'}
              {order.hasMold === true ? ' · Đã có khuôn' : null}
              {order.hasMold === false ? ' · Cần 3D in resin' : null}
            </Typography>
          ) : null}
          <TextField
            label="Link file 3D"
            value={model3dUrl}
            onChange={(event) => {
              setModel3dUrl(event.target.value)
              if (event.target.value.trim()) setError('')
            }}
            required
            error={Boolean(error)}
            helperText={error || 'VD: link Drive, Cloudinary hoặc kho file nội bộ'}
            size="small"
            fullWidth
            disabled={saving}
            placeholder="https://…"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button variant="contained" disabled={saving || !order} onClick={submit}>
          {saving ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
