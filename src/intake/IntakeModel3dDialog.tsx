import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useAppForm } from '../components/ui/form/useAppForm'
import type { IntakeOrder } from '../api/intakeOrders'
import type { OrderImage } from '../api/productionOrders'
import { DialogForm, FormTextField } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'
import { StoneSpecsFields, stoneSpecsOf, stoneSpecsPayload, type StoneSpecs } from './StoneSpecsFields'

type IntakeModel3dDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onSave: (payload: {
    model3dUrl: string
    images: OrderImage[]
    stoneCount3d: number | null
    stoneWeight3dGram: number | null
  }) => void
}

type Values = StoneSpecs & { model3dUrl: string; images: OrderImage[] }

function valuesOf(order: IntakeOrder | null): Values {
  return { model3dUrl: order?.model3dUrl?.trim() ?? '', images: [], ...stoneSpecsOf(order) }
}

export function IntakeModel3dDialog({ order, saving, onClose, onSave }: IntakeModel3dDialogProps) {
  const [uploading, setUploading] = useState(false)
  const form = useAppForm<Values>({ defaultValues: valuesOf(null) })

  useEffect(() => {
    if (order) form.reset(valuesOf(order))
  }, [order, form])

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cập nhật đơn {order?.code ?? ''}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={({ model3dUrl, images, ...stone }) =>
          onSave({ model3dUrl: model3dUrl.trim(), images, ...stoneSpecsPayload(stone) })
        }
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
              rules={{ validate: (value) => (String(value).trim() ? true : 'Nhập link file 3D') }}
              helperText="VD: link Drive, Cloudinary hoặc kho file nội bộ"
              size="small"
              fullWidth
              disabled={saving}
              placeholder="https://…"
            />
            {/* Thủ kho xem ảnh này lúc giao Vào đá để biết vị trí, cỡ đá trên mẫu. */}
            <FormImageField<Values>
              name="images"
              label="Ảnh file 3D"
              kind="MODEL_3D"
              required
              requiredMessage="Thêm ít nhất một ảnh chụp file 3D (tải file hoặc Ctrl+V)"
              onUploadingChange={setUploading}
              readOnly={saving}
            />
            <StoneSpecsFields disabled={saving} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving || uploading}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={saving || uploading || !order}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
