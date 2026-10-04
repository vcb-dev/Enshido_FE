import { useEffect } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useForm } from 'react-hook-form'
import type { IntakeOrder } from '../api/intakeOrders'
import { DialogForm, FormTextField } from '../components/ui'
import { StoneSpecsFields, stoneSpecsOf, stoneSpecsPayload, type StoneSpecs } from './StoneSpecsFields'

type IntakeModel3dDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onSave: (payload: { model3dUrl: string; stoneCount3d: number | null; stoneWeight3dGram: number | null }) => void
}

type Values = StoneSpecs & { model3dUrl: string }

function valuesOf(order: IntakeOrder | null): Values {
  return { model3dUrl: order?.model3dUrl?.trim() ?? '', ...stoneSpecsOf(order) }
}

export function IntakeModel3dDialog({ order, saving, onClose, onSave }: IntakeModel3dDialogProps) {
  const form = useForm<Values>({ defaultValues: valuesOf(null) })

  useEffect(() => {
    if (order) form.reset(valuesOf(order))
  }, [order, form])

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cập nhật đơn {order?.code ?? ''}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={({ model3dUrl, ...stone }) => onSave({ model3dUrl: model3dUrl.trim(), ...stoneSpecsPayload(stone) })}
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {order ? (
              <Typography variant="body2">
                {order.productName?.trim() || '—'}
                {order.hasMold === true ? ' · Đã có khuôn' : null}
                {order.hasMold === false ? ' · Cần 3D in resin' : null}
              </Typography>
            ) : null}
            <FormTextField<Values>
              name="model3dUrl"
              label="Link file 3D"
              required
              rules={{ validate: (value) => (value.trim() ? true : 'Nhập link file 3D') }}
              helperText="VD: link Drive, Cloudinary hoặc kho file nội bộ"
              size="small"
              fullWidth
              disabled={saving}
              placeholder="https://…"
            />
            <StoneSpecsFields disabled={saving} />
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
