import { useState } from 'react'
import { Alert, Box, Button, Paper, Stack, Tooltip, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import {
  clearSubTicketOutcomeApi,
  setSubTicketOutcomeApi,
  type ProductionOrderDetail,
  type SubTicket,
} from '../api/productionOrders'
import { LAST_STAGE, lastStageDone, STAGE_LABEL } from './catalog'
import { SubTicketStateChip } from './OrderChips'
import { DefectDialog, FinishDialog } from './OutcomeDialogs'
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
  embedded = false,
}: {
  order: ProductionOrderDetail
  ticket: SubTicket
  isAdmin: boolean
  /** Trong trang đơn thì mã phiếu bấm được để mở trang phiếu con. */
  linkToTicket?: boolean
  /** Trang phiếu con đã có tên phiếu ở đầu trang nên bỏ dòng tiêu đề này. */
  showHeader?: boolean
  /** Dùng bên trong accordion/card cha thì bỏ nền, viền và khoảng đệm lồng nhau. */
  embedded?: boolean
}) {
  const [defectOpen, setDefectOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)

  const outcome = useOrderMutation(
    order.code,
    (vars: { outcome: 'DEFECT' | 'FINISH'; note?: string }) =>
      setSubTicketOutcomeApi(order.code, ticket.no, vars.outcome, vars.note),
    `Đã chốt phiếu ${ticket.code}`,
  )
  const clear = useOrderMutation(
    order.code,
    () => clearSubTicketOutcomeApi(order.code, ticket.no),
    `Đã gỡ kết cục phiếu ${ticket.code}`,
  )
  const busy = outcome.isPending || clear.isPending

  // Chỉ chốt được khi phiếu không còn khâu nào đang chạy — KCS cân lại xong mới phán đạt / lỗi.
  const settled = ticket.outcome != null
  const idle = ticket.state === 'IDLE'
  const delivered = order.status === 'DELIVERED'
  const canFinish = idle && ticket.entryCount > 0 && !delivered
  // Hoàn thiện phải đi hết phiếu: chưa có khâu Xi được KCS nhận lại thì nút còn khoá.
  const finishReady = lastStageDone(order.stages.filter((entry) => entry.subTicketId === ticket.id))
  const canDefect = idle && !delivered
  const shipped = (order.finishedGoods?.shippedQty ?? 0) > 0

  return (
    <Paper
      elevation={embedded ? 0 : 1}
      sx={embedded ? { p: 0, bgcolor: 'transparent' } : { p: { xs: 1, md: 1.5 } }}
    >
      {showHeader ? (
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {linkToTicket ? (
              <Box component={RouterLink} to={`/tickets/${ticket.code}`} sx={{ color: 'inherit' }}>
                Phiếu {ticket.code}
              </Box>
            ) : (
              `Phiếu ${ticket.code}`
            )}
          </Typography>
          <SubTicketStateChip state={ticket.state} />
          <Typography variant="body2" color="text.secondary">
            {ticket.qty} sp
            {ticket.note ? ` · ${ticket.note}` : ''}
          </Typography>
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
          ) : canDefect ? (
            <Button size="small" variant="outlined" color="error" onClick={() => setDefectOpen(true)}>
              Ghi lỗi
            </Button>
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
          ) : canFinish ? (
            <Tooltip
              title={
                finishReady
                  ? ''
                  : `Chưa xong khâu ${STAGE_LABEL[LAST_STAGE]} — làm hết phiếu rồi mới hoàn thiện được`
              }
            >
              <span>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  disabled={!finishReady}
                  onClick={() => setFinishOpen(true)}
                >
                  Xác nhận hoàn thiện
                </Button>
              </span>
            </Tooltip>
          ) : null,
        }}
      />

      <DefectDialog
        open={defectOpen}
        ticketCode={ticket.code}
        saving={outcome.isPending}
        onClose={() => setDefectOpen(false)}
        onSave={(note) =>
          outcome.mutate({ outcome: 'DEFECT', note }, { onSuccess: () => setDefectOpen(false) })
        }
      />
      <FinishDialog
        open={finishOpen}
        ticketCode={ticket.code}
        qty={ticket.availableQty}
        saving={outcome.isPending}
        onClose={() => setFinishOpen(false)}
        onSave={(note) =>
          outcome.mutate({ outcome: 'FINISH', note }, { onSuccess: () => setFinishOpen(false) })
        }
      />
    </Paper>
  )
}
