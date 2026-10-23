import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useWatch } from 'react-hook-form'
import { useAppForm } from '../components/ui/form/useAppForm'
import { listRestMaterialOptionsApi, type CastingSlip, type CastingSlipImage } from '../api/castingSlips'
import { formatQty } from '../api/inventory'
import type { OrderImage } from '../api/productionOrders'
import { DialogForm, FormSelect } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'
import { CastingSlipMetalFormTable } from './CastingSlipMetalTable'
import { goldEstimateFromWax, goldKaratFromLabel, silverEstimateFromWax } from './castingEstimate'
import { insufficientIssueStockMessage, needByMaterialId } from './castingIssueStock'

type Values = {
  s999: string
  hoi: string
  s925: string
  gold: string
  s999Material: string
  hoiMaterial: string
  s925Material: string
  goldMaterial: string
  images: OrderImage[]
}

type MetalKey = 's999' | 'hoi' | 's925' | 'gold'

const METALS: { key: MetalKey; material: `${MetalKey}Material`; label: string; fromEstimate: boolean }[] = [
  { key: 's999', material: 's999Material', label: 'Bạc S999', fromEstimate: true },
  { key: 'hoi', material: 'hoiMaterial', label: 'Hội', fromEstimate: true },
  { key: 's925', material: 's925Material', label: 'Bạc S925', fromEstimate: true },
  { key: 'gold', material: 'goldMaterial', label: 'Vàng', fromEstimate: true },
]

const LAST_MATERIAL_KEY = 'casting-issue-materials'

