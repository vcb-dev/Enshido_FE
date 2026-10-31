import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useWatch } from 'react-hook-form'
import { useAppForm } from '../components/ui/form/useAppForm'
import type { CastingSlip, CastingSlipOrderLine, CastingSlipResultPayload } from '../api/castingSlips'
import type { OrderImage } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { DialogForm, FormMoneyField, FormQtyField } from '../components/ui'
import { FormImageField } from '../orders/FormImageField'

type SlipForResult = Pick<CastingSlip, 'id' | 'code' | 'issueTotalGram' | 'waxWeightGram'> & {
  isServiceCast?: boolean
  orders?: Array<Pick<CastingSlipOrderLine, 'intakeOrderId' | 'code' | 'productName' | 'qty'>>
}

type Props = {
  slip: SlipForResult | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CastingSlipResultPayload) => void
}

type Values = {
  tree: string
  silver: string
  plaster: string
  servicePrices: Record<string, string>
  images: OrderImage[]
}

function emptyValues(slip: SlipForResult | null): Values {
  return {
    tree: '',
    silver: '',
    plaster: '',
    servicePrices: Object.fromEntries((slip?.orders ?? []).map((line) => [line.intakeOrderId, ''])),
    images: [],
  }
}

/** Số gram đã chuẩn hoá từ FormQtyField; `null` khi trống / âm (hoặc bằng 0 nếu không cho phép). */
function gram(raw: string, allowZero: boolean) {
  const value = raw.trim() ? Number(raw) : NaN
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value <= 0)) return null
  return value
}

function money(raw: string) {
  if (!raw.trim()) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

/** Bước 9: nhập kết quả sau đúc — ảnh cân cây thông, bạc, và thạch cao hoặc đơn giá dịch vụ. */
export function CastingSlipResultDialog({ slip, saving, onClose, onSave }: Props) {
  const [uploading, setUploading] = useState(false)
  const form = useAppForm<Values>({ defaultValues: emptyValues(null), mode: 'onChange' })
  const isServiceCast = Boolean(slip?.isServiceCast)
  const orders = slip?.orders ?? []

  useEffect(() => {
    if (slip) form.reset(emptyValues(slip))
  }, [slip, form])

  const busy = saving || uploading
  const issued = Number(slip?.issueTotalGram ?? 0)
  // Xem trước hao hụt ngay khi nhập đủ hai số.
  const [tree, silver] = useWatch({ control: form.control, name: ['tree', 'silver'] })
  // Cây thông phụ thuộc bạc đã dùng: sửa ô kia thì kiểm lại ngay, không đợi bấm Lưu.
  useEffect(() => {
    if (form.getFieldState('tree').isDirty) void form.trigger('tree')
    if (form.getFieldState('silver').isDirty) void form.trigger('silver')
  }, [tree, silver, form])
  const previewTree = gram(tree, false)
  const previewUsed = gram(silver, true)
  const preview =
    previewTree != null && previewUsed != null && previewUsed > 0
      ? {
          loss: Math.round((previewUsed - previewTree) * 10000) / 10000,
          percent: ((previewUsed - previewTree) / previewUsed) * 100,
          leftover: Math.max(0, Math.round((issued - previewUsed) * 10000) / 10000),
        }
      : null
  return (
    <Dialog open={Boolean(slip)} onClose={busy ? undefined : onClose} maxWidth={isServiceCast ? 'md' : 'sm'} fullWidth>
      <DialogTitle>Kết quả đúc — {slip?.code ?? ''}</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={(values) =>
          onSave({
            castTreeWeightGram: gram(values.tree, false)!,
            silverUsedGram: gram(values.silver, true)!,
            ...(isServiceCast
              ? {
                  servicePrices: orders.map((line) => ({
                    intakeOrderId: line.intakeOrderId,
                    serviceUnitPrice: money(values.servicePrices[line.intakeOrderId] ?? '')!,
                  })),
                }
              : { plasterUsedGram: gram(values.plaster, true)! }),
            images: values.images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height })),
          })
        }
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {issued > 0 ? (
              <Typography variant="body2">
                Tổng vật tư giao: <strong>{formatQty(String(issued))} g</strong>
              </Typography>
            ) : null}
            <FormQtyField<Values>
              name="tree"
              label="TL cây thông sau đúc — Trả (g)"
              required
              rules={{
                validate: (value, values) => {
                  const treeGram = gram(String(value ?? ''), false)
                  if (treeGram == null) return 'Nhập trọng lượng cây thông sau đúc (g)'
                  const used = gram(values.silver, true)
                  // Giao ≥ bạc đã dùng ≥ cây thông sau đúc — khớp BE.
                  if (used != null && treeGram > used) {
                    const over = Math.round((treeGram - used) * 10000) / 10000
                    return `TL cây thông sau đúc nặng hơn bạc đã dùng ${formatQty(String(over))} g (cây ${formatQty(String(treeGram))} g, bạc đã dùng ${formatQty(String(used))} g)`
                  }
                  return true
                },
              }}
              size="small"
              fullWidth
              disabled={busy}
            />
            <FormQtyField<Values>
              name="silver"
              label="Bạc đã dùng (g)"
              required
              rules={{
                validate: (value) => {
                  const used = gram(String(value ?? ''), true)
                  if (used == null) return 'Nhập trọng lượng bạc đã dùng (g)'
                  if (issued > 0 && used > issued) {
                    return `Bạc đã dùng vượt tổng vật tư giao (${formatQty(String(issued))} g)`
                  }
                  return true
                },
              }}
              size="small"
              fullWidth
              disabled={busy}
            />
            {isServiceCast ? (
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Đơn giá dịch vụ từng đơn
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Bắt buộc nhập đơn giá dịch vụ cho từng đơn trong lô.
                </Typography>
                <TableContainer sx={{ maxHeight: 280, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Mã đơn</TableCell>
                        <TableCell>Sản phẩm</TableCell>
                        <TableCell align="right">SL</TableCell>
                        <TableCell>Đơn giá dịch vụ (đ)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((line) => (
                        <TableRow key={line.intakeOrderId}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{line.code}</TableCell>
                          <TableCell>{line.productName}</TableCell>
                          <TableCell align="right">{line.qty}</TableCell>
                          <TableCell sx={{ minWidth: 180 }}>
                            <FormMoneyField<Values>
                              name={`servicePrices.${line.intakeOrderId}`}
                              label="Đơn giá"
                              required
                              rules={{
                                validate: (value) =>
                                  money(String(value ?? '')) == null ? 'Nhập đơn giá dịch vụ' : true,
                              }}
                              size="small"
                              fullWidth
                              disabled={busy}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            ) : (
              <FormQtyField<Values>
                name="plaster"
                label="Thạch cao đã dùng (g)"
                required
                rules={{
                  validate: (value) =>
                    gram(String(value ?? ''), true) == null ? 'Nhập trọng lượng thạch cao đã dùng (g)' : true,
                }}
                size="small"
                fullWidth
                disabled={busy}
              />
            )}
            {preview ? (
              <Typography variant="body2" color={preview.loss < 0 ? 'error' : undefined}>
                Hao hụt đúc: <strong>{formatQty(String(preview.loss))} g</strong> ({preview.percent.toFixed(2)}%) · Bạc
                giao chưa dùng (trả kho): <strong>{formatQty(String(preview.leftover))} g</strong>
              </Typography>
            ) : null}
            <FormImageField<Values>
              name="images"
              label="Ảnh cân cây thông sau đúc"
              kind="CASTING_TREE"
              required
              requiredMessage="Chụp ảnh cân cây thông sau đúc"
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
