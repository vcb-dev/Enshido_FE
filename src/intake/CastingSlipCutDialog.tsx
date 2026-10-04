import { canCutCastingSlip } from '../casting/castingCuts'
import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import type {
  CastingSlip,
  CastingSlipImage,
  ConfirmCastingSlipPayload,
  CutCastingSlipItem,
} from '../api/castingSlips'
import type { OrderImage } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { DialogForm, FormQtyField } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'

type LineValues = {
  intakeOrderId: string
  qty: string
  weight: string
  images: OrderImage[]
}
type SlipValues = {
  lines: LineValues[]
  rest: string
  restImages: OrderImage[]
}
type Values = { slips: SlipValues[] }

function gram(raw: string, allowZero: boolean) {
  const value = raw.trim() ? Number(raw) : NaN
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value <= 0))
    return null
  return value
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

function defaultValues(slip: CastingSlip): SlipValues {
  const tree = Number(slip.castTreeWeightGram ?? 0)
  const waxTotal = slip.orders.reduce(
    (sum, line) => sum + Number(line.waxWeightGram ?? 0),
    0,
  )
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
  return images.map(({ url, publicId, width, height }) => ({
    url,
    publicId,
    width,
    height,
  }))
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
  return (
    <CastingSlipsCutDialog
      slips={slip ? [slip] : []}
      saving={saving}
      onClose={onClose}
      onSave={([item]) => {
        const { blanks, restWeightGram, restMaterialId, restImages } = item
        onSave({ blanks, restWeightGram, restMaterialId, restImages })
      }}
    />
  )
}

export function CastingSlipsCutDialog({
  slips,
  saving,
  onClose,
  onSave,
}: {
  slips: CastingSlip[]
  saving: boolean
  onClose: () => void
  onSave: (items: CutCastingSlipItem[]) => void
}) {
  const [uploads, setUploads] = useState<Record<string, boolean>>({})
  const setUploading = (key: string, uploading: boolean) =>
    setUploads((current) =>
      Boolean(current[key]) === uploading
        ? current
        : { ...current, [key]: uploading },
    )
  const form = useForm<Values>({ defaultValues: { slips: [] } })
  const watched = useWatch({ control: form.control, name: 'slips' })

  const slipKey = slips.map((slip) => slip.id).join(',')
  useEffect(() => {
    form.reset({ slips: slips.map(defaultValues) })
    setUploads({})
    // Reset only when the selection changes; preserve edits during uploads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slipKey, form])

  const busy = saving || Object.values(uploads).some(Boolean)

  return (
    <Dialog
      open={slips.length > 0}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Cắt cây thông —{' '}
        {slips.length} phiếu · {slips.reduce((sum, slip) => sum + slip.orders.length, 0)} đơn
      </DialogTitle>
      <DialogForm
        form={form}
        onSubmit={(values) => {
          const items: CutCastingSlipItem[] = []
          for (const [index, value] of values.slips.entries()) {
            const restGram = gram(value.rest, true)
            if (restGram == null) return
            const blanks = value.lines.map((line) => ({
              intakeOrderId: line.intakeOrderId,
              qty: Number(line.qty),
              weightGram: gram(line.weight, false)!,
              images: toImages(line.images),
            }))
            if (
              blanks.some(
                (line) =>
                  !Number.isInteger(line.qty) ||
                  line.qty <= 0 ||
                  line.weightGram == null,
              )
            )
              return
            items.push({
              slipId: slips[index].id,
              blanks,
              restWeightGram: restGram,
              restImages: toImages(value.restImages),
            })
          }
          onSave(items)
        }}
      >
        <DialogContent>
          {slips.map((slip, slipIndex) => {
            const tree = Number(slip.castTreeWeightGram ?? 0)
            return (
              <Stack
                key={slip.id}
                spacing={2}
                sx={{
                  pt: 0.5,
                  pb: 2,
                  mb: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="subtitle2">
                  Phiếu {slip.code} · {slip.batchOrderCodes}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cây thông sau đúc:{' '}
                  <strong>{formatQty(slip.castTreeWeightGram ?? '0')} g</strong>
                  . Nhập phôi từng đơn rồi phần cây còn lại về kho NVL. Sau bước
                  này đơn sang Chờ nguội.
                </Typography>
                {slip.orders.map((order, index) => (
                  <Stack
                    key={order.intakeOrderId}
                    spacing={1}
                    sx={{
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="subtitle2">
                      {order.code}
                      {order.productName
                        ? ` · ${order.productName}`
                        : ''} · {order.qty} sản phẩm
                    </Typography>
                    <input
                      type="hidden"
                      {...form.register(
                        `slips.${slipIndex}.lines.${index}.intakeOrderId`,
                      )}
                    />
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                    >
                      <FormQtyField<Values>
                        name={`slips.${slipIndex}.lines.${index}.qty`}
                        label="Số phôi"
                        required
                        size="small"
                        fullWidth
                        disabled={busy}
                        rules={{
                          validate: (value) => {
                            const qty = Number(value)
                            return Number.isInteger(qty) &&
                              qty > 0 &&
                              qty <= order.qty
                              ? true
                              : `Nhập số phôi nguyên từ 1 đến ${order.qty}`
                          },
                        }}
                      />
                      <FormQtyField<Values>
                        name={`slips.${slipIndex}.lines.${index}.weight`}
                        label="Trọng lượng phôi (g)"
                        required
                        size="small"
                        fullWidth
                        disabled={busy}
                        rules={{
                          validate: (value) =>
                            gram(String(value ?? ''), false) == null
                              ? 'Nhập trọng lượng phôi (g)'
                              : true,
                        }}
                      />
                    </Stack>
                    <FormImageField<Values>
                      name={`slips.${slipIndex}.lines.${index}.images`}
                      label="Ảnh cân phôi"
                      kind="CASTING_TREE"
                      required
                      requiredMessage="Chụp ảnh cân phôi"
                      onUploadingChange={(uploading) =>
                        setUploading(
                          `${slip.id}:${order.intakeOrderId}`,
                          uploading,
                        )
                      }
                      readOnly={saving}
                    />
                  </Stack>
                ))}
                <FormQtyField<Values>
                  name={`slips.${slipIndex}.rest`}
                  label="Phần cây còn lại (g)"
                  required
                  size="small"
                  fullWidth
                  disabled={busy}
                  rules={{
                    validate: (value, values) => {
                      const restGram = gram(String(value ?? ''), true)
                      if (restGram == null) return 'Nhập phần cây còn lại (g)'
                      const blankTotal = values.slips[slipIndex].lines.reduce(
                        (sum, line) => sum + (gram(line.weight, false) ?? 0),
                        0,
                      )
                      if (tree > 0 && round4(restGram + blankTotal) > tree) {
                        return `Tổng phôi và phần còn lại vượt cây sau đúc (${formatQty(String(tree))} g)`
                      }
                      return true
                    },
                  }}
                />
                <FormImageField<Values>
                  name={`slips.${slipIndex}.restImages`}
                  label="Ảnh cân phần cây còn lại"
                  kind="CASTING_TREE"
                  required={Number(watched?.[slipIndex]?.rest) > 0}
                  requiredMessage="Chụp ảnh cân phần cây còn lại"
                  onUploadingChange={(uploading) =>
                    setUploading(`${slip.id}:rest`, uploading)
                  }
                  readOnly={saving}
                />
              </Stack>
            )
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              busy ||
              !slips.length ||
              slips.some((slip) => !canCutCastingSlip(slip))
            }
          >
            {saving ? 'Đang lưu…' : 'Lưu và chuyển Chờ nguội'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
