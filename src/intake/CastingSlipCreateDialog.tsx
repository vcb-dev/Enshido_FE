import { useEffect, useMemo, useState } from 'react'
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
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import {
  listCastingSlipCandidatesApi,
  type CastingSlipCandidate,
  type CreateCastingSlipPayload,
} from '../api/castingSlips'
import { formatQty, parseQtyInput } from '../api/inventory'
import { confirmWeights, ratioWarning } from '../orders/weightSanity'
import { QtyTextField } from '../components/ui/QtyTextField'
import { useIsMobile } from '../hooks/useBreakpoint'
import { formatDateShort } from '../orders/catalog'

function todayIsoDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Ô gram không bắt buộc: trống = undefined, sai định dạng = NaN. */
function optionalGram(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = parseQtyInput(value.trim())
  const n = parsed ? Number(parsed) : NaN
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

/**
 * Bước 7: thủ kho lọc các đơn đã có sáp (E), gom vào một lần đúc, nhập bạc + hội cấp theo
 * định mức và chụp ảnh phiếu + vật tư. Lưu xong các đơn sang Chờ đúc (F) và mở trang in phiếu.
 */
export function CastingSlipCreateDialog({
  open,
  preselectId,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  /** Mở từ nút "Lên lệnh đúc" trên một dòng đơn — tích sẵn đơn đó. */
  preselectId?: string | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CreateCastingSlipPayload) => void
}) {
  const fullScreen = useIsMobile()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Map<string, CastingSlipCandidate>>(new Map())
  const [slipDate, setSlipDate] = useState(todayIsoDate)
  const [s999, setS999] = useState('')
  const [hoi, setHoi] = useState('')
  const [s925, setS925] = useState('')
  const [error, setError] = useState('')

  const candidates = useQuery({
    queryKey: ['casting-slip-candidates', search],
    queryFn: () => listCastingSlipCandidatesApi(search),
    enabled: open,
    staleTime: 5_000,
  })

  useEffect(() => {
    if (!open) return
    setSearch('')
    setSelected(new Map())
    setSlipDate(todayIsoDate())
    setS999('')
    setHoi('')
    setS925('')
    setError('')
  }, [open])

  // Tích sẵn đơn được mở từ dòng Lệnh sản xuất khi danh sách tải về.
  useEffect(() => {
    if (!open || !preselectId || !candidates.data) return
    const row = candidates.data.find((item) => item.id === preselectId)
    if (!row) return
    setSelected((prev) => (prev.has(row.id) ? prev : new Map(prev).set(row.id, row)))
  }, [open, preselectId, candidates.data])

  const rows = candidates.data ?? []
  const picked = [...selected.values()]
  const waxTotal = useMemo(
    () => picked.reduce((sum, row) => sum + Number(row.waxWeightGram ?? 0), 0),
    [picked],
  )
  const issueParts = [s999, hoi, s925].map(optionalGram)
  const issueTotal = issueParts.reduce<number>((sum, n) => sum + (n != null && !Number.isNaN(n) ? n : 0), 0)
  const allVisibleChecked = rows.length > 0 && rows.every((row) => selected.has(row.id))

  function toggle(row: CastingSlipCandidate, checked: boolean) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (checked) next.set(row.id, row)
      else next.delete(row.id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Map(prev)
      for (const row of rows) {
        if (checked) next.set(row.id, row)
        else next.delete(row.id)
      }
      return next
    })
  }

  function submit() {
    if (!picked.length) return setError('Chọn ít nhất một đơn đi đúc')
    if (issueParts.some((n) => n != null && Number.isNaN(n))) return setError('Số gram giao không hợp lệ')
    if (!(issueTotal > 0)) return setError('Nhập số gram bạc / hội / S925 cấp cho lần đúc')
    setError('')
    // Bạc nặng khoảng 10–11 lần sáp cùng thể tích: lệch quá xa là nhầm đơn vị / dấu chấm.
    if (
      !confirmWeights([
        ratioWarning(issueTotal, 'Tổng giao', waxTotal, 'sáp giao', {
          min: 1,
          max: 100,
          note: 'bạc thường nặng khoảng 10 lần sáp',
        }),
      ])
    ) {
      return
    }
    onSave({
      slipDate,
      intakeOrderIds: picked.map((row) => row.id),
      issueS999Gram: issueParts[0],
      issueMasterAlloyGram: issueParts[1],
      issueS925Gram: issueParts[2],
    })
  }

  const busy = saving
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle>Lên phiếu đúc</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Chọn các đơn <strong>đã có sáp</strong> đi chung một lần đúc và nhập bạc + hội cấp theo định mức. Lưu xong
            mở trang <strong>in phiếu</strong>; cấp vật tư theo phiếu rồi chụp ảnh phiếu + vật tư ở bước kế tiếp để
            đơn sang <strong>Chờ đúc</strong>.
          </Typography>

          <TextField
            size="small"
            label="Lọc đơn chờ đúc"
            placeholder="Mã đơn / mã SX / mã sản phẩm / tên…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Table size="small" sx={{ '& td, & th': { px: 1 } }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={allVisibleChecked}
                    indeterminate={!allVisibleChecked && rows.some((row) => selected.has(row.id))}
                    onChange={(event) => toggleAll(event.target.checked)}
                    disabled={!rows.length}
                  />
                </TableCell>
                <TableCell>Mã đơn</TableCell>
                <TableCell>Mã SP</TableCell>
                <TableCell>Sản phẩm</TableCell>
                <TableCell align="right">SL</TableCell>
                <TableCell align="right">TL sáp (g)</TableCell>
                <TableCell>Cần trả</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover onClick={() => toggle(row, !selected.has(row.id))} sx={{ cursor: 'pointer' }}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={selected.has(row.id)} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{row.code}</TableCell>
                  <TableCell>{row.trackingCode ?? '—'}</TableCell>
                  <TableCell>{row.productName || '—'}</TableCell>
                  <TableCell align="right">{row.qty}</TableCell>
                  <TableCell align="right">{row.waxWeightGram ? formatQty(row.waxWeightGram) : '—'}</TableCell>
                  <TableCell>{row.dueDate ? formatDateShort(row.dueDate) : '—'}</TableCell>
                </TableRow>
              ))}
              {!rows.length ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 2 }}>
                    {candidates.isFetching ? 'Đang tải…' : 'Không có đơn nào đã có sáp chờ đúc'}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Typography variant="body2">
            Đã chọn <strong>{picked.length}</strong> đơn · Trọng lượng sáp (cây thông) giao:{' '}
            <strong>{formatQty(String(waxTotal))} g</strong>
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="date"
              label="Ngày phiếu"
              value={slipDate}
              onChange={(event) => setSlipDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 170 }}
            />
            <QtyTextField label="Bạc S999 giao (g)" value={s999} onChange={setS999} size="small" fullWidth disabled={busy} />
            <QtyTextField label="Hội giao (g)" value={hoi} onChange={setHoi} size="small" fullWidth disabled={busy} />
            <QtyTextField label="S925 giao (g)" value={s925} onChange={setS925} size="small" fullWidth disabled={busy} />
          </Stack>
          <Typography variant="body2">
            Tổng giao: <strong>{formatQty(String(issueTotal))} g</strong>
          </Typography>

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Hủy
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {saving ? 'Đang lưu…' : `Lưu và in phiếu (${picked.length} đơn)`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
