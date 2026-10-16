import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { listRestMaterialOptionsApi, type CastingSlip, type CastingSlipImage } from '../api/castingSlips'
import type { OrderImage } from '../api/productionOrders'
import { DialogForm, FormSelect } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'
import { CastingSlipMetalFormTable } from './CastingSlipMetalTable'
import { silverEstimateFromWax } from './castingEstimate'

type Values = {
  s999: string
  hoi: string
  s925: string
  s999Material: string
  hoiMaterial: string
  s925Material: string
  images: OrderImage[]
}

type MetalKey = 's999' | 'hoi' | 's925'

/** Ba dòng vật tư: ô gram, ô mã NVL, nhãn. */
const METALS: { key: MetalKey; material: `${MetalKey}Material`; label: string }[] = [
  { key: 's999', material: 's999Material', label: 'Bạc S999' },
  { key: 'hoi', material: 'hoiMaterial', label: 'Hội' },
  { key: 's925', material: 's925Material', label: 'Bạc S925' },
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

/** Dòng nào sẽ xuất kho: có nhập thực xuất thì theo số nhập, không thì theo ước tính. */
function gramsToIssue(values: Pick<Values, MetalKey>, estimate: ReturnType<typeof silverEstimateFromWax>) {
  const entered = METALS.map((metal) => optionalGram(values[metal.key]))
  const enteredTotal = entered.reduce<number>((sum, n) => sum + (n != null && !Number.isNaN(n) ? n : 0), 0)
  const estimated = [estimate.s999, estimate.masterAlloy, estimate.s925]
  return METALS.map((_, index) => (enteredTotal > 0 ? (entered[index] ?? 0) : estimated[index]))
}

/**
 * Bước 7b: phiếu đã in — thủ kho nhập thực xuất (để trống = lấy ước tính), chọn mã NVL xuất cho từng
 * dòng, chụp ảnh, Lưu → Chờ đúc. Bạc / hội trừ khỏi kho NVL chính ngay lúc Lưu.
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
    issueS999MaterialId?: string
    issueMasterAlloyMaterialId?: string
    issueS925MaterialId?: string
  }) => void
}) {
  const [uploading, setUploading] = useState(false)
  const form = useForm<Values>({
    defaultValues: { s999: '', hoi: '', s925: '', s999Material: '', hoiMaterial: '', s925Material: '', images: [] },
  })
  const materials = useQuery({
    queryKey: ['casting-rest-material-options'],
    queryFn: listRestMaterialOptionsApi,
    enabled: Boolean(slip),
    staleTime: 5 * 60_000,
  })
  const items = useMemo(() => materials.data?.items ?? [], [materials.data?.items])
  const options = useMemo(
    () => items.map((item) => ({ value: item.id, label: item.sku ? `${item.sku} · ${item.name}` : item.name })),
    [items],
  )

  useEffect(() => {
    form.reset({ s999: '', hoi: '', s925: '', s999Material: '', hoiMaterial: '', s925Material: '', images: [] })
  }, [slip, form])

  useEffect(() => {
    // Chọn sẵn mã thủ kho đã dùng lần trước (còn trong danh sách) — không đoán theo tên, vì tên
    // như "đầu cây S925" dễ khớp nhầm sang bạc nguyên liệu. Không đè ô đã chọn.
    if (!slip || items.length === 0) return
    const last = readLastMaterials()
    for (const metal of METALS) {
      if (form.getValues(metal.material)) continue
      const remembered = last[metal.key]
      if (remembered && items.some((item) => item.id === remembered)) form.setValue(metal.material, remembered)
    }
  }, [slip, items, form])

  const [s999, hoi, s925] = useWatch({ control: form.control, name: ['s999', 'hoi', 's925'] })
  const estimate = silverEstimateFromWax(slip?.waxWeightGram)
  const issueParts = [s999, hoi, s925].map(optionalGram)
  const enteredTotal = issueParts.reduce<number>((sum, n) => sum + (n != null && !Number.isNaN(n) ? n : 0), 0)
  const issueTotal = enteredTotal > 0 ? enteredTotal : estimate.total
  const issuing = gramsToIssue({ s999, hoi, s925 }, estimate)
  const busy = saving || uploading

  return (
    <Dialog open={Boolean(slip)} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Cấp vật tư — phiếu {slip?.code ?? ''}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={(values) => {
          const parts = METALS.map((metal) => optionalGram(values[metal.key]))
          if (parts.some((n) => n != null && Number.isNaN(n))) return
          const issued = gramsToIssue(values, estimate)
          const materialOf = (index: number) =>
            issued[index] > 0 ? values[METALS[index].material] || undefined : undefined
          saveLastMaterials({
            s999: values.s999Material || undefined,
            hoi: values.hoiMaterial || undefined,
            s925: values.s925Material || undefined,
          })
          onSave({
            images: values.images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height })),
            issueS999Gram: parts[0],
            issueMasterAlloyGram: parts[1],
            issueS925Gram: parts[2],
            issueS999MaterialId: materialOf(0),
            issueMasterAlloyMaterialId: materialOf(1),
            issueS925MaterialId: materialOf(2),
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
              estimate={estimate}
              issueTotal={issueTotal}
              disabled={busy}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Xuất từ kho NVL chính
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Lưu là trừ tồn các mã dưới đây theo số gram cấp. Thiếu tồn thì không cấp được.
              </Typography>
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
                {METALS.map((metal, index) => (
                  <FormSelect<Values>
                    key={metal.key}
                    name={metal.material}
                    label={`Mã NVL ${metal.label}`}
                    options={options}
                    placeholder="Chọn mã NVL"
                    disabled={busy || issuing[index] <= 0}
                    rules={{
                      validate: (value, all) =>
                        gramsToIssue(all, estimate)[index] <= 0 || Boolean(value) || `Chọn mã NVL xuất cho ${metal.label}`,
                    }}
                  />
                ))}
              </Box>
              {materials.isSuccess && items.length < 3 ? (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                  Kho NVL chính mới có {items.length} mã tính theo gram — thêm mã Bạc S999, Hội, Bạc S925 (đơn vị
                  gram) và nhập tồn trước khi cấp.
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
          <Button type="submit" variant="contained" disabled={busy || !slip}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
