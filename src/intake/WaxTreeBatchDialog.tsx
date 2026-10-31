import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
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
import { useQuery } from '@tanstack/react-query'
import { Controller, useWatch } from 'react-hook-form'
import { useAppForm } from '../components/ui/form/useAppForm'
import { listIntakeOrdersApi, ORDER_METAL_TYPE_LABELS, type IntakeOrder } from '../api/intakeOrders'
import { formatQty } from '../api/inventory'
import type { OrderImage } from '../api/productionOrders'
import { DialogForm, FormQtyField, FormTextField } from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'
import { confirmWeights, ratioWarning } from '../orders/weightSanity'
import { FormImageField } from '../orders/FormImageField'
import { RequestTypeChip } from '../orders/OrderChips'

type Payload = {
  orderIds: string[]
  lines?: Array<{ orderId: string; produceQty?: number }>
  castingTreeWeightGram: number
  images: OrderImage[]
}

type Values = {
  rows: Record<string, boolean>
  produceQty: Record<string, string>
  weight: string
  images: OrderImage[]
}

const EMPTY: Values = { rows: {}, produceQty: {}, weight: '', images: [] }

function intQty(raw: string) {
  const value = raw.trim() ? Number(raw) : NaN
  if (!Number.isInteger(value) || value < 1) return null
  return value
}

/**
 * Cấy nhiều đơn cùng một cây thông: tích đơn Chờ SX · Đã in sáp, cân cả cây, chụp ảnh cây.
 * Đơn SX SLL bắt buộc nhập số lượng làm lần này — phần còn lại giữ Chờ SX.
 */
