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
  onSave: (payload: { productWeightGram: number; castingTreeWeightGram?: number }) => void
}

type Values = { waxWeight: string; treeWeight: string }

const gramOf = (value: string | number | null | undefined) =>
  value != null && value !== '' ? qtyFromApi(String(value)) : ''

function valuesOf(order: IntakeOrder | null): Values {
  return { waxWeight: gramOf(order?.productWeightGram), treeWeight: gramOf(order?.castingTreeWeightGram) }
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
        onSubmit={({ waxWeight, treeWeight }) =>
          onSave({
            productWeightGram: Number(waxWeight),
            ...(order?.hasMold ? { castingTreeWeightGram: Number(treeWeight) } : {}),
          })
        }
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {order ? (
              <Typography variant="body2" color="text.secondary">
                {order.productName?.trim() || '—'}
                {order.hasMold ? ' · sửa được đến khi thủ kho xác nhận' : ' · sửa được đến khi cấy cây thông'}
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
            {order?.hasMold ? (
              <FormQtyField<Values>
                name="treeWeight"
                label="Trọng lượng cây thông (g)"
                required
                rules={{ validate: (value) => (Number(value) > 0 ? true : 'Nhập trọng lượng cây thông (gram)') }}
                helperText="VD: 1.250,5"
                size="small"
                fullWidth
                disabled={saving}
              />
            ) : null}
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
