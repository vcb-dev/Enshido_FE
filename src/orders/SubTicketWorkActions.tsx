import { useState } from 'react'
import {
  Alert,
  Button,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { TrashIcon } from '../components/ui'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'
import { useAuth } from '../auth/AuthContext'
import { can, Permission } from '../auth/permissions'
import {
  cancelSubTicketPendingApi,
  createReworkApi,
  deleteSubTicketApi,
  updateSubTicketApi,
  type SubTicketPayload,
  unclaimSubTicketApi,
  type ProductionOrderDetail,
  type StageCode,
  type StageEntry,
  type SubTicket,
} from '../api/productionOrders'
import { ReworkChildren } from './ReworkChildren'
import { STAGE_LABEL } from './catalog'
import { openableStages, SubTicketFormDialog } from './SubTicketDialogs'
import { useOrderMutation } from './useOrderMutation'

/**
 * Thao tác của MỘT phiếu con, đặt ngay trên phiếu đó: chỉ định thợ, xác nhận giao, QC cân lại,
 * thủ kho xác nhận. Trước đây nằm gộp ở bảng tổng "Phiếu con cho thợ".
 */
export function SubTicketWorkActions({
  order,
  ticket,
  canManage,
  isAdmin,
  locked,
  busy = false,
  undoingEntryId,
  onConfirm,
  onAssign,
  onUndoReturn,
  onKeeperConfirm,
}: {
  order: ProductionOrderDetail
  ticket: SubTicket
  /** Người lên đơn, thủ kho hoặc admin — chỉ định thợ, xác nhận giao. */
  canManage: boolean
  isAdmin: boolean
  locked: boolean
  busy?: boolean
  undoingEntryId?: string | null
  onConfirm: (ticket: SubTicket) => void
  onAssign: (ticket: SubTicket, stages: StageCode[]) => void
  onUndoReturn: (entry: StageEntry) => void
  onKeeperConfirm: (entry: StageEntry) => void
}) {
  const { user } = useAuth()
  const canKeeper = can(user, Permission.WAREHOUSE_KEEPER) || isAdmin
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const entries = order.stages.filter((entry) => entry.subTicketId === ticket.id)
  const last = entries.at(-1)
  const openEntry = entries.find((entry) => !entry.returnedAt)
  const active = !locked && !order.finishedGoods
  // Tự giao khâu kế tiếp của phiếu; làm lại thì bắt đầu từ khâu mặc định.
  const openable = openableStages(order).byTicket.get(ticket.no) ?? []
  const assignableStages = openable.slice(0, 1)

  const cancel = useOrderMutation(
    order.code,
    () => cancelSubTicketPendingApi(order.code, ticket.no),
    'Đã huỷ mở khâu',
  )
  const unclaim = useOrderMutation(
    order.code,
    () => unclaimSubTicketApi(order.code, ticket.no),
    'Đã gỡ thợ nhận',
  )
  const save = useOrderMutation(
    order.code,
    (payload: SubTicketPayload) => updateSubTicketApi(order.code, ticket.no, payload),
    'Đã lưu phiếu con',
  )
  const remove = useOrderMutation(
    order.code,
    () => deleteSubTicketApi(order.code, ticket.no),
    'Đã xoá phiếu con',
  )
  // Nguội / Vào đá: chỉ thợ được chỉ định tự quét QR bấm "Xác nhận" — không xác nhận giao tay.
  const selfAccept = ticket.pendingStage === 'FILING' || ticket.pendingStage === 'STONE_SETTING'
  // Hàng lỗi Nguội / Vào đá đã được thủ kho xác nhận: thủ kho bấm "Tạo phiếu bù" cho từng lần QC nhận,
  // đơn bù đi lại từ bước sáp rồi thành phiếu con mới của đơn này.
  const reworks = (order.reworks ?? []).filter((item) => item.ticketNo === ticket.no)
  const reworkable = entries.find(
    (entry) =>
      entry.confirmedAt != null &&
      (entry.defectQty ?? 0) > 0 &&
      !(order.reworks ?? []).some((item) => item.entryId === entry.id),
  )
  const createRework = useOrderMutation(
    order.code,
    (entryId: string) => createReworkApi(order.code, entryId),
    'Đã tạo phiếu bù — đi lại từ bước sáp',
  )
  const pending = busy || cancel.isPending || unclaim.isPending


  return (
    <Stack spacing={1}>
      {openEntry?.defectReportedAt ? (
        // Báo / bỏ báo lỗi làm ở màn Phiếu QC (hoặc thợ trên phiếu của mình) — ở đây chỉ hiện.
        <Alert severity="error" sx={{ py: 0.25 }}>
          Báo lỗi khâu {STAGE_LABEL[openEntry.stage]} bởi {openEntry.defectReportedByName ?? '—'}: {openEntry.defectNote}
        </Alert>
      ) : null}

      <ReworkChildren reworks={reworks} ticketCode={ticket.code} />

      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {ticket.state === 'IDLE' && active ? (
          canManage ? (
            <Tooltip title={assignableStages.length ? '' : 'Phiếu chưa có khâu tiếp theo để giao'}>
              <span>
                <Button
                  size="small"
                  variant="contained"
                  disabled={assignableStages.length === 0}
                  onClick={() => onAssign(ticket, assignableStages)}
                >
                  Chỉ định thợ
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Chờ người điều hành giao việc
            </Typography>
          )
        ) : null}
        {ticket.state === 'CLAIMED' && active && !canManage ? (
          <Typography variant="caption" color="text.secondary">
            {selfAccept ? 'chờ thợ được chỉ định quét QR xác nhận' : 'chờ người lên đơn chọn NVL và giao'}
          </Typography>
        ) : ticket.state === 'CLAIMED' && active && selfAccept ? (
          <Typography variant="caption" color="text.secondary">
            chờ {ticket.claimedByName ?? 'thợ'} quét QR xác nhận
          </Typography>
        ) : ticket.state === 'CLAIMED' && active ? (
          <Button size="small" variant="contained" onClick={() => onConfirm(ticket)}>
            Xác nhận giao
          </Button>
        ) : null}
        {reworkable && canKeeper && active ? (
          <Button
            size="small"
            variant="contained"
            color="warning"
            disabled={createRework.isPending}
            onClick={() => createRework.mutate(reworkable.id)}
          >
            {createRework.isPending
              ? 'Đang tạo…'
              : `Tạo phiếu bù · ${reworkable.defectQty} sp lỗi ${STAGE_LABEL[reworkable.stage]}`}
          </Button>
        ) : null}
        {openEntry ? (
          <>
            {/* QC cân lại ở màn Phiếu QC — chi tiết lệnh chỉ hiện trạng thái. */}
            {ticket.state === 'SUBMITTED' && openEntry.pendingRequestCount > 0 ? (
              <Typography variant="caption" color="warning.main">
                còn {openEntry.pendingRequestCount} yêu cầu xuất NVL chờ xử lý
              </Typography>
            ) : ticket.state === 'SUBMITTED' ? (
              <Typography variant="caption" color="text.secondary">
                chờ QC cân lại (màn Phiếu QC)
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                chờ thợ báo xong
              </Typography>
            )}
          </>
        ) : null}
        {ticket.state === 'CONFIRMING' && last ? (
          // Nguội / Vào đá luôn chờ thủ kho, kể cả không có hàng lỗi.
          canKeeper ? (
            <Button size="small" variant="contained" onClick={() => onKeeperConfirm(last)}>
              {(last.defectQty ?? 0) > 0 ? 'Thủ kho xác nhận lỗi' : 'Thủ kho xác nhận'}
            </Button>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {(last.defectQty ?? 0) > 0 ? 'chờ thủ kho xác nhận lỗi' : 'chờ thủ kho xác nhận kết quả QC'}
            </Typography>
          )
        ) : null}


        {ticket.state === 'CLAIMED' ? (
          <Button size="small" variant="outlined" color="inherit" disabled={pending} onClick={() => unclaim.mutate(undefined)}>
            {unclaim.isPending ? 'Đang gỡ thợ…' : 'Gỡ thợ nhận'}
          </Button>
        ) : null}
        {ticket.state === 'WAITING' || ticket.state === 'CLAIMED' ? (
          <Button size="small" variant="outlined" color="inherit" disabled={pending} onClick={() => cancel.mutate(undefined)}>
            {cancel.isPending ? 'Đang huỷ…' : 'Huỷ mở khâu'}
          </Button>
        ) : null}
        {/* Gỡ nhận lại chỉ còn cho các khâu không qua thủ kho; Nguội / Vào đá khoá khi thủ kho đã xác nhận. */}
        {ticket.state === 'IDLE' && last?.returnedAt && isAdmin && active && last.stage !== 'FILING' && last.stage !== 'STONE_SETTING' ? (
          <Button size="small" variant="outlined" color="inherit" disabled={pending} onClick={() => onUndoReturn(last)}>
            {undoingEntryId === last.id ? 'Đang gỡ…' : 'Gỡ nhận lại'}
          </Button>
        ) : null}
        {canManage && active && ticket.entryCount === 0 ? (
          <Button size="small" variant="outlined" color="inherit" onClick={() => setEditOpen(true)}>
            Sửa phiếu con
          </Button>
        ) : null}
        {canManage && order.subTickets.length > 1 && ticket.entryCount === 0 ? (
          <Button size="small" variant="outlined" color="error" startIcon={<TrashIcon />} onClick={() => setDeleteOpen(true)}>
            Xoá phiếu con
          </Button>
        ) : null}
      </Stack>

      <SubTicketFormDialog
        open={editOpen}
        order={order}
        ticket={ticket}
        saving={save.isPending}
        onClose={() => setEditOpen(false)}
        onExited={() => undefined}
        onSave={(payload) => save.mutate(payload, { onSuccess: () => setEditOpen(false) })}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Xoá phiếu con"
        description={`Xoá phiếu con ${ticket.code}? Số lượng của phiếu trả lại phần chưa chia.`}
        deleting={remove.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => setDeleteOpen(false) })}
      />

    </Stack>
  )
}