export function WaxTreeBatchDialog({
  open,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  saving: boolean
  onClose: () => void
  onSave: (payload: Payload) => void
}) {
  const fullScreen = useIsMobile()
  const [uploading, setUploading] = useState(false)
  const form = useAppForm<Values>({ defaultValues: EMPTY })

  const list = useQuery({
    queryKey: ['intake-orders', 'wax-tree-candidates'],
    queryFn: () =>
      listIntakeOrdersApi({ status: 'WAX_PRINTED', includeChildren: true, page: 1, pageSize: 200 }),
    enabled: open,
    staleTime: 0,
  })
  const rows: IntakeOrder[] = list.data?.items ?? []

  useEffect(() => {
    if (open) form.reset(EMPTY)
  }, [open, form])

  const picked = useWatch({ control: form.control, name: 'rows' })
  const produceQty = useWatch({ control: form.control, name: 'produceQty' })
  const selected = rows.filter((row) => picked?.[row.id])
  const selectedBulk = selected.filter((row) => row.requestType === 'BULK')
  const rootError = form.formState.errors.root?.message
  const hasSelection = selected.length > 0
  useEffect(() => {
    if (hasSelection) form.clearErrors('root')
  }, [hasSelection, form])

  async function submit(values: Values) {
    if (!selected.length) {
      form.setError('root', { message: 'Chọn các đơn cùng cây thông' })
      return
    }
    const grams = Number(values.weight)
    const printedSum = selected.reduce((sum, row) => {
      const leftover = row.remainingQty ?? Math.max(0, row.qty - (row.waxReleasedQty ?? 0))
      const produce =
        row.requestType === 'BULK' ? intQty(values.produceQty[row.id] ?? '') ?? leftover : row.qty
      const wax = Number(row.productWeightGram ?? 0)
      if (wax > 0 && row.qty > 0) return sum + (wax * produce) / row.qty
      return sum + produce
    }, 0)
    if (
      !(await confirmWeights([
        ratioWarning(grams, 'Cây thông', printedSum, 'tổng mẫu sáp đã in', { min: 0.5, max: 100 }),
      ]))
    ) {
      return
    }
    onSave({
      orderIds: selected.map((row) => row.id),
      lines: selected.map((row) => ({
        orderId: row.id,
        ...(row.requestType === 'BULK'
          ? { produceQty: intQty(values.produceQty[row.id] ?? '') ?? undefined }
          : {}),
      })),
      castingTreeWeightGram: grams,
      images: values.images,
    })
  }

  const busy = saving || uploading
  const headCell = { bgcolor: 'background.paper' } as const
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="lg"
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            maxHeight: '90dvh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        },
      }}
    >
      <DialogTitle sx={{ flexShrink: 0 }}>Cấy cây thông</DialogTitle>
      <DialogForm form={form} onSubmit={submit}>
        <DialogContent
          dividers
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflow: 'hidden',
            minHeight: 0,
            flex: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
            Tích các đơn đang Chờ SX · Đã in sáp cùng một cây. Nhập trọng lượng cả cây — hệ thống chia theo TL
            sáp từng đơn. Đơn SX SLL phải nhập số lượng làm lần này.
          </Typography>
          <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Table size="small" stickyHeader sx={{ '& td, & th': { px: 1 } }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={headCell} />
                  <TableCell sx={headCell}>Mã SX</TableCell>
                  <TableCell sx={headCell}>Mã đơn</TableCell>
                  <TableCell sx={headCell}>Loại đơn</TableCell>
                  <TableCell sx={headCell}>Mã SP</TableCell>
                  <TableCell sx={headCell}>Sản phẩm</TableCell>
                  <TableCell sx={headCell}>Vàng/bạc</TableCell>
                  <TableCell align="right" sx={headCell}>
                    SL
                  </TableCell>
                  <TableCell align="right" sx={headCell}>
                    TL sáp (g)
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell padding="checkbox">
                      <Controller
                        control={form.control}
                        name={`rows.${row.id}`}
                        render={({ field }) => (
                          <Checkbox
                            size="small"
                            checked={Boolean(field.value)}
                            onChange={(_, next) => field.onChange(next)}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{row.sxCode || '—'}</TableCell>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>
                      <RequestTypeChip type={row.requestType} />
                    </TableCell>
                    <TableCell>{row.trackingCode ?? '—'}</TableCell>
                    <TableCell>{row.productName || '—'}</TableCell>
                    <TableCell>{row.metalType ? ORDER_METAL_TYPE_LABELS[row.metalType] : '—'}</TableCell>
                    <TableCell align="right">
                      {row.qty}
                      {(row.waxReleasedQty ?? 0) > 0 ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Đang đúc {row.waxReleasedQty} đơn
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">
                      {row.productWeightGram != null && row.productWeightGram !== ''
                        ? formatQty(row.productWeightGram)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 2 }}>
                      {list.isFetching ? 'Đang tải…' : 'Không có đơn nào chờ cấy cây thông'}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
          {selectedBulk.length ? (
            <Stack spacing={1.25} sx={{ flexShrink: 0, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Số đơn SX lần này (SX SLL)
              </Typography>
              {selectedBulk.map((row) => {
                const leftover = row.remainingQty ?? Math.max(0, row.qty - (row.waxReleasedQty ?? 0))
                const entered = intQty(produceQty?.[row.id] ?? '')
                const remainingAfter = entered != null ? Math.max(0, leftover - entered) : null
                return (
                  <FormTextField<Values>
                    key={row.id}
                    name={`produceQty.${row.id}`}
                    label={`Số đơn SX lần này — ${row.code} (tổng ${row.qty})`}
                    required
                    transform={(value) => value.replace(/\D/g, '')}
                    rules={{
                      validate: (value) => {
                        const qty = intQty(String(value ?? ''))
                        if (qty == null) return 'Nhập số đơn SX lần này'
                        if (qty > leftover) return `Không vượt số còn lại (${leftover})`
                        return true
                      },
                    }}
                    helperText={
                      remainingAfter == null
                        ? `Còn ${leftover}/${row.qty} chưa SX. Nhập số làm lần này.`
                        : remainingAfter === 0
                          ? `Làm hết số còn lại — không còn đơn chờ SX.`
                          : `Còn ${remainingAfter} đơn chưa SX (tổng ${row.qty}).`
                    }
                    size="small"
                    fullWidth
                    disabled={busy}
                    slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                  />
                )
              })}
            </Stack>
          ) : null}
          <FormQtyField<Values>
            name="weight"
            label="Trọng lượng cây thông (g)"
            required
            rules={{ validate: (value) => (Number(value) > 0 ? true : 'Nhập trọng lượng cây thông (gram)') }}
            helperText="VD: 1.250,5 — cân cả cây sau khi cấy"
            size="small"
            fullWidth
            disabled={busy}
          />
          <FormImageField<Values>
            name="images"
            label="Ảnh cây thông"
            kind="CASTING_TREE"
            required
            requiredMessage="Chụp ảnh cây thông"
            onUploadingChange={setUploading}
            readOnly={saving}
          />
          {rootError ? <Alert severity="error">{rootError}</Alert> : null}
        </DialogContent>
        <DialogActions sx={{ flexShrink: 0 }}>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {saving ? 'Đang lưu…' : `Lưu (${selected.length} đơn)`}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
