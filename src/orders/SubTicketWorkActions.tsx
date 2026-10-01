import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Collapse,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import { TrashIcon } from '../components/ui'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { can, Permission } from '../auth/permissions'
import {
  cancelSubTicketPendingApi,
  acceptSubTicketApi,
  clearStageDefectApi,
  createReworkApi,
  deleteSubTicketApi,
  updateSubTicketApi,
  type SubTicketPayload,
  reportStageDefectApi,
  unclaimSubTicketApi,
  type ProductionOrderDetail,
  type StageCode,
  type StageEntry,
  type SubTicket,
} from '../api/productionOrders'
import { INTAKE_STATUS_META } from '../intake/catalog'
import { STAGE_LABEL } from './catalog'
import { DefectDialog } from './OutcomeDialogs'
import { openableStages, SubTicketFormDialog } from './SubTicketDialogs'
import { WorkHistoryTable } from './WorkHistory'
import { useOrderMutation } from './useOrderMutation'

/**
 * Thao tác của MỘT phiếu con, đặt ngay trên phiếu đó: chỉ định thợ, xác nhận giao, KCS cân lại,
 * thủ kho xác nhận và nút Báo lỗi theo khâu. Trước đây nằm gộp ở bảng tổng "Phiếu con cho thợ".
 */
