import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import type { CastingSlip, CastingSlipImage } from '../api/castingSlips'
import type { OrderImage } from '../api/productionOrders'
import { DialogForm } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'
import { CastingSlipMetalFormTable } from './CastingSlipMetalTable'
import { silverEstimateFromWax } from './castingEstimate'

type Values = { s999: string; hoi: string; s925: string; images: OrderImage[] }

function optionalGram(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

/**
 * Bước 7b: phiếu đã in — thủ kho nhập thực xuất (để trống = lấy ước tính), chụp ảnh, Lưu → Chờ đúc.
 */
export function CastingSlipIssueDialog({
  slip,
  saving,
  onClose,
  onSave,
}: {
  slip: CastingSlip | null
  saving: boolean
  onClose: () => void
  onSave: (payload: {
    images: CastingSlipImage[]
    issueS999Gram?: number
    issueMasterAlloyGram?: number
    issueS925Gram?: number
  }) => void
}) {
  const [uploading, setUploading] = useState(false)
  const form = useForm<Values>({ defaultValues: { s999: '', hoi: '', s925: '', images: [] } })

  useEffect(() => {
    form.reset({
      s999: '',
      hoi: '',
      s925: '',
      images: [],
    })
  }, [slip, form])

  const [s999, hoi, s925] = useWatch({ control: form.control, name: ['s999', 'hoi', 's925'] })
  const estimateGram = silverEstimateFromWax(slip?.waxWeightGram)
  const issueParts = [s999, hoi, s925].map(optionalGram)
  const enteredTotal = issueParts.reduce<number>((sum, n) => sum + (n != null && !Number.isNaN(n) ? n : 0), 0)
  const issueTotal = enteredTotal > 0 ? enteredTotal : estimateGram
  const busy = saving || uploading

  return (
    <Dialog open={Boolean(slip)} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Cấp vật tư — phiếu {slip?.code ?? ''}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={({ s999: s999Value, hoi: hoiValue, s925: s925Value, images }) => {
          const parts = [s999Value, hoiValue, s925Value].map(optionalGram)
          if (parts.some((n) => n != null && Number.isNaN(n))) return
          onSave({
            images: images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height })),
            issueS999Gram: parts[0],
            issueMasterAlloyGram: parts[1],
            issueS925Gram: parts[2],
          })
        }}
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Nhập trọng lượng thực xuất. Để trống rồi xác nhận thì lấy trọng lượng ước tính.
            </Typography>
            <CastingSlipMetalFormTable<Values>
              issueNames={{ s999: 's999', hoi: 'hoi', s925: 's925' }}
              estimateGram={estimateGram}
              issueTotal={issueTotal}
              disabled={busy}
            />
            <FormImageField<Values>
              name="images"
              label="Ảnh phiếu đúc và vật tư"
              kind="CASTING_TREE"
              required
              requiredMessage="Chụp ảnh phiếu đúc và vật tư kèm theo"
              onUploadingChange={setUploading}
              readOnly={saving}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !slip}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
