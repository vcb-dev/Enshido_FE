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
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { listIntakeOrdersApi, type IntakeOrder } from '../api/intakeOrders'
import type { OrderImage } from '../api/productionOrders'
import { DialogForm, FormQtyField } from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'
import { FormImageField } from '../orders/FormImageField'

type Payload = { items: { id: string; productWeightGram: number }[]; images: OrderImage[] }

/** Theo id đơn: có tích in trong khay không và cân nặng sản phẩm của đơn. */
type Values = { rows: Record<string, { checked: boolean; weight: string }>; images: OrderImage[] }

const EMPTY: Values = { rows: {}, images: [] }

/**
 * Bước 4: thợ 3D in sáp nhiều đơn một lần — chụp ảnh cả khay, rồi tách cân nặng từng đơn.
 * Chỉ đơn Chờ SX · Đã có 3D (C) và không có khuôn (đơn có khuôn đi bước Bơm sáp).
 */
export function WaxPrintBatchDialog({
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
  const form = useForm<Values>({ defaultValues: EMPTY })

  const list = useQuery({
    queryKey: ['intake-orders', 'wax-print-candidates'],
    queryFn: () => listIntakeOrdersApi({ status: 'READY_FOR_PRODUCTION', page: 1, pageSize: 200 }),
    enabled: open,
    staleTime: 0,
  })
  const rows: IntakeOrder[] = (list.data?.items ?? []).filter((row) => row.hasMold !== true)

  useEffect(() => {
    if (open) form.reset(EMPTY)
  }, [open, form])

  const picked = useWatch({ control: form.control, name: 'rows' })
  const selectedIds = rows.filter((row) => picked?.[row.id]?.checked).map((row) => row.id)
  const rootError = form.formState.errors.root?.message
  const hasSelection = selectedIds.length > 0
  useEffect(() => {
    if (hasSelection) form.clearErrors('root')
  }, [hasSelection, form])

  function submit(values: Values) {
    if (!selectedIds.length) {
      form.setError('root', { message: 'Chọn các đơn vừa in trong khay' })
      return
    }
    onSave({
      items: selectedIds.map((id) => ({ id, productWeightGram: Number(values.rows[id].weight) })),
      images: values.images,
    })
  }

  const busy = saving || uploading
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle>In sáp nhiều đơn</DialogTitle>
      <DialogForm form={form} onSubmit={submit}>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Tích các đơn cùng khay, nhập cân nặng từng đơn.
            </Typography>
            <Table size="small" sx={{ '& td, & th': { px: 1 } }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Mã đơn</TableCell>
                  <TableCell>Mã SP</TableCell>
                  <TableCell>Sản phẩm</TableCell>
                  <TableCell align="right">SL</TableCell>
                  <TableCell sx={{ width: 180 }}>Cân nặng sản phẩm (g)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const checked = Boolean(picked?.[row.id]?.checked)
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell padding="checkbox">
                        <Controller
                          control={form.control}
                          name={`rows.${row.id}.checked`}
                          render={({ field }) => (
                            <Checkbox size="small" checked={Boolean(field.value)} onChange={(_, next) => field.onChange(next)} />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{row.code}</TableCell>
                      <TableCell>{row.trackingCode ?? '—'}</TableCell>
                      <TableCell>{row.productName || '—'}</TableCell>
                      <TableCell align="right">{row.qty}</TableCell>
                      <TableCell>
                        <FormQtyField<Values>
                          name={`rows.${row.id}.weight`}
                          label=""
                          size="small"
                          fullWidth
                          disabled={!checked || busy}
                          rules={{
                            validate: (value, values) =>
                              !values.rows[row.id]?.checked || Number(value) > 0
                                ? true
                                : `Nhập cân nặng sản phẩm của đơn ${row.code}`,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!rows.length ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 2 }}>
                      {list.isFetching ? 'Đang tải…' : 'Không có đơn nào chờ in sáp'}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <FormImageField<Values>
              name="images"
              label="Ảnh cả khay sáp"
              kind="PRODUCT"
              required
              requiredMessage="Chụp ảnh cả khay sáp"
              onUploadingChange={setUploading}
              readOnly={saving}
            />
            {rootError ? <Alert severity="error">{rootError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {saving ? 'Đang lưu…' : `Lưu (${selectedIds.length} đơn)`}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
