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
import { listIntakeOrdersApi, type IntakeOrder } from '../api/intakeOrders'
import { parseQtyInput } from '../api/inventory'
import type { OrderImage } from '../api/productionOrders'
import { QtyTextField } from '../components/ui/QtyTextField'
import { useIsMobile } from '../hooks/useBreakpoint'
import { ImageUploadField } from '../orders/ImageUploadField'

type Payload = { items: { id: string; productWeightGram: number }[]; images: OrderImage[] }

/**
 * Bước 4: thợ 3D in sáp nhiều đơn một lần — chụp ảnh cả khay, rồi tách cân nặng từng đơn.
 * Chỉ đơn Chờ SX · Đã có 3D / khuôn (C) và không có khuôn (đơn có khuôn đi bước Bơm sáp).
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
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [images, setImages] = useState<OrderImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const list = useQuery({
    queryKey: ['intake-orders', 'wax-print-candidates'],
    queryFn: () => listIntakeOrdersApi({ status: 'READY_FOR_PRODUCTION', page: 1, pageSize: 200 }),
    enabled: open,
    staleTime: 0,
  })
  const rows: IntakeOrder[] = (list.data?.items ?? []).filter((row) => row.hasMold !== true)

  useEffect(() => {
    if (!open) return
    setWeights({})
    setSelected(new Set())
    setImages([])
    setError('')
  }, [open])

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function submit() {
    const ids = rows.filter((row) => selected.has(row.id)).map((row) => row.id)
    if (!ids.length) return setError('Chọn các đơn vừa in trong khay')
    const items: Payload['items'] = []
    for (const id of ids) {
      const parsed = parseQtyInput((weights[id] ?? '').trim())
      const grams = parsed ? Number(parsed) : NaN
      if (!Number.isFinite(grams) || grams <= 0) {
        const code = rows.find((row) => row.id === id)?.code ?? ''
        return setError(`Nhập cân nặng sản phẩm của đơn ${code}`)
      }
      items.push({ id, productWeightGram: grams })
    }
    if (!images.length) return setError('Chụp ảnh cả khay sáp')
    setError('')
    onSave({ items, images })
  }

  const busy = saving || uploading
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle>In sáp nhiều đơn</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Tích các đơn vừa in chung một khay, chụp ảnh cả khay, rồi tách cân nặng sản phẩm từng đơn. Lưu xong
            các đơn sang <strong>Chờ SX · Đã in sáp</strong>.
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
                const checked = selected.has(row.id)
                return (
                  <TableRow key={row.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked} onChange={(event) => toggle(row.id, event.target.checked)} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{row.code}</TableCell>
                    <TableCell>{row.trackingCode ?? '—'}</TableCell>
                    <TableCell>{row.productName || '—'}</TableCell>
                    <TableCell align="right">{row.qty}</TableCell>
                    <TableCell>
                      <QtyTextField
                        label=""
                        size="small"
                        fullWidth
                        value={weights[row.id] ?? ''}
                        disabled={!checked || busy}
                        onChange={(next) => setWeights((prev) => ({ ...prev, [row.id]: next }))}
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
          <ImageUploadField
            label="Ảnh cả khay sáp"
            kind="PRODUCT"
            value={images}
            onChange={setImages}
            onUploadingChange={setUploading}
            readOnly={saving}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Hủy
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {saving ? 'Đang lưu…' : `Lưu (${selected.size} đơn)`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