function optionalGram(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

function readLastMaterials(): Partial<Record<MetalKey, string>> {
  try {
    return JSON.parse(localStorage.getItem(LAST_MATERIAL_KEY) ?? '{}') as Partial<Record<MetalKey, string>>
  } catch {
    return {}
  }
}

function saveLastMaterials(value: Partial<Record<MetalKey, string>>) {
  try {
    localStorage.setItem(LAST_MATERIAL_KEY, JSON.stringify(value))
  } catch {
    // Trình duyệt chặn lưu thì lần sau chọn lại — không ảnh hưởng việc cấp.
  }
}

/** Bạc/hội: có nhập thực xuất thì theo số nhập, không thì theo ước tính. Vàng: chọn mã K thì lấy ước tính, có nhập thì theo số nhập. */
function gramsToIssue(
  values: Pick<Values, MetalKey>,
  estimate: ReturnType<typeof silverEstimateFromWax>,
  goldEstimate = 0,
) {
  const silver = METALS.filter((metal) => metal.key !== 'gold')
  const entered = silver.map((metal) => optionalGram(values[metal.key]))
  const enteredTotal = entered.reduce<number>((sum, n) => sum + (n != null && !Number.isNaN(n) ? n : 0), 0)
  const estimated = [estimate.s999, estimate.masterAlloy, estimate.s925]
  return METALS.map((metal) => {
    if (metal.key === 'gold') return optionalGram(values.gold) ?? goldEstimate
    const index = silver.findIndex((row) => row.key === metal.key)
    return enteredTotal > 0 ? (entered[index] ?? 0) : estimated[index]
  })
}

const emptyValues = (): Values => ({
  s999: '',
  hoi: '',
  s925: '',
  gold: '',
  s999Material: '',
  hoiMaterial: '',
  s925Material: '',
  goldMaterial: '',
  images: [],
})

/**
 * Bước 7b: phiếu đã in — thủ kho nhập thực xuất (để trống = lấy ước tính), chọn mã NVL xuất cho từng
 * dòng, chụp ảnh, Lưu → Chờ đúc. Bạc / hội / vàng trừ khỏi kho NVL chính ngay lúc Lưu.
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
    issueGoldGram?: number
    issueS999MaterialId?: string
    issueMasterAlloyMaterialId?: string
    issueS925MaterialId?: string
    issueGoldMaterialId?: string
  }) => void
}) {
  const [uploading, setUploading] = useState(false)
  const form = useAppForm<Values>({
    defaultValues: emptyValues(),
  })
  const materials = useQuery({
    queryKey: ['casting-rest-material-options'],
    queryFn: listRestMaterialOptionsApi,
    enabled: Boolean(slip),
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const items = useMemo(() => materials.data?.items ?? [], [materials.data?.items])
  const options = useMemo(
    () => items.map((item) => ({ value: item.id, label: item.sku ? `${item.sku} · ${item.name}` : item.name })),
    [items],
  )

  useEffect(() => {
    form.reset(emptyValues())
  }, [slip, form])

  useEffect(() => {
    // Chọn sẵn mã thủ kho đã dùng lần trước (còn trong danh sách) — không đoán theo tên, vì tên
    // như "đầu cây S925" dễ khớp nhầm sang bạc nguyên liệu. Không đè ô đã chọn.
    if (!slip || items.length === 0) return
    const last = readLastMaterials()
    for (const metal of METALS) {
      if (metal.key === 'gold') continue
      if (form.getValues(metal.material)) continue
      const remembered = last[metal.key]
      if (remembered && items.some((item) => item.id === remembered)) {
        form.setValue(metal.material, remembered, { shouldValidate: true, shouldTouch: true })
      }
    }
  }, [slip, items, form])

  const [s999, hoi, s925, gold, goldMaterial, s999Material, hoiMaterial, s925Material] = useWatch({
    control: form.control,
    name: ['s999', 'hoi', 's925', 'gold', 'goldMaterial', 's999Material', 'hoiMaterial', 's925Material'],
  })
  const estimate = silverEstimateFromWax(slip?.waxWeightGram)
  const selectedGold = items.find((item) => item.id === goldMaterial)
  const goldKarat =
    selectedGold?.goldKarat ?? goldKaratFromLabel(selectedGold?.sku, selectedGold?.name) ?? null
  const goldEstimate = goldEstimateFromWax(slip?.waxWeightGram, goldKarat)
  const silverParts = [s999, hoi, s925].map(optionalGram)
  const silverEntered = silverParts.reduce<number>((sum, n) => sum + (n != null && !Number.isNaN(n) ? n : 0), 0)
  const issueTotal = silverEntered > 0 ? silverEntered : estimate.total
  const issuing = gramsToIssue({ s999, hoi, s925, gold }, estimate, goldEstimate)
  const materialIds = [s999Material, hoiMaterial, s925Material, goldMaterial]
  const needById = needByMaterialId(materialIds, issuing)
  const issuingKey = issuing.join('|')
  const materialKey = materialIds.map((id) => id || '').join('|')
  const busy = saving || uploading
  const hasStockShortfall = METALS.some((_, index) => {
    const id = materialIds[index]
    if (!id || issuing[index] <= 0) return false
    const item = items.find((row) => row.id === id)
    return Boolean(
      insufficientIssueStockMessage({
        need: needById.get(id) ?? issuing[index],
        availableQty: item?.availableQty,
        heldQty: item?.heldQty,
        onHandQty: item?.onHandQty,
      }),
    )
  })

  useEffect(() => {
    const names = METALS.filter((_, index) => materialKey.split('|')[index]).map((metal) => metal.material)
    if (names.length) void form.trigger(names)
  }, [form, items, issuingKey, materialKey])

  return (
    <Dialog open={Boolean(slip)} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Cấp vật tư — phiếu {slip?.code ?? ''}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={(values) => {
          const parts = METALS.map((metal) => optionalGram(values[metal.key]))
          if (parts.some((n) => n != null && Number.isNaN(n))) return
          const goldItem = items.find((item) => item.id === values.goldMaterial)
          const karat = goldItem?.goldKarat ?? goldKaratFromLabel(goldItem?.sku, goldItem?.name) ?? null
          const issued = gramsToIssue(values, estimate, goldEstimateFromWax(slip?.waxWeightGram, karat))
          const materialOf = (index: number) =>
            issued[index] > 0 ? values[METALS[index].material] || undefined : undefined
          saveLastMaterials({
            s999: values.s999Material || undefined,
            hoi: values.hoiMaterial || undefined,
            s925: values.s925Material || undefined,
            gold: values.goldMaterial || undefined,
          })
          onSave({
            images: values.images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height })),
            issueS999Gram: parts[0],
            issueMasterAlloyGram: parts[1],
            issueS925Gram: parts[2],
            issueGoldGram: parts[3],
            issueS999MaterialId: materialOf(0),
            issueMasterAlloyMaterialId: materialOf(1),
            issueS925MaterialId: materialOf(2),
            issueGoldMaterialId: materialOf(3),
          })
        }}
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Nhập trọng lượng thực xuất. Để trống rồi xác nhận thì lấy trọng lượng ước tính. Ước tính vàng hiện khi
              chọn mã NVL vàng 10k / 14k / 18k / 24k.
            </Typography>
            <CastingSlipMetalFormTable<Values>
              issueNames={{ s999: 's999', hoi: 'hoi', s925: 's925', gold: 'gold' }}
              estimate={estimate}
              goldEstimate={goldEstimate}
              goldKarat={goldKarat}
              issueTotal={issueTotal}
              disabled={busy}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Xuất từ kho NVL chính
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Lưu là trừ tồn các mã dưới đây theo số gram cấp. Chọn mã xong sẽ báo ngay trên ô nếu tồn không đủ
                (kể cả khi lấy trọng lượng ước tính).
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                {METALS.map((metal, index) => {
                  const selected = items.find((item) => item.id === materialIds[index])
                  return (
                    <FormSelect<Values>
                      key={metal.key}
                      name={metal.material}
                      label={`Mã NVL ${metal.label}`}
                      options={options}
                      placeholder="Chọn mã NVL"
                      disabled={busy || (metal.key !== 'gold' && issuing[index] <= 0)}
                      helperText={
                        selected?.availableQty != null && issuing[index] > 0
                          ? `Tồn khả dụng ${formatQty(selected.availableQty)} g`
                          : undefined
                      }
                      rules={{
                        validate: (value, all) => {
                          const goldItem = items.find((item) => item.id === all.goldMaterial)
                          const karat =
                            goldItem?.goldKarat ?? goldKaratFromLabel(goldItem?.sku, goldItem?.name) ?? null
                          const issued = gramsToIssue(
                            all,
                            estimate,
                            goldEstimateFromWax(slip?.waxWeightGram, karat),
                          )
                          if (issued[index] <= 0) return true
                          if (!value) return `Chọn mã NVL xuất cho ${metal.label}`
                          const ids = [all.s999Material, all.hoiMaterial, all.s925Material, all.goldMaterial]
                          const item = items.find((row) => row.id === value)
                          return (
                            insufficientIssueStockMessage({
                              need: needByMaterialId(ids, issued).get(String(value)) ?? issued[index],
                              availableQty: item?.availableQty,
                              heldQty: item?.heldQty,
                              onHandQty: item?.onHandQty,
                            }) ?? true
                          )
                        },
                      }}
                    />
                  )
                })}
              </Box>
              {materials.isSuccess && items.length < 3 ? (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                  Kho NVL chính mới có {items.length} mã tính theo gram — thêm mã Bạc S999, Hội, Bạc S925 (đơn vị
                  gram) và nhập tồn trước khi cấp. Vàng chọn thêm mã nếu xuất.
                </Typography>
              ) : null}
              {materials.isError ? (
                <Typography variant="caption" color="error">
                  Không tải được danh sách mã NVL — thử mở lại hộp thoại.
                </Typography>
              ) : null}
            </Box>
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
          <Button type="submit" variant="contained" disabled={busy || !slip || hasStockShortfall}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
