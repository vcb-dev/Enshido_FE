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
import { formatCt, formatQty } from '../api/inventory'
import { isGoldMetal, type OrderMetalType, recoveredMaterialName } from '../api/intakeOrders'
import { defectScopeText, formatDateShort, SILVER_LOSS_LIMITS, STAGE_LABEL } from './catalog'
import { stone3dMismatch, stoneReturnPreview } from './stoneReturn'
import { Stone3dMismatchAlert } from './Stone3dMismatchAlert'
import { stoneConfirmCheck } from './stoneConfirmCheck'
import { KcsImages } from './KcsImages'

const NUM = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as const

type Line = { label: string; qty: string; weight: string; warehouse: string; show: boolean }

/**
 * Thủ kho kiểm tra và xác nhận mọi kết quả QC ở Nguội / Vào đá, cả phiếu mẹ / con.
 * Vào đá còn nhận lại túi đá thừa (mô tả luồng bước 13–15, 18). Bấm xác nhận là hệ thống
 * nhập kho: hàng lỗi + nguyên liệu thừa → kho NVL; hàng đạt Nguội → kho BTP, hàng đạt Vào đá không
 * nhập kho (từ 2026-11-17, chỉ chuyển sang khâu sau); khâu Vào đá còn xuất kho đá đã dùng theo từng
 * mã (SL cấp × (TL gói cấp − TL gói thừa) / TL gói cấp).
 */
