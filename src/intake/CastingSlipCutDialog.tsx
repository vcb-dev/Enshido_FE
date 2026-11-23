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
import { useQuery } from '@tanstack/react-query'
import { useWatch } from 'react-hook-form'
import { useAppForm } from '../components/ui/form/useAppForm'
import {
  listRestMaterialOptionsApi,
  type CastingSlip,
  type CastingSlipImage,
  type ConfirmCastingSlipPayload,
  type RestMaterialOptions,
  type CutCastingSlipItem,
} from '../api/castingSlips'
import type { OrderImage } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { DialogForm, FormQtyField, FormTextField } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'

type LineValues = {
  intakeOrderId: string
  qty: string
  weight: string
  /** Số sp đúc hỏng — trống = 0. Lưu xong BE tạo lệnh bù đi lại từ bước sáp. */
  defectQty: string
  defectNote: string
  images: OrderImage[]
}
type RestChoice = NonNullable<RestMaterialOptions['choices']>[number]
/**
 * Phần cây còn lại chia hai ô nhập kho NVL: bạc nguyên liệu S925 (A00001) và bạc thu hồi (A00189).
 * Tổng hai ô là phần còn lại của cây.
 */
type SlipValues = {
  lines: LineValues[]
  restS925: string
  restRecovered: string
  restImages: OrderImage[]
}
type Values = { slips: SlipValues[] }

function gram(raw: string, allowZero: boolean) {
  const value = raw.trim() ? Number(raw) : NaN
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value <= 0))
    return null
  return value
}

/** SL lỗi đúc: trống = 0, số nguyên ≥ 0; sai thì null. */
export function defectCount(raw: string | undefined) {
  const text = (raw ?? '').trim()
  if (!text) return 0
  const value = Number(text)
  return Number.isInteger(value) && value >= 0 ? value : null
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

/** Tổng phần cây còn lại của một phiếu = S925 + bạc thu hồi (ô trống / sai tính 0). */
function restTotal(value: Pick<SlipValues, 'restS925' | 'restRecovered'> | undefined) {
  if (!value) return 0
  return round4((gram(value.restS925, true) ?? 0) + (gram(value.restRecovered, true) ?? 0))
}

/** Tổng phôi + hai phần còn lại không được vượt cây sau đúc (khớp BE). */
function restOverTree(value: SlipValues, tree: number): true | string {
  const blankTotal = value.lines.reduce((sum, line) => sum + (gram(line.weight, false) ?? 0), 0)
  if (tree > 0 && round4(restTotal(value) + blankTotal) > tree) {
    return `Tổng phôi và phần còn lại vượt cây sau đúc (${formatQty(String(tree))} g)`
  }
  return true
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
      defectQty: '',
      defectNote: '',
      weight:
        tree > 0 && waxTotal > 0
          ? String(round4((tree * Number(line.waxWeightGram ?? 0)) / waxTotal))
          : '',
      images: [],
    })),
    restS925: '0',
    restRecovered: '0',
    restImages: [],
  }
}

/** Mã kho NVL của một ô phần còn lại, vd "A00189 · Bạc thu hồi"; chưa có mã thì báo. */
export function choiceHint(choice: RestChoice | undefined, loading: boolean) {
  if (!choice) return loading ? 'Đang tải mã NVL…' : undefined
  return choice.material
    ? `Nhập kho ${[choice.material.sku, choice.material.name].filter(Boolean).join(' · ')}`
    : `Kho NVL chưa có mã ${choice.sku} — tạo mã trước khi nhập phần này`
}

/**
 * Phần cây còn lại = TL cây sau đúc − tổng TL phôi, khi đã nhập đủ TL phôi mọi đơn. null = chưa
 * nhập đủ, cây chưa có TL, hoặc phôi đã vượt cây (ô còn lại tự báo lỗi vượt cây).
 */
export function restFromBlanks(
  treeGram: number,
  blankWeights: readonly string[],
): number | null {
  if (!(treeGram > 0)) return null
  const grams = blankWeights.map((weight) => gram(weight, false))
  if (grams.some((value) => value == null)) return null
  const rest = round4(treeGram - grams.reduce<number>((sum, value) => sum + value!, 0))
  return rest >= 0 ? rest : null
}

