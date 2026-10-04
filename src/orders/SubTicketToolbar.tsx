import { useState } from 'react'
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material'
import {
  clearSubTicketsApi,
  createSubTicketApi,
  splitSubTicketsApi,
  type ProductionOrderDetail,
  type SubTicketPayload,
} from '../api/productionOrders'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'
import { remainingSplit, SplitSubTicketsDialog, SubTicketFormDialog } from './SubTicketDialogs'
import { useOrderMutation } from './useOrderMutation'

/**
 * Thanh chia phiếu con trên tab Sản xuất: chia số lượng, thêm phiếu, hủy chia. Mọi thao tác của
 * từng phiếu (chỉ định thợ, QC, thủ kho, báo lỗi, sửa / xoá, lịch sử) nằm ngay trên phiếu con đó
 * — xem SubTicketWorkActions.
 */
export function SubTicketToolbar({
  order,
  canManage,
  locked,
}: {
  order: ProductionOrderDetail
  /** Người lên đơn hoặc admin — được tạo / sửa / xoá phiếu con. */
  canManage: boolean
  locked: boolean
}) {
  const code = order.code
  const [formOpen, setFormOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [clearingSplit, setClearingSplit] = useState(false)

  const save = useOrderMutation(
    code,
    (payload: SubTicketPayload) => createSubTicketApi(code, payload),
    'Đã tạo phiếu con',
  )
  const split = useOrderMutation(
    code,
    (tickets: SubTicketPayload[]) => splitSubTicketsApi(code, tickets),
    'Đã chia đơn thành phiếu con',
  )
  const clearSplit = useOrderMutation(code, () => clearSubTicketsApi(code), 'Đã hủy chia, đơn quay về phiếu mẹ')

  const tickets = order.subTickets
  if (tickets.length === 0 && !canManage) return null
  /**
   * Đơn chỉ có một phiếu (đơn từ đúc luôn có sẵn, hoặc vừa hủy chia): phiếu đó chính là đơn, chưa
   * phải "phiếu con". Còn nguyên (chưa mở khâu / giao thợ / xin NVL) thì chia lại được — phiếu này
   * thành phiếu đầu, khớp luật `split` ở BE.
   */
  const single = tickets.length === 1 ? tickets[0] : null
  const singleUntouched =
    single != null &&
    single.entryCount === 0 &&
    !single.outcome &&
    !single.pendingStage &&
    !single.claimedByUserId &&
    !order.materialRequests.some((request) => request.subTicketNo === single.no)

  const finished = Boolean(order.finishedGoods)
  const active = !locked && !finished
  const remaining = remainingSplit(order)
  const canCreate = active && canManage && remaining.qty > 0
  // Đơn đã chạy trên phiếu mẹ (đã giao khâu, hay đang mở khâu chờ thợ) thì không chia nữa —
  // các khâu đã làm thuộc cả đơn, chia lúc này phiếu con sẽ mất lịch sử. Khớp luật ở BE.
  const parentStarted =
    order.stages.some((entry) => entry.subTicketId == null) ||
    (order.workTicket != null && order.workTicket.state !== 'IDLE')
  const canSplit =
    active &&
    canManage &&
    order.qty >= 2 &&
    !parentStarted &&
    (tickets.length === 0 ? remaining.qty > 0 : singleUntouched)
  const canClearSplit =
    active &&
    canManage &&
    tickets.length > 1 &&
    tickets.every(
      (ticket) =>
        ticket.entryCount === 0 &&
        !ticket.outcome &&
        !ticket.pendingStage &&
        !ticket.claimedByUserId,
    )

  return (
    <Box sx={{ mb: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 1 }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {single ? 'Phiếu' : 'Phiếu con'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {single
              ? `Cả đơn làm trên một phiếu ${single.code} · ${single.qty} sp`
              : `Đã chia ${order.subTicketTotals.qty}/${order.qty} sp`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {canManage && tickets.length <= 1 ? (
            <Tooltip
              title={
                order.qty < 2
                    ? 'Đơn chỉ có 1 sản phẩm nên làm trực tiếp trên phiếu mẹ'
                    : single && !singleUntouched
                      ? `Phiếu ${single.code} đã mở khâu / giao thợ — không chia lại được nữa`
                      : parentStarted
                      ? 'Đơn đã chạy trên phiếu mẹ — làm tiếp trên phiếu mẹ, không chia phiếu con nữa'
                      : tickets.length === 0 && remaining.qty <= 0
                        ? 'Đã chia hết số lượng đơn'
                        : ''
              }
            >
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!canSplit}
                  onClick={() => setSplitOpen(true)}
                >
                  Chia thành phiếu con
                </Button>
              </span>
            </Tooltip>
          ) : canManage ? (
            <>
              <Button
                size="small"
                variant="outlined"
                disabled={!canCreate}
                onClick={() => {
                  setFormOpen(true)
                }}
              >
                Thêm phiếu con
              </Button>
              {canClearSplit ? (
                <Button size="small" color="inherit" onClick={() => setClearingSplit(true)}>
                  Hủy chia
                </Button>
              ) : null}
            </>
          ) : null}
        </Stack>
      </Stack>

      {single ? (
        <Typography variant="body2" color="text.secondary">
          {singleUntouched
            ? 'Có từ 2 phần việc làm song song thì bấm "Chia thành phiếu con" — phiếu này thành phiếu đầu, mỗi phiếu giữ một phần số lượng. Chia trước khi chỉ định thợ khâu đầu tiên.'
            : 'Phiếu đã bắt đầu làm nên cả đơn đi tiếp trên phiếu này.'}
        </Typography>
      ) : null}

      {tickets.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Một phần việc thì giao khâu và theo dõi ngay trên phiếu mẹ. Chỉ chia phiếu con khi có từ 2 phần việc làm
          song song: mỗi phiếu giữ một phần số lượng; bạc / đá thợ xin xuất dần theo phiếu của mình.
          {parentStarted
            ? ' Đơn này đã giao khâu trên phiếu mẹ nên không chia được nữa — làm tiếp trên phiếu mẹ.'
            : ' Chia trước khi giao khâu đầu tiên; đã giao rồi thì đơn đi tiếp trên phiếu mẹ.'}
        </Typography>
      ) : null}

      <SplitSubTicketsDialog
        open={splitOpen}
        order={order}
        saving={split.isPending}
        onClose={() => setSplitOpen(false)}
        onSave={(ticketsToCreate) =>
          split.mutate(ticketsToCreate, { onSuccess: () => setSplitOpen(false) })
        }
      />

      <SubTicketFormDialog
        open={formOpen}
        order={order}
        ticket={null}
        saving={save.isPending}
        onClose={() => setFormOpen(false)}
        onExited={() => undefined}
        onSave={(payload) => save.mutate(payload, { onSuccess: () => setFormOpen(false) })}
      />

      <ConfirmDeleteDialog
        open={clearingSplit}
        title="Hủy chia phiếu con"
        description={`Xóa toàn bộ ${tickets.length} phiếu con chưa bắt đầu và quay đơn ${order.code} về quy trình trên phiếu mẹ?`}
        deleting={clearSplit.isPending}
        onClose={() => setClearingSplit(false)}
        onConfirm={() => clearSplit.mutate(undefined, { onSuccess: () => setClearingSplit(false) })}
      />
    </Box>
  )
}
