import { useState } from 'react'
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
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { getCastingLossReportApi } from '../api/castingSlips'
import { formatQty } from '../api/inventory'
import { useIsMobile } from '../hooks/useBreakpoint'
import { formatDateTime } from '../orders/catalog'

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const g = (value: string | null) => (value == null ? '—' : formatQty(value))

/** Hao hụt đúc theo thợ và theo từng phiếu — phiếu thủ kho đã cắt cây thông. */
export function CastingLossDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fullScreen = useIsMobile()
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const report = useQuery({
    queryKey: ['casting-loss', from, to],
    queryFn: () => getCastingLossReportApi({ from, to }),
    enabled: open,
    staleTime: 0,
  })
  const workers = report.data?.workers ?? []
  const slips = report.data?.slips ?? []

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle>Hao hụt đúc theo thợ</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Hao hụt = bạc đã dùng − cây thông sau đúc. Chỉ tính phiếu thủ kho đã cắt cây thông, theo ngày cắt cây.
          </Typography>
          <Stack direction="row" spacing={2}>
            <TextField size="small" type="date" label="Từ ngày" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="date" label="Đến ngày" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Thợ đúc</TableCell>
                <TableCell align="right">Số phiếu</TableCell>
                <TableCell align="right">Giao (g)</TableCell>
                <TableCell align="right">Bạc đã dùng (g)</TableCell>
                <TableCell align="right">Cây sau đúc (g)</TableCell>
                <TableCell align="right">Hao hụt (g)</TableCell>
                <TableCell align="right">%</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workers.map((row) => (
                <TableRow key={row.workerUserId ?? row.workerName}>
                  <TableCell sx={{ fontWeight: 700 }}>{row.workerName}</TableCell>
                  <TableCell align="right">{row.slipCount}</TableCell>
                  <TableCell align="right">{g(row.issuedGram)}</TableCell>
                  <TableCell align="right">{g(row.usedGram)}</TableCell>
                  <TableCell align="right">{g(row.castTreeGram)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{g(row.lossGram)}</TableCell>
                  <TableCell align="right">{row.lossPercent ?? '—'}</TableCell>
                </TableRow>
              ))}
              {!workers.length ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 2 }}>
                    {report.isFetching ? 'Đang tải…' : 'Chưa có phiếu đúc xong trong khoảng này'}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {slips.length ? (
            <>
              <Typography variant="subtitle2">Theo từng phiếu</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Phiếu</TableCell>
                    <TableCell>Xác nhận</TableCell>
                    <TableCell>Thợ đúc</TableCell>
                    <TableCell align="right">Giao (g)</TableCell>
                    <TableCell align="right">Trả kho (g)</TableCell>
                    <TableCell align="right">Hao hụt (g)</TableCell>
                    <TableCell align="right">%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {slips.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell sx={{ fontWeight: 700 }}>{row.code}</TableCell>
                      <TableCell>{row.confirmedAt ? formatDateTime(row.confirmedAt) : '—'}</TableCell>
                      <TableCell>{row.workerName ?? '—'}</TableCell>
                      <TableCell align="right">{g(row.issuedGram)}</TableCell>
                      <TableCell align="right">{g(row.leftoverGram)}</TableCell>
                      <TableCell align="right">{g(row.castLossGram)}</TableCell>
                      <TableCell align="right">{row.castLossPercent ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  )
}
