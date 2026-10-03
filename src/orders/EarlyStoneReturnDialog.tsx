import { useEffect } from 'react'
import { Alert, Box, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import type { EarlyStoneReturnPayload, StageEntry } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { CrudDialogShell, FormQtyField, FormRow, FormSelect, FormTextField } from '../components/ui'
import { stoneReturnPreview } from './stoneReturn'

type Values = { materialId: string; weight: string; note: string }

/**
 * Thủ kho nhận lại túi đá thợ trả giữa khâu Vào đá — đá không vừa sản phẩm, thợ đổi size. Cân cả
 * túi trả: phần trả theo tỷ lệ TL nhả khỏi giữ chỗ ngay (cấp được cho việc khác), không còn tính
 * là đá đã phát cho thợ. Thợ xin túi size mới bằng "Xin xuất NVL" như thường.
 */
export function EarlyStoneReturnDialog({
  entry,
  ticketCode,
  saving,
  onClose,
  onSave,
}: {
  entry: StageEntry | null
  ticketCode: string
  saving: boolean
  onClose: () => void
  onSave: (payload: EarlyStoneReturnPayload) => void
}) {
  const lines = (entry?.stoneLines ?? []).filter((line) => Number(line.weight) > 0)
  const form = useForm<Values>({ defaultValues: { materialId: '', weight: '', note: '' } })
  // Chỉ điền lại khi mở cho một khâu khác — đơn tải lại giữa chừng không xoá số đang nhập.
  const entryId = entry?.id
  const onlyMaterial = lines.length === 1 ? lines[0].materialId : ''
  useEffect(() => {
    if (entryId) form.reset({ materialId: onlyMaterial, weight: '', note: '' })
  }, [entryId, onlyMaterial, form])

  const [materialId, weight] = useWatch({ control: form.control, name: ['materialId', 'weight'] })
  const line = lines.find((item) => item.materialId === materialId)
  const returned = Number(weight) || 0
  const preview = line && returned > 0 ? stoneReturnPreview(line, returned) : null
  const backQty = line && preview ? Math.max(0, Number(line.qty) - preview.usedQty) : null
  const title = `Nhận lại túi đá · phiếu ${ticketCode}`

  return (
    <CrudDialogShell<Values>
      open={entry != null}
      kind="create"
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={(values) =>
        onSave({ materialId: values.materialId, weight: values.weight, note: values.note.trim() || undefined })
      }
      saving={saving}
      submitLabel="Nhận lại vào kho"
      maxWidth="sm"
      onClose={onClose}
      onExited={() => undefined}
    >
      <Alert severity="info" sx={{ mt: 1 }}>
        Cân cả túi đá thợ trả.
      </Alert>
      <FormRow columns={1}>
        <FormSelect<Values>
          name="materialId"
          label="Túi đá thợ trả"
          required
          options={lines.map((item) => ({
            value: item.materialId,
            label: `${[item.sku, item.name].filter(Boolean).join(' · ')} — đang giữ ${formatQty(item.qty)} ${item.unit}, ${formatQty(item.weight ?? '0')} g`,
          }))}
        />
      </FormRow>
      <FormRow columns={2}>
        <FormQtyField<Values>
          name="weight"
          label="TL túi đá trả (g)"
          required
          helperText={line ? `Tối đa ${formatQty(line.weight ?? '0')} g đang giữ` : undefined}
          rules={{
            validate: (value) => {
              if (!(Number(value) > 0)) return 'Cân túi đá trả'
              if (line && Number(value) > Number(line.weight)) return `Không quá ${formatQty(line.weight ?? '0')} g`
              return true
            },
          }}
        />
        <Box sx={{ alignSelf: 'center' }}>
          {line && preview && backQty != null ? (
            <Typography variant="body2">
              Về kho ≈ <b>{formatQty(String(Math.round(backQty * 10_000) / 10_000))} {line.unit}</b>
              {preview.returnedCount != null ? ` (${preview.returnedCount} viên)` : ''} · thợ còn giữ{' '}
              {formatQty(String(preview.usedQty))} {line.unit}
            </Typography>
          ) : null}
        </Box>
      </FormRow>
      <FormTextField<Values> name="note" label="Ghi chú (vd: đổi sang size 1.3)" multiline minRows={1} maxRows={3} />
    </CrudDialogShell>
  )
}
