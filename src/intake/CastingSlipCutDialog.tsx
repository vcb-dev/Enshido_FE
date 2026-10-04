import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import type { CastingSlip, CastingSlipImage, ConfirmCastingSlipPayload } from '../api/castingSlips'
import type { OrderImage } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { DialogForm, FormQtyField } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'

type LineValues = { intakeOrderId: string; qty: string; weight: string; images: OrderImage[] }
type Values = { lines: LineValues[]; rest: string; restImages: OrderImage[] }

function gram(raw: string, allowZero: boolean) {
  const value = raw.trim() ? Number(raw) : NaN
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value <= 0)) return null
  return value
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

function defaultValues(slip: CastingSlip): Values {
  const tree = Number(slip.castTreeWeightGram ?? 0)
  const waxTotal = slip.orders.reduce((sum, line) => sum + Number(line.waxWeightGram ?? 0), 0)
  return {
    lines: slip.orders.map((line) => ({
      intakeOrderId: line.intakeOrderId,
      qty: String(line.qty),
      weight:
        tree > 0 && waxTotal > 0
          ? String(round4((tree * Number(line.waxWeightGram ?? 0)) / waxTotal))
          : '',
      images: [],
    })),
    rest: '0',
    restImages: [],
  }
}

function toImages(images: OrderImage[]): CastingSlipImage[] {
  return images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height }))
}

/** Sau Đúc xong: chia phôi từng đơn, phần cây còn lại về NVL, sinh lệnh SX Chờ nguội. */
export function CastingSlipCutDialog({
  slip,
  saving,
  onClose,
  onSave,
}: {
  slip: CastingSlip | null
  saving: boolean
  onClose: () => void
  onSave: (payload: ConfirmCastingSlipPayload) => void
}) {
  const [uploading, setUploading] = useState(false)
  const form = useForm<Values>({ defaultValues: { lines: [], rest: '0', restImages: [] } })
  const rest = useWatch({ control: form.control, name: 'rest' })

  useEffect(() => {
    if (slip) form.reset(defaultValues(slip))
  }, [slip, form])

  const busy = saving || uploading
  const tree = Number(slip?.castTreeWeightGram ?? 0)

  return (
    <Dialog open={Boolean(slip)} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cắt cây thông — {slip?.code ?? ''}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={(values) => {
          const restGram = gram(values.rest, true)
          if (restGram == null) return
          const blanks = values.lines.map((line) => ({
            intakeOrderId: line.intakeOrderId,
            qty: Number(line.qty),
            weightGram: gram(line.weight, false)!,
            images: toImages(line.images),
          }))
          if (blanks.some((line) => !Number.isFinite(line.qty) || line.qty <= 0 || line.weightGram == null)) {
            return
          }
          onSave({
            blanks,
            restWeightGram: restGram,
            restImages: toImages(values.restImages),
          })
        }}
      >
        <DialogContent>
          {slip ? (
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Cây thông sau đúc: <strong>{formatQty(slip.castTreeWeightGram ?? '0')} g</strong>. Nhập phôi từng
                đơn rồi phần cây còn lại về kho NVL. Sau bước này đơn sang Chờ nguội.
              </Typography>
              {slip.orders.map((order, index) => (
                <Stack key={order.intakeOrderId} spacing={1} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2">
                    {order.code}
                    {order.productName ? ` · ${order.productName}` : ''} · {order.qty} sản phẩm
                  </Typography>
                  <input type="hidden" {...form.register(`lines.${index}.intakeOrderId`)} />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <FormQtyField<Values>
                      name={`lines.${index}.qty`}
                      label="Số phôi"
                      required
                      size="small"
                      fullWidth
                      disabled={busy}
                    />
                    <FormQtyField<Values>
                      name={`lines.${index}.weight`}
                      label="Trọng lượng phôi (g)"
                      required
                      size="small"
                      fullWidth
                      disabled={busy}
                      rules={{
                        validate: (value) =>
                          gram(String(value ?? ''), false) == null ? 'Nhập trọng lượng phôi (g)' : true,
                      }}
                    />
                  </Stack>
                  <FormImageField<Values>
                    name={`lines.${index}.images`}
                    label="Ảnh cân phôi"
                    kind="CASTING_TREE"
                    required
                    requiredMessage="Chụp ảnh cân phôi"
                    onUploadingChange={setUploading}
                    readOnly={saving}
                  />
                </Stack>
              ))}
              <FormQtyField<Values>
                name="rest"
                label="Phần cây còn lại (g)"
                required
                size="small"
                fullWidth
                disabled={busy}
                rules={{
                  validate: (value, values) => {
                    const restGram = gram(String(value ?? ''), true)
                    if (restGram == null) return 'Nhập phần cây còn lại (g)'
                    const blankTotal = values.lines.reduce((sum, line) => sum + (gram(line.weight, false) ?? 0), 0)
                    if (tree > 0 && restGram + blankTotal > tree + 0.0001) {
                      return `Tổng phôi và phần còn lại vượt cây sau đúc (${formatQty(String(tree))} g)`
                    }
                    return true
                  },
                }}
              />
              <FormImageField<Values>
                name="restImages"
                label="Ảnh cân phần cây còn lại"
                kind="CASTING_TREE"
                required={Number(rest) > 0}
                requiredMessage="Chụp ảnh cân phần cây còn lại"
                onUploadingChange={setUploading}
                readOnly={saving}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !slip}>
            {saving ? 'Đang cắt…' : 'Cắt cây thông'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
