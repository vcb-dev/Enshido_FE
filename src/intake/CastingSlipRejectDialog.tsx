import { useEffect, useState } from 'react'
import {
  Alert,
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
  type RejectCastingSlipPayload,
} from '../api/castingSlips'
import type { OrderImage } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { DialogForm, FormQtyField } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'
import { choiceHint, toImages } from './CastingSlipCutDialog'

type Values = {
  restS925: string
  restRecovered: string
  restImages: OrderImage[]
}

function gram(raw: string) {
  const value = raw.trim() ? Number(raw) : NaN
  return Number.isFinite(value) && value >= 0 ? value : null
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

/** Tổng vật tư đã cấp cho phiếu (bạc + hội + S925 + vàng) — trần cây hỏng nhập kho (khớp BE). */
function issuedTotal(slip: CastingSlip) {
  return round4(Number(slip.issueTotalGram ?? 0) + Number(slip.issueGoldGram ?? 0))
}

/**
 * Báo lỗi đúc cả phiếu: thủ kho cân cây hỏng nhập về kho NVL (S925 A00001 / bạc thu hồi A00189,
 * giống phần cây còn lại lúc cắt cây). Đơn đi lại từ bước sáp (lô SX SLL → lệnh bù).
 */
export function CastingSlipRejectDialog({
  slip,
  saving,
  onClose,
  onSave,
}: {
  slip: CastingSlip | null
  saving: boolean
  onClose: () => void
  onSave: (payload: RejectCastingSlipPayload) => void
}) {
  const [uploading, setUploading] = useState(false)
  const form = useAppForm<Values>({
    defaultValues: { restS925: '', restRecovered: '0', restImages: [] },
  })
  const watched = useWatch({ control: form.control })
  const restMaterials = useQuery({
    queryKey: ['casting-rest-material-options'],
    queryFn: listRestMaterialOptionsApi,
    enabled: Boolean(slip),
  })
  const choices = restMaterials.data?.choices ?? []
  const s925Choice = choices.find((choice) => choice.key === 'S925')
  const recoveredChoice = choices.find((choice) => choice.key === 'RECOVERED')
  const recoveredMissing = Boolean(recoveredChoice && !recoveredChoice.material)

  useEffect(() => {
    if (!slip) return
    // Mặc định cả cây hỏng về S925 theo TL cây sau đúc thợ đã nhập — thủ kho cân lại thì sửa.
    const tree = Number(slip.castTreeWeightGram ?? 0)
    form.reset({
      restS925: tree > 0 ? String(round4(tree)) : '',
      restRecovered: '0',
      restImages: [],
    })
    setUploading(false)
    // Chỉ reset khi đổi phiếu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slip?.id])

  const total = round4((gram(watched.restS925 ?? '') ?? 0) + (gram(watched.restRecovered ?? '') ?? 0))
  const busy = saving || uploading
  const issued = slip ? issuedTotal(slip) : 0

  const validateTotal = (values: Values): true | string => {
    const sum = round4((gram(values.restS925) ?? 0) + (gram(values.restRecovered) ?? 0))
    if (sum <= 0) return 'Cân cây đúc lỗi nhập về kho NVL (S925 hoặc bạc thu hồi)'
    if (issued > 0 && sum > issued) {
      return `Tổng nhập kho vượt vật tư đã cấp (${formatQty(String(issued))} g)`
    }
    return true
  }

  return (
    <Dialog open={Boolean(slip)} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Báo lỗi đúc — phiếu {slip?.code}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={(values) => {
          const s925Gram = gram(values.restS925)
          const recoveredGram = gram(values.restRecovered)
          if (s925Gram == null || recoveredGram == null) return
          if (recoveredGram > 0 && recoveredMissing) return
          onSave({
            restS925Gram: s925Gram,
            restRecoveredGram: recoveredGram,
            restImages: toImages(values.restImages),
          })
        }}
      >
        <DialogContent>
          {slip ? (
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Đơn {slip.orders.map((line) => line.code).join(', ')} · vật tư đã cấp{' '}
                <strong>{formatQty(String(issued))} g</strong>
                {slip.castTreeWeightGram ? (
                  <>
                    {' '}· cây sau đúc <strong>{formatQty(slip.castTreeWeightGram)} g</strong>
                  </>
                ) : null}
                .
              </Typography>
              <Alert severity="info">
                Cân cây đúc lỗi nhập về kho NVL. Sáp đã cháy theo cây nên các đơn{' '}
                <strong>đi lại từ bước sáp</strong>: lô SX SLL tách sang lệnh bù, đơn khác về Chờ
                SX · Đã có 3D để in / bơm sáp lại.
              </Alert>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Cây đúc lỗi nhập kho NVL
                {total > 0 ? ` · tổng ${formatQty(String(total))} g` : ''}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <FormQtyField<Values>
                  name="restS925"
                  label="Bạc nguyên liệu S925 (g)"
                  helperText={choiceHint(s925Choice, restMaterials.isLoading)}
                  required
                  size="small"
                  fullWidth
                  disabled={busy}
                  rules={{
                    validate: (value, values) =>
                      gram(String(value ?? '')) == null
                        ? 'Nhập bạc nguyên liệu S925 (g), không có thì nhập 0'
                        : validateTotal(values),
                  }}
                />
                <FormQtyField<Values>
                  name="restRecovered"
                  label="Bạc thu hồi (g)"
                  helperText={choiceHint(recoveredChoice, restMaterials.isLoading)}
                  required
                  size="small"
                  fullWidth
                  disabled={busy || recoveredMissing}
                  rules={{
                    validate: (value, values) => {
                      const recovered = gram(String(value ?? ''))
                      if (recovered == null) return 'Nhập bạc thu hồi (g), không có thì nhập 0'
                      if (recovered > 0 && recoveredMissing) return 'Kho NVL chưa có mã bạc thu hồi'
                      return validateTotal(values)
                    },
                  }}
                />
              </Stack>
              <FormImageField<Values>
                name="restImages"
                label="Ảnh cân cây đúc lỗi"
                kind="CASTING_TREE"
                required
                requiredMessage="Chụp ảnh cân cây đúc lỗi"
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
          <Button type="submit" variant="contained" color="error" disabled={busy || !slip}>
            {saving ? 'Đang lưu…' : 'Báo lỗi đúc'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