export function SubTicketWorkActions({
  order,
  ticket,
  canManage,
  isAdmin,
  locked,
  canPrint,
  busy = false,
  undoingEntryId,
  onConfirm,
  onAssign,
  onReturn,
  onEditHandover,
  onUndoReturn,
  onKeeperConfirm,
}: {
  order: ProductionOrderDetail
  ticket: SubTicket
  /** Người lên đơn, thủ kho hoặc admin — chỉ định thợ, xác nhận giao. */
  canManage: boolean
  isAdmin: boolean
  locked: boolean
  canPrint: boolean
  busy?: boolean
  undoingEntryId?: string | null
  onConfirm: (ticket: SubTicket) => void
  onAssign: (ticket: SubTicket, stages: StageCode[]) => void
  onReturn: (entry: StageEntry) => void
  onEditHandover: (entry: StageEntry) => void
  onUndoReturn: (entry: StageEntry) => void
  onKeeperConfirm: (entry: StageEntry) => void
}) {
  const { user } = useAuth()
  const canQc = can(user, Permission.PRODUCTION_QC)
  const canKeeper = can(user, Permission.WAREHOUSE_KEEPER) || isAdmin
  const [defectOpen, setDefectOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const entries = order.stages.filter((entry) => entry.subTicketId === ticket.id)
  const last = entries.at(-1)
  const openEntry = entries.find((entry) => !entry.returnedAt)
  const active = !locked && !order.finishedGoods
  const assignableStages = openableStages(order).byTicket.get(ticket.no) ?? []

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
  // Báo lỗi chỉ khi khâu đang làm và KCS chưa cân lại (thợ giữ khâu / KCS / admin); bỏ báo lỗi khi báo nhầm.
  const reportDefect = useOrderMutation(
    order.code,
    (note: string) => reportStageDefectApi(order.code, ticket.no, note),
    'Đã báo lỗi khâu — KCS cân lại hàng lỗi',
  )
  const clearDefect = useOrderMutation(
    order.code,
    () => clearStageDefectApi(order.code, ticket.no),
    'Đã bỏ báo lỗi',
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
  // Nguội / Vào đá: thợ được chỉ định tự bấm "Nhận hàng" (admin bấm thay được) — không xác nhận giao tay.
  const accept = useOrderMutation(
    order.code,
    () => acceptSubTicketApi(order.code, ticket.no),
    'Đã nhận hàng — hệ thống ghi giao khâu và xuất kho',
  )
  const selfAccept = ticket.pendingStage === 'FILING' || ticket.pendingStage === 'STONE_SETTING'
  // Hàng lỗi Nguội / Vào đá đã được thủ kho xác nhận: thủ kho bấm "Tạo phiếu bù" cho từng lần KCS nhận,
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

  const isHolder = openEntry?.craftsmanUserId != null && openEntry.craftsmanUserId === user?.id
  const canReportOpen = active && openEntry != null && !openEntry.defectReportedAt && (isHolder || canQc || isAdmin)

  return (
    <Stack spacing={1}>
      {openEntry?.defectReportedAt ? (
        <Alert
          severity="error"
          sx={{ py: 0.25 }}
          action={
            openEntry.returnedAt == null && (isAdmin || canQc || isHolder) ? (
              <Button color="inherit" size="small" disabled={clearDefect.isPending} onClick={() => clearDefect.mutate(undefined)}>
                Bỏ báo lỗi
              </Button>
            ) : undefined
          }
        >
          Báo lỗi khâu {STAGE_LABEL[openEntry.stage]} bởi {openEntry.defectReportedByName ?? '—'}: {openEntry.defectNote}
        </Alert>
      ) : null}

      {reworks.map((item) => (
        <Alert key={item.code} severity="info" sx={{ py: 0.25 }}>
          Phiếu bù <b>{item.code}</b> · {item.qty} sp · {INTAKE_STATUS_META[item.status].label}
        </Alert>
      ))}

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
            chờ người lên đơn chọn NVL và giao
          </Typography>
        ) : ticket.state === 'CLAIMED' && active && selfAccept ? (
          <>
            <Typography variant="caption" color="text.secondary">
              chờ {ticket.claimedByName ?? 'thợ'} quét QR nhận hàng
            </Typography>
            {isAdmin ? (
              <Button
                size="small"
                variant="outlined"
                disabled={accept.isPending}
                onClick={() => accept.mutate(undefined)}
              >
                {accept.isPending ? 'Đang nhận…' : 'Nhận hàng thay thợ'}
              </Button>
            ) : null}
          </>
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
            {/* KCS chỉ nhận lại khi thợ đã báo làm xong (hoặc đã báo lỗi) — khớp luật ở BE. */}
            {ticket.state === 'SUBMITTED' && openEntry.pendingRequestCount > 0 ? (
              <Typography variant="caption" color="warning.main">
                còn {openEntry.pendingRequestCount} yêu cầu xuất NVL chờ xử lý
              </Typography>
            ) : ticket.state === 'SUBMITTED' ? (
              canQc ? (
                <Button size="small" variant="contained" onClick={() => onReturn(openEntry)}>
                  {openEntry.defectReportedAt ? 'KCS cân hàng lỗi' : 'KCS cân lại & chuyển khâu'}
                </Button>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  chờ KCS cân lại
                </Typography>
              )
            ) : (
              <Typography variant="caption" color="text.secondary">
                chờ thợ báo xong
              </Typography>
            )}
          </>
        ) : null}
        {ticket.state === 'CONFIRMING' && last ? (
          canKeeper ? (
            <Button size="small" variant="contained" onClick={() => onKeeperConfirm(last)}>
              Thủ kho xác nhận
            </Button>
          ) : (
            <Typography variant="caption" color="text.secondary">
              chờ thủ kho xác nhận
            </Typography>
          )
        ) : null}

        {canReportOpen && openEntry ? (
          <Button size="small" variant="outlined" color="error" onClick={() => setDefectOpen(true)}>
            Báo lỗi · {STAGE_LABEL[openEntry.stage]}
          </Button>
        ) : null}

        {/* Khâu đã báo lỗi thì thông tin giao đã chốt — chỉ còn bước KCS cân hàng lỗi. */}
        {openEntry && !openEntry.defectReportedAt ? (
          <Button size="small" variant="outlined" color="inherit" onClick={() => onEditHandover(openEntry)}>
            Sửa thông tin giao
          </Button>
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
        {/* KCS sửa lại kết quả đã nhận (Nguội / Vào đá): tối đa 3 lần, hết khi thủ kho đã xác nhận. */}
        {ticket.state === 'CONFIRMING' && last && canQc && active ? (
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={last.kcsRevisionCount >= 3}
            onClick={() => onReturn(last)}
          >
            KCS sửa lại ({last.kcsRevisionCount}/3)
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
        <Button size="small" variant="outlined" color="inherit" onClick={() => setHistoryOpen((value) => !value)}>
          {historyOpen ? 'Ẩn lịch sử thao tác' : 'Lịch sử thao tác'}
        </Button>
        <Tooltip title={canPrint ? '' : 'Đơn chưa báo Đúc'}>
          <span>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<PrintIcon fontSize="small" />}
              component={RouterLink}
              to={`/orders/${order.code}/tickets/${ticket.no}/print`}
              target="_blank"
              disabled={!canPrint}
            >
              In phiếu con
            </Button>
          </span>
        </Tooltip>
      </Stack>

      <Collapse in={historyOpen} timeout="auto" unmountOnExit>
        <Box sx={{ py: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Lịch sử thao tác phiếu {ticket.code}
          </Typography>
          <WorkHistoryTable order={order} ticket={ticket} />
        </Box>
      </Collapse>

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

      <DefectDialog
        open={defectOpen}
        ticketCode={ticket.code}
        saving={reportDefect.isPending}
        onClose={() => setDefectOpen(false)}
        onSave={(note) => reportDefect.mutate(note, { onSuccess: () => setDefectOpen(false) })}
      />
    </Stack>
  )
}
