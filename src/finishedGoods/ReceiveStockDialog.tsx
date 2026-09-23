import { useEffect, useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { TextInput } from '../components/ui'
import type { FinishedGoodsReceiptRow } from '../api/finishedGoods'

/**
 * Kho đếm hàng rồi mới cho vào tồn. Mặc định nhận hết phần đang chờ, nhưng đếm thiếu thì
 * sửa xuống — phần còn lại vẫn nằm chờ trên phiếu, hôm sau nhận nốt.
 */
export function ReceiveStockDialog({
  row,
  saving,
  onClose,
  onConfirm,
}: {
  row: FinishedGoodsReceiptRow | null
  saving: boolean
  onClose: () => void
  onConfirm: (qty: number) => void
}) {
  const [qty, setQty] = useState('')
  const pending = row?.pendingQty ?? 0
  const unit = row?.qtyUnit ?? 'sản phẩm'

  useEffect(() => {
    if (row) setQty(String(row.pendingQty))
  }, [row])

  const value = Number(qty)
  const error =
    qty === '' || !Number.isInteger(value) || value < 1
      ? 'Nhập số lượng từ 1'
      : value > pending
        ? `Phiếu chỉ còn ${pending} ${unit} đang chờ`
        : null
  const leftover = error ? 0 : pending - value

  return (
    <Dialog open={row != null} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Nhập kho thành phẩm — {row?.orderCode}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack spacing={1.25}>
          <Typography variant="body2" color="text.secondary">
            Đếm hàng thực nhận rồi xác nhận. Chỉ số nhập ở đây mới được cộng vào tồn.
          </Typography>
          <TextInput
            label={`Số lượng nhận (${unit})`}
            type="number"
            value={qty}
            onChange={(event) => setQty(event.target.value.replace(/[^\d]/g, ''))}
            slotProps={{ htmlInput: { min: 1, max: pending, step: 1 } }}
            helperText={`Đang chờ ${pending} ${unit}`}
            errorText={error ?? undefined}
            autoFocus
          />
          {leftover > 0 ? (
            <Alert severity="info" sx={{ py: 0.25 }}>
              Còn {leftover} {unit} vẫn nằm chờ trên phiếu — nhận nốt khi hàng về.
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={error != null}
          loading={saving}
          onClick={() => onConfirm(value)}
        >
          Nhập kho
        </Button>
      </DialogActions>
    </Dialog>
  )
}
