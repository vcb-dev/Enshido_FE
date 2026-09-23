import type { ReactNode } from 'react'
import { Box, Button, Chip, DialogActions, DialogContent, DialogTitle, Paper, Typography } from '@mui/material'
import {
  formatMoney,
  formatQty,
  formatStockedDate,
  type InboundRow,
  type OutboundRow,
} from '../api/inventory'
import { DETAIL_GRID, DetailFact, DetailSection } from './detailView'
import type { StockProfile } from './catalog'

export function InboundView({
  row,
  profile,
  onClose,
}: {
  row: InboundRow
  profile: StockProfile
  onClose: () => void
}) {
  return (
    <MovementFrame
      title={`Chi tiết phiếu nhập`}
      subtitle={row.sku ? `${row.sku} — ${row.name}` : row.name}
      onClose={onClose}
    >
      <Paper variant="outlined" sx={{ p: 1.75 }}>
        <DetailSection>Phiếu nhập</DetailSection>
        <Box sx={DETAIL_GRID}>
          <DetailFact label="Ngày nhập" value={formatStockedDate(row.receivedAt)} />
          <DetailFact label="Người nhập" value={row.enteredBy} />
          <DetailFact label="NCC" value={row.supplierName} />
          <DetailFact label="Mã hàng NCC" value={row.supplierSku} />
          {row.sourceWarehouseName ? (
            <DetailFact label="Từ kho" value={row.sourceWarehouseName} />
          ) : null}
        </Box>
        {row.note?.trim() ? (
          <Box sx={{ mt: 1.5 }}>
            <DetailFact label="Ghi chú" value={row.note} />
          </Box>
        ) : null}
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.75 }}>
        <DetailSection>{profile.noun}</DetailSection>
        <Box sx={DETAIL_GRID}>
          <DetailFact label={profile.skuLabel} value={row.sku} />
          <DetailFact label={profile.nameLabel} value={row.name} />
          <DetailFact label="Đơn vị" value={row.unit} />
          <DetailFact label="Số lượng" value={formatQty(row.qty)} />
          <DetailFact label="Đơn giá" value={moneyOrDash(row.unitPrice || row.stockUnitPrice)} />
          <DetailFact label="Thành tiền" value={moneyOrDash(row.amount)} />
        </Box>
      </Paper>
    </MovementFrame>
  )
}

export function OutboundView({
  row,
  profile,
  onClose,
}: {
  row: OutboundRow
  profile: StockProfile
  onClose: () => void
}) {
  return (
    <MovementFrame
      title="Chi tiết phiếu xuất"
      subtitle={row.sku ? `${row.sku} — ${row.name}` : row.name}
      onClose={onClose}
    >
      <Paper variant="outlined" sx={{ p: 1.75 }}>
        <DetailSection>Phiếu xuất</DetailSection>
        <Box sx={DETAIL_GRID}>
          <DetailFact label="Ngày xuất" value={formatStockedDate(row.issuedAt)} />
          <DetailFact label="Mã đơn SX" value={row.productionOrderCode} />
          <DetailFact label="Người xuất" value={row.issuedBy} />
          <DetailFact label="Người nhận" value={row.receivedBy} />
          {row.destWarehouseName ? (
            <DetailFact label="Đến kho" value={row.destWarehouseName} />
          ) : null}
          {row.autoIssued ? (
            <DetailFact
              label="Loại phiếu"
              value={<Chip size="small" variant="outlined" label="Tự tạo khi lên đơn" />}
            />
          ) : null}
        </Box>
        {row.note?.trim() ? (
          <Box sx={{ mt: 1.5 }}>
            <DetailFact label="Ghi chú" value={row.note} />
          </Box>
        ) : null}
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.75 }}>
        <DetailSection>{profile.noun}</DetailSection>
        <Box sx={DETAIL_GRID}>
          <DetailFact label={profile.skuLabel} value={row.sku} />
          <DetailFact label={profile.nameLabel} value={row.name} />
          <DetailFact label="Đơn vị" value={row.unit} />
          <DetailFact label="Số lượng xuất" value={formatQty(row.qty)} />
          <DetailFact label="Đơn giá xuất" value={outboundPrice(row)} />
          <DetailFact label="Thành tiền" value={moneyOrDash(row.amount)} />
        </Box>
      </Paper>
    </MovementFrame>
  )
}

function MovementFrame({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string | null
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography component="span" variant="h6" sx={{ fontWeight: 700, display: 'block' }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 0.5 }}>
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Đóng
        </Button>
      </DialogActions>
    </>
  )
}

function moneyOrDash(value: string | null | undefined) {
  return value && Number(value) ? formatMoney(value) : ''
}

function outboundPrice(row: OutboundRow) {
  if (row.priceBreakdown?.length) {
    return row.priceBreakdown
      .map(
        (item) =>
          `${formatQty(item.qty)} × ${formatMoney(item.unitPrice)} (${item.source === 'opening' ? 'đầu kỳ' : 'nhập'})`,
      )
      .join('\n')
  }
  return moneyOrDash(row.inboundUnitPrice)
}
