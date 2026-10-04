import {
  Alert,
  Box,
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
import type { StageEntry } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { formatDateShort, STAGE_LABEL } from './catalog'
import { stoneReturnPreview } from './stoneReturn'

const NUM = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as const

type Line = { label: string; qty: string; weight: string; warehouse: string; show: boolean }

/**
 * Thủ kho xác nhận sau khi KCS nhận lại khâu Nguội / Vào đá (mô tả luồng bước 13–15, 18). Bấm xác
 * nhận là hệ thống nhập kho: hàng đạt → kho BTP, hàng lỗi + nguyên liệu thừa → kho NVL; khâu Vào
 * đá còn xuất kho đá đã dùng theo từng mã (SL cấp × (TL gói cấp − TL gói thừa) / TL gói cấp).
 */
export function KeeperConfirmDialog({
  entry,
  ticketCode,
  saving,
  onClose,
  onConfirm,
}: {
  entry: StageEntry | null
  ticketCode: string
  saving: boolean
  onClose: () => void
  onConfirm: (entry: StageEntry) => void
}) {
  const stage = entry?.stage
  const stoneStage = stage === 'STONE_SETTING'
  const goodQty = entry?.returnedQty ?? 0
  const lines: Line[] = entry
    ? [
        {
          label: 'Hàng đạt',
          qty: `${goodQty} sp`,
          weight: formatQty(entry.returnedSilverWeight ?? '0'),
          warehouse: 'Kho BTP',
          show: goodQty > 0,
        },
        {
          label: 'Hàng lỗi',
          qty: `${entry.defectQty ?? 0} sp`,
          weight: formatQty(entry.btpRecoveredWeight ?? '0'),
          warehouse: 'Kho NVL (Bạc thu hồi / đầu cây S925)',
          show: (entry.defectQty ?? 0) > 0 || Number(entry.btpRecoveredWeight ?? 0) > 0,
        },
        {
          label: 'Nguyên liệu thừa S925',
          qty: '—',
          weight: formatQty(entry.silverRecoveredWeight ?? '0'),
          warehouse: 'Kho NVL (Bạc thu hồi / đầu cây S925)',
          show: Number(entry.silverRecoveredWeight ?? 0) > 0,
        },
        {
          label: 'Nguyên liệu thừa S999',
          qty: '—',
          weight: formatQty(entry.scrapS999Weight ?? '0'),
          warehouse: 'Kho NVL (Bạc S999 thu hồi)',
          show: Number(entry.scrapS999Weight ?? 0) > 0,
        },
      ]
    : []
  const visible = lines.filter((line) => line.show)
  const stoneUsed = entry && entry.stonesIn != null ? entry.stonesIn - (entry.returnedStoneCount ?? 0) : null

  return (
    <Dialog open={entry != null} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Thủ kho xác nhận — {stage ? STAGE_LABEL[stage] : ''} · phiếu {ticketCode}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
        {entry ? (
          <>
            <Box sx={{ p: 1.25, bgcolor: '#f8f3eb', borderRadius: 1 }}>
              <Typography variant="body2">
                Thợ <b>{entry.craftsmanName}</b> · giao {formatDateShort(entry.handedAt)} · SL giao{' '}
                <b>{entry.handedQty ?? '—'}</b> · bạc vào khâu <b>{entry.silverIn ? formatQty(entry.silverIn) : '—'}</b> g
              </Typography>
              <Typography variant="body2">
                KCS <b>{entry.returnedByName ?? '—'}</b> nhận lại {formatDateShort(entry.returnedAt)}
                {entry.silverLoss != null ? (
                  <>
                    {' '}
                    · hao hụt <b>{formatQty(entry.silverLoss)}</b> g
                    {entry.silverLossPercent != null ? ` (${formatQty(entry.silverLossPercent)}%)` : ''}
                  </>
                ) : null}
              </Typography>
            </Box>

            {entry.defectReportedAt ? (
              <Alert severity="error" sx={{ py: 0.25 }}>
                {entry.defectReportedByName ?? '—'} đã báo lỗi khâu này: {entry.defectNote}
              </Alert>
            ) : null}

            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Hàng sẽ nhập kho
            </Typography>
            {visible.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                KCS không ghi hàng nào để nhập kho.
              </Typography>
            ) : (
              <Table size="small" sx={{ '& td, & th': { px: 1, py: 0.5 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Loại</TableCell>
                    <TableCell sx={NUM}>SL</TableCell>
                    <TableCell sx={NUM}>TL (g)</TableCell>
                    <TableCell>Nhập vào</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.map((line) => (
                    <TableRow key={line.label}>
                      <TableCell>{line.label}</TableCell>
                      <TableCell sx={NUM}>{line.qty}</TableCell>
                      <TableCell sx={NUM}>{line.weight}</TableCell>
                      <TableCell>{line.warehouse}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {stoneStage && entry.stoneLines.length ? (
              <Stack spacing={0.5}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Đá xuất kho NVL (theo TL gói thừa KCS cân)
                </Typography>
                <Table size="small" sx={{ '& td, & th': { px: 1, py: 0.5 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Mã đá</TableCell>
                      <TableCell sx={NUM}>Cấp</TableCell>
                      <TableCell sx={NUM}>Gói thừa</TableCell>
                      <TableCell sx={NUM}>Xuất</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entry.stoneLines.map((line) => {
                      const preview = stoneReturnPreview(line, Number(line.returnedWeight ?? 0))
                      const used =
                        Number(line.qty) <= 0
                          ? `0 ${line.unit}`
                          : preview != null
                            ? `${formatQty(String(preview.usedQty))} ${line.unit}`
                            : `${(line.stoneCount ?? 0) - (line.returnedCount ?? 0)} viên`
                      return (
                        <TableRow key={line.materialId}>
                          <TableCell>
                            {line.sku || line.name}
                            {line.extraCount ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                gồm {line.extraCount} lần thợ xin thêm
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell sx={NUM}>
                            {formatQty(line.qty)} {line.unit}
                            {line.weight ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {formatQty(line.weight)} g
                              </Typography>
                            ) : null}
                            {line.earlyReturnedWeight ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                đã trả giữa khâu {formatQty(line.earlyReturnedWeight)} g
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell sx={NUM}>
                            {line.returnedWeight != null ? `${formatQty(line.returnedWeight)} g` : '—'}
                            {line.returnedCount != null ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                ≈ {line.returnedCount} viên
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell sx={NUM}>
                            <b>{used}</b>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Stack>
            ) : stoneStage && stoneUsed != null ? (
              <Stack spacing={0.25}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Đá xuất kho
                </Typography>
                <Typography variant="body2">
                  Cấp {entry.stonesIn} viên − thợ trả lại {entry.returnedStoneCount ?? 0} viên ={' '}
                  <b>{stoneUsed} viên</b> xuất khỏi kho NVL (gắn lên {entry.stoneCount ?? 0}
                  {entry.stoneLoss != null && entry.stoneLoss > 0 ? `, mất ${entry.stoneLoss}` : ''}).
                </Typography>
              </Stack>
            ) : null}

            {goodQty === 0 ? (
              <Alert severity="warning" sx={{ py: 0.25 }}>
                Đạt 0 sp — phiếu sẽ chốt <b>Lỗi {stage ? STAGE_LABEL[stage].toLowerCase() : ''}</b>.
              </Alert>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Xác nhận xong phiếu sang {stoneStage ? 'Chờ khắc' : 'Chờ vào đá'}.
              </Typography>
            )}
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button variant="contained" disabled={saving || entry == null} onClick={() => entry && onConfirm(entry)}>
          {saving ? 'Đang nhập kho…' : 'Xác nhận nhập kho'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
