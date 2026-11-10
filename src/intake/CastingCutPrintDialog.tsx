import {
  Alert,
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
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PrintIcon from '@mui/icons-material/Print'
import type { CastingSlip } from '../api/castingSlips'
import { cutProductionOrderCodes, productionBatchPrintUrl } from '../casting/castingCuts'

/**
 * Hiện ngay sau khi lưu cắt cây thông: báo các đơn đã sang Chờ nguội và mời in luôn phiếu sản
 * xuất (phiếu tổng) của các đơn đó. Nút in mở tab in mới — phải là cú bấm của người dùng thì
 * trình duyệt mới không chặn tab.
 */
export function CastingCutPrintDialog({ slips, onClose }: { slips: CastingSlip[]; onClose: () => void }) {
  const codes = cutProductionOrderCodes(slips)
  const lines = slips.flatMap((slip) =>
    slip.orders.filter((line) => line.productionOrderCode).map((line) => ({ slip: slip.code, line })),
  )

  return (
    <Dialog open={slips.length > 0} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CheckCircleIcon color="success" />
          <span>Đã cắt cây thông</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            {slips.length > 1 ? `${slips.length} phiếu đúc · ` : `Phiếu ${slips[0]?.code ?? ''} · `}
            <strong>{codes.length} đơn</strong> đã chuyển <strong>Chờ nguội</strong>. In phiếu sản xuất để kẹp
            theo hàng ngay bây giờ?
          </Typography>
          {lines.length ? (
            <Table size="small" sx={{ '& td, & th': { px: 1 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Mã SX</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Mã đơn hàng</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Sản phẩm</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    SL
                  </TableCell>
                  {slips.length > 1 ? <TableCell sx={{ fontWeight: 700 }}>Phiếu đúc</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map(({ slip, line }) => (
                  <TableRow key={`${slip}:${line.intakeOrderId}`}>
                    <TableCell sx={{ fontWeight: 700 }}>{line.sxCode || '—'}</TableCell>
                    <TableCell>{line.code}</TableCell>
                    <TableCell>{line.productName || '—'}</TableCell>
                    <TableCell align="right">{line.qty}</TableCell>
                    {slips.length > 1 ? <TableCell>{slip}</TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
          <Alert severity="info" variant="outlined">
            Đây là phiếu tổng, chưa có mã QR. Phiếu con có QR cho thợ quét sẽ in khi giao Nguội. Cần in lại
            thì bấm <strong>In phiếu SX</strong> ở dòng phiếu đúc.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Để sau</Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          autoFocus
          disabled={!codes.length}
          href={productionBatchPrintUrl(codes)}
          target="_blank"
          rel="noopener"
          onClick={onClose}
        >
          In phiếu sản xuất ({codes.length})
        </Button>
      </DialogActions>
    </Dialog>
  )
}
