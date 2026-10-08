import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'
import { QRCodeSVG } from 'qrcode.react'
import { Link as RouterLink } from 'react-router-dom'
import {
  clearSubTicketOutcomeApi,
  type ProductionOrderDetail,
  type SubTicket,
} from '../api/productionOrders'
import { STAGE_LABEL, subTicketUrl } from './catalog'
import { SubTicketStateChip } from './OrderChips'
import { TicketMatrix } from './TicketMatrix'
import { useOrderMutation } from './useOrderMutation'

/**
 * Một phiếu con kèm bảng quá trình sản xuất đầy đủ của riêng nó: Nguội → Xi rồi kết ở Lỗi hoặc
 * Hoàn thiện. Mọi thao tác chốt phiếu nằm ở đây — phiếu mẹ chỉ để xem.
 */
export function SubTicketMatrixCard({
  order,
  ticket,
  isAdmin,
  linkToTicket = false,
  showHeader = true,
  showQr = true,
  embedded = false,
}: {
  order: ProductionOrderDetail
  ticket: SubTicket
  isAdmin: boolean
  /** Trong trang đơn thì mã phiếu bấm được để mở trang phiếu con. */
  linkToTicket?: boolean
  /** Trang phiếu con đã có tên phiếu ở đầu trang nên bỏ dòng tiêu đề này. */
  showHeader?: boolean
  /** Mã QR của chính phiếu con này — thợ quét để vào phiếu, nhận việc và báo xong từng khâu. */
  showQr?: boolean
  /** Dùng bên trong accordion/card cha thì bỏ nền, viền và khoảng đệm lồng nhau. */
  embedded?: boolean
}) {
  const clear = useOrderMutation(
    order.code,
    () => clearSubTicketOutcomeApi(order.code, ticket.no),
    `Đã gỡ kết cục phiếu ${ticket.code}`,
  )
  const busy = clear.isPending

  // Chỉ chốt được khi phiếu không còn khâu nào đang chạy — QC cân lại xong mới phán đạt / lỗi.
  const settled = ticket.outcome != null
  // Hoàn thiện là việc của QC ở màn Phiếu QC; Lỗi tự chốt khi QC nhận lại 0 sản phẩm ở một khâu.
  const shipped = (order.finishedGoods?.shippedQty ?? 0) > 0

  return (
    <Paper
      elevation={embedded ? 0 : 1}
      sx={embedded ? { p: 0, bgcolor: 'transparent' } : { p: { xs: 1, md: 1.5 } }}
    >
      {showHeader || showQr ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
            {showHeader ? (
              <>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {linkToTicket ? (
                    <Box component={RouterLink} to={`/tickets/${ticket.code}`} sx={{ color: 'inherit' }}>
                      Phiếu {ticket.code}
                    </Box>
                  ) : (
                    `Phiếu ${ticket.code}`
                  )}
                </Typography>
                <SubTicketStateChip state={ticket.state} stage={ticket.pendingStage ?? ticket.activeStage} />
                <Typography variant="body2" color="text.secondary">
                  {ticket.qty} sp
                  {ticket.note ? ` · ${ticket.note}` : ''}
                </Typography>
              </>
            ) : null}
          </Stack>
          {showQr ? (
            <Stack spacing={0.25} sx={{ alignItems: 'center', flexShrink: 0 }}>
              <Box
                component={RouterLink}
                to={`/tickets/${ticket.code}`}
                aria-label={`Mở phiếu ${ticket.code}`}
                sx={{ p: 0.75, bgcolor: '#fff', border: '1px solid #ded3c3', borderRadius: 1, lineHeight: 0 }}
              >
                <QRCodeSVG value={subTicketUrl(ticket.code)} size={88} marginSize={0} />
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {ticket.code}
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      {ticket.state === 'WAITING' && ticket.pendingStage ? (
        <Alert severity="info" sx={{ mb: 1 }}>
          Đang mở khâu {STAGE_LABEL[ticket.pendingStage]} — chưa có thợ nhận.
        </Alert>
      ) : null}

      <TicketMatrix
        order={order}
        subTicket={ticket}
        outcomeActions={{
          DEFECT: settled ? (
            ticket.outcome === 'DEFECT' && isAdmin && !shipped ? (
              <Button
                size="small"
                color="inherit"
                disabled={busy}
                loading={clear.isPending}
                onClick={() => clear.mutate(undefined)}
              >
                Gỡ ghi lỗi
              </Button>
            ) : null
          ) : null,
          FINISH: settled ? (
            ticket.outcome === 'FINISH' && isAdmin && !shipped ? (
              <Button
                size="small"
                color="inherit"
                disabled={busy}
                loading={clear.isPending}
                onClick={() => clear.mutate(undefined)}
              >
                Gỡ hoàn thiện
              </Button>
            ) : null
          ) : null,
        }}
      />
    </Paper>
  )
}