export function toImages(images: OrderImage[]): CastingSlipImage[] {
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
        const { blanks, restS925Gram, restRecoveredGram, restImages } = item
        onSave({ blanks, restS925Gram, restRecoveredGram, restImages })
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
  const form = useAppForm<Values>({ defaultValues: { slips: [] } })
  const watched = useWatch({ control: form.control, name: 'slips' })
  const slipKey = slips.map((slip) => slip.id).join(',')
  const restMaterials = useQuery({
    queryKey: ['casting-rest-material-options'],
    queryFn: listRestMaterialOptionsApi,
    enabled: slips.length > 0,
  })
  const restChoices = restMaterials.data?.choices ?? []
  const s925Choice = restChoices.find((choice) => choice.key === 'S925')
  const recoveredChoice = restChoices.find((choice) => choice.key === 'RECOVERED')
  // Đã tải xong mà kho chưa có mã bạc thu hồi thì khoá ô đó (BE cũng chặn).
  const recoveredMissing = Boolean(recoveredChoice && !recoveredChoice.material)

  useEffect(() => {
    form.reset({ slips: slips.map(defaultValues) })
    setUploads({})
    // Reset only when the selection changes; preserve edits during uploads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slipKey, form])

  // Nhập đủ TL phôi là tự điền ô S925 = phần cây còn lại − bạc thu hồi; thủ kho đã tự gõ ô S925
  // thì không ghi đè.
  const { dirtyFields } = form.formState
  useEffect(() => {
    slips.forEach((slip, index) => {
      const value = watched?.[index]
      if (!value) return
      const name = `slips.${index}.restS925` as const
      if (dirtyFields.slips?.[index]?.restS925) return
      const rest = restFromBlanks(
        Number(slip.castTreeWeightGram ?? 0),
        value.lines.map((line) => line.weight),
      )
      const recovered = gram(value.restRecovered, true) ?? 0
      const s925 = rest != null ? round4(rest - recovered) : null
      if (s925 != null && s925 >= 0 && String(s925) !== value.restS925) {
        form.setValue(name, String(s925), { shouldValidate: true })
      }
    })
  }, [watched, slips, form, dirtyFields])

  // Nhập SL lỗi đúc là tự trừ vào Số phôi đạt (= SL đơn − lỗi); thủ kho đã tự gõ Số phôi thì
  // không ghi đè.
  useEffect(() => {
    slips.forEach((slip, slipIndex) => {
      const value = watched?.[slipIndex]
      if (!value) return
      slip.orders.forEach((order, index) => {
        const line = value.lines[index]
        if (!line || dirtyFields.slips?.[slipIndex]?.lines?.[index]?.qty) return
        const defect = defectCount(line.defectQty)
        if (defect == null || defect >= order.qty) return
        const qty = String(order.qty - defect)
        if (qty !== line.qty) {
          form.setValue(`slips.${slipIndex}.lines.${index}.qty`, qty, { shouldValidate: true })
        }
      })
    })
  }, [watched, slips, form, dirtyFields])

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
            const s925Gram = gram(value.restS925, true)
            const recoveredGram = gram(value.restRecovered, true)
            if (s925Gram == null || recoveredGram == null) return
            const blanks = value.lines.map((line) => {
              const defectQty = defectCount(line.defectQty)
              const note = line.defectNote.trim()
              return {
                intakeOrderId: line.intakeOrderId,
                qty: Number(line.qty),
                weightGram: gram(line.weight, false)!,
                ...(defectQty ? { defectQty, ...(note ? { defectNote: note } : {}) } : {}),
                images: toImages(line.images),
              }
            })
            if (
              blanks.some(
                (line) =>
                  !Number.isInteger(line.qty) ||
                  line.qty <= 0 ||
                  line.weightGram == null,
              ) ||
              value.lines.some((line) => defectCount(line.defectQty) == null)
            )
              return
            if (recoveredGram > 0 && recoveredMissing) return
            items.push({
              slipId: slips[index].id,
              blanks,
              restS925Gram: s925Gram,
              restRecoveredGram: recoveredGram,
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
                <Typography variant="body2" color="text.secondary">
                  Có sản phẩm đúc hỏng thì nhập <strong>SL lỗi đúc</strong>: hệ thống tạo lệnh bù
                  đi lại từ bước sáp, đơn gốc chỉ đi tiếp với số phôi đạt. Sản phẩm hỏng cân vào
                  phần cây còn lại.
                </Typography>
                {slip.orders.map((order, index) => {
                  const defect = defectCount(watched?.[slipIndex]?.lines[index]?.defectQty)
                  return (
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
                          label="Số phôi đạt"
                          required
                          size="small"
                          fullWidth
                          disabled={busy}
                          rules={{
                            validate: (value, values) => {
                              const qty = Number(value)
                              const max =
                                order.qty -
                                (defectCount(
                                  values.slips[slipIndex]?.lines[index]?.defectQty,
                                ) ?? 0)
                              return Number.isInteger(qty) && qty > 0 && qty <= max
                                ? true
                                : max < order.qty
                                  ? `Số phôi đạt + SL lỗi đúc tối đa ${order.qty} — nhập từ 1 đến ${max}`
                                  : `Nhập số phôi nguyên từ 1 đến ${order.qty}`
                            },
                          }}
                        />
                        <FormQtyField<Values>
                          name={`slips.${slipIndex}.lines.${index}.defectQty`}
                          label="SL lỗi đúc"
                          size="small"
                          fullWidth
                          disabled={busy}
                          rules={{
                            deps: [`slips.${slipIndex}.lines.${index}.qty`],
                            validate: (value) => {
                              const count = defectCount(String(value ?? ''))
                              return count != null && count < order.qty
                                ? true
                                : `Nhập số nguyên từ 0 đến ${order.qty - 1} (hỏng cả đơn thì báo Lỗi đúc cả phiếu)`
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
                      {defect ? (
                        <>
                          <FormTextField<Values>
                            name={`slips.${slipIndex}.lines.${index}.defectNote`}
                            label="Lý do lỗi đúc"
                            placeholder="Rỗ khí, thiếu kim loại…"
                            size="small"
                            fullWidth
                            disabled={busy}
                            rules={{ maxLength: { value: 500, message: 'Tối đa 500 ký tự' } }}
                          />
                          <Typography variant="body2" color="error">
                            Lưu xong tạo lệnh bù {defect} sp cho {order.code}, đi lại từ bước sáp.
                            Đơn gốc còn {order.qty - defect} sp.
                          </Typography>
                        </>
                      ) : null}
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
                  )
                })}
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Phần cây còn lại nhập kho NVL
                  {restTotal(watched?.[slipIndex]) > 0
                    ? ` · tổng ${formatQty(String(restTotal(watched?.[slipIndex])))} g`
                    : ''}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <FormQtyField<Values>
                    name={`slips.${slipIndex}.restS925`}
                    label="Bạc nguyên liệu S925 (g)"
                    helperText={
                      choiceHint(s925Choice, restMaterials.isLoading) ??
                      (tree > 0 ? 'Tự tính = cây sau đúc − tổng phôi − bạc thu hồi' : undefined)
                    }
                    required
                    size="small"
                    fullWidth
                    disabled={busy}
                    rules={{
                      validate: (value, values) =>
                        gram(String(value ?? ''), true) == null
                          ? 'Nhập bạc nguyên liệu S925 (g), không có thì nhập 0'
                          : restOverTree(values.slips[slipIndex], tree),
                    }}
                  />
                  <FormQtyField<Values>
                    name={`slips.${slipIndex}.restRecovered`}
                    label="Bạc thu hồi (g)"
                    helperText={choiceHint(recoveredChoice, restMaterials.isLoading)}
                    required
                    size="small"
                    fullWidth
                    disabled={busy || recoveredMissing}
                    rules={{
                      validate: (value, values) => {
                        const recovered = gram(String(value ?? ''), true)
                        if (recovered == null) return 'Nhập bạc thu hồi (g), không có thì nhập 0'
                        if (recovered > 0 && recoveredMissing) return 'Kho NVL chưa có mã bạc thu hồi'
                        return restOverTree(values.slips[slipIndex], tree)
                      },
                    }}
                  />
                </Stack>
                <FormImageField<Values>
                  name={`slips.${slipIndex}.restImages`}
                  label="Ảnh cân phần cây còn lại"
                  kind="CASTING_TREE"
                  required={restTotal(watched?.[slipIndex]) > 0}
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
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
