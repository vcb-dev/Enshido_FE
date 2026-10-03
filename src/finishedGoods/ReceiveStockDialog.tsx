import { useEffect } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import { DialogForm, FormTextField } from '../components/ui'
import type { FinishedGoodsReceiptRow } from '../api/finishedGoods'

type Values = { qty: string }

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
  const pending = row?.pendingQty ?? 0
  const unit = row?.qtyUnit ?? 'sản phẩm'
  // Kiểm ngay khi gõ để nút Nhập kho khoá lúc số không hợp lệ.
  const form = useForm<Values>({ mode: 'onChange', defaultValues: { qty: '' } })

  useEffect(() => {
    if (row) form.reset({ qty: String(row.pendingQty) })
  }, [row, form])

  const qty = useWatch({ control: form.control, name: 'qty' })
  const value = Number(qty)
  const error = qtyError(qty, pending, unit)
  const leftover = error ? 0 : pending - value

  return (
    <Dialog open={row != null} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Nhập kho thành phẩm — {row?.orderCode}</DialogTitle>
      <DialogForm form={form} onSubmit={(values) => onConfirm(Number(values.qty))}>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Stack spacing={1.25}>
            <Typography variant="body2" color="text.secondary">
              Đếm hàng thực nhận rồi xác nhận. Chỉ số nhập ở đây mới được cộng vào tồn.
            </Typography>
            <FormTextField<Values>
              name="qty"
              label={`Số lượng nhận (${unit})`}
              type="number"
              transform={(next) => next.replace(/[^\d]/g, '')}
              rules={{ validate: (next) => qtyError(next, pending, unit) ?? true }}
              slotProps={{ htmlInput: { min: 1, max: pending, step: 1 } }}
              helperText={`Đang chờ ${pending} ${unit}`}
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
          <Button type="submit" variant="contained" color="success" disabled={error != null} loading={saving}>
            Nhập kho
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}

function qtyError(qty: string, pending: number, unit: string) {
  const value = Number(qty)
  if (qty === '' || !Number.isInteger(value) || value < 1) return 'Nhập số lượng từ 1'
  if (value > pending) return `Phiếu chỉ còn ${pending} ${unit} đang chờ`
  return null
}