export function KeeperConfirmDialog({
  entry,
  ticketCode,
  skipsStone = false,
  metalType,
  stone3dWeight = null,
  saving,
  onClose,
  onConfirm,
}: {
  entry: StageEntry | null
  ticketCode: string
  /** Đơn không có đá: Nguội xác nhận xong là sang thẳng Khắc. */
  skipsStone?: boolean
  /** Kim loại của đơn — đơn vàng nhập thu hồi vào mã vàng đúng tuổi. */
  metalType: OrderMetalType | null | undefined
  /** Tổng TL đá 3D của đơn (g) — có thì mốc hao Vào đá (`entry.stoneWeight`) lấy theo 3D. */
  stone3dWeight?: string | null
  saving: boolean
  onClose: () => void
  onConfirm: (entry: StageEntry) => void
}) {
  const gold = isGoldMetal(metalType)
  const recoveredWarehouse = `Kho NVL (${recoveredMaterialName(metalType)})`
  const stage = entry?.stage
  const stoneStage = stage === 'STONE_SETTING'
  const goodQty = entry?.returnedQty ?? 0
  const lines: Line[] = entry
    ? [
        {
          label: 'Hàng đạt',
          qty: `${goodQty} sp`,
          weight: formatQty(entry.returnedSilverWeight ?? '0'),
          // Từ Vào đá trở đi hàng đạt không nhập lại kho BTP — chuyển tay sang khâu sau.
          warehouse: stoneStage ? 'Chuyển sang khâu sau (không nhập kho)' : 'Kho BTP',
          show: goodQty > 0,
        },
        {
          label: 'Hàng lỗi',
          qty: `${entry.defectQty ?? 0} sp`,
          weight: formatQty(entry.btpRecoveredWeight ?? '0'),
          warehouse: recoveredWarehouse,
          show: (entry.defectQty ?? 0) > 0 || Number(entry.btpRecoveredWeight ?? 0) > 0,
        },
        {
          label: gold ? 'Nguyên liệu vàng thừa' : 'Nguyên liệu thừa S925',
          qty: '—',
          weight: formatQty(entry.silverRecoveredWeight ?? '0'),
          warehouse: recoveredWarehouse,
          show: Number(entry.silverRecoveredWeight ?? 0) > 0,
        },
        {
          label: gold ? 'Nguyên liệu vàng thừa (ô S999)' : 'Nguyên liệu thừa S999',
          qty: '—',
          weight: formatQty(entry.scrapS999Weight ?? '0'),
          warehouse: gold ? recoveredWarehouse : 'Kho NVL (Bạc S999 thu hồi)',
          show: Number(entry.scrapS999Weight ?? 0) > 0,
        },
      ]
    : []
  const visible = lines.filter((line) => line.show)
  const defectLabel = defectScopeText(entry)
  const stoneUsed = entry && entry.stonesIn != null ? entry.stonesIn - (entry.returnedStoneCount ?? 0) : null
  // Đối chiếu TL sau Vào đá với đá thực tế (gói cấp − gói thừa) — lộ ra gói thừa ghi sai / cân sai.
  const stoneCheck = stoneConfirmCheck(entry)
  // Mốc hao lấy TL đá 3D mà lệch xa đá thực tế → hao hụt dòng trên ra âm / ảo (vd. DH087 A094-3).
  const stone3dWarning =
    stoneStage && Number(stone3dWeight ?? 0) > 0 && entry?.stoneWeight != null
      ? stone3dMismatch(Number(entry.stoneWeight), stoneCheck?.stoneUsed ?? null)
      : null

  return (
    <Dialog open={entry != null} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Thủ kho xác nhận{defectLabel} — {stage ? STAGE_LABEL[stage] : ''} · phiếu {ticketCode}
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
                QC <b>{entry.returnedByName ?? '—'}</b> nhận lại {formatDateShort(entry.returnedAt)}
                {entry.silverLoss != null ? (
                  <>
                    {' '}
                    · hao hụt <b>{formatQty(entry.silverLoss)}</b> g
                    {entry.silverLossPercent != null ? ` (${formatQty(entry.silverLossPercent)}%)` : ''}
                  </>
                ) : null}
              </Typography>
              <KcsImages images={entry.images} size={64} />
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
                QC không ghi hàng nào để nhập kho.
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
                  Đá xuất kho NVL (theo TL gói thừa QC cân)
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
                            <KcsImages images={line.images} title="Ảnh gói đá lúc cấp" />
                          </TableCell>
                          <TableCell sx={NUM}>
                            {formatQty(line.qty)} {line.unit}
                            {line.weight ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {formatCt(line.weight)}
                              </Typography>
                            ) : null}
                            {line.earlyReturnedWeight ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                đã trả giữa khâu {formatCt(line.earlyReturnedWeight)}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell sx={NUM}>
                            {line.returnedWeight != null ? formatCt(line.returnedWeight) : '—'}
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

            {stone3dWarning ? <Stone3dMismatchAlert mismatch={stone3dWarning} /> : null}

            {stoneCheck?.issue ? (
              <Alert severity={stoneCheck.issue === 'gain' ? 'error' : 'warning'} sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {stoneCheck.issue === 'gain'
                    ? 'Hàng nhận lại nặng hơn bạc + đá thực tế — kiểm tra cân lại'
                    : `Hao theo đá thực tế ${formatQty(String(stoneCheck.percent))}% — vượt mức ${SILVER_LOSS_LIMITS.warn}%`}
                </Typography>
                <Typography variant="body2">
                  Bạc vào khâu {formatQty(String(stoneCheck.silverIn))} g + đá thực tế{' '}
                  {formatQty(String(stoneCheck.stoneUsed))} g ({formatCt(String(stoneCheck.stoneUsed))} = cấp{' '}
                  {formatCt(String(stoneCheck.stoneIssued))} − gói thừa {formatCt(String(stoneCheck.stoneLeft))}) − TL QC
                  cân ra {formatQty(String(stoneCheck.out))} g = <b>{formatQty(String(stoneCheck.loss))} g</b>.
                </Typography>
                <Typography variant="body2">
                  {stoneCheck.issue === 'gain'
                    ? 'Gói đá thừa ghi nhiều hơn thực tế hoặc QC cân sai.'
                    : 'Có thể gói đá thừa chưa cân / ghi thiếu — đá xuất kho NVL sẽ nhiều hơn thực tế.'}{' '}
                  Nhờ QC cân lại gói thừa và hàng trước khi xác nhận.
                </Typography>
              </Alert>
            ) : null}

            {goodQty === 0 ? (
              <Alert severity="warning" sx={{ py: 0.25 }}>
                Đạt 0 sp — phiếu sẽ chốt <b>Lỗi {stage ? STAGE_LABEL[stage].toLowerCase() : ''}</b>.
              </Alert>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {stoneStage || skipsStone
                  ? 'Xác nhận xong phiếu tự mở Khắc — thợ khắc tự nhận ở “Phiếu của tôi”.'
                  : 'Xác nhận xong phiếu sang Chờ vào đá.'}
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
