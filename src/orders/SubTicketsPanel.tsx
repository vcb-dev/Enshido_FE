import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  IconButton,
  Link,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { Link as RouterLink } from 'react-router-dom'
import {
  cancelSubTicketPendingApi,
  clearSubTicketsApi,
  createSubTicketApi,
  deleteSubTicketApi,
  openSubTicketStageApi,
  splitSubTicketsApi,
  topUpSubTicketApi,
  unclaimSubTicketApi,
  updateSubTicketApi,
  type ProductionOrderDetail,
  type StageCode,
  type StageEntry,
  type SubTicket,
  type SubTicketPayload,
} from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { TrashIcon } from '../components/ui'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'
import { formatDateShort, STAGE_LABEL } from './catalog'
import { SubTicketStateChip } from './OrderChips'
import {
  OpenStageDialog,
  openableStages,
  remainingSplit,
  SplitSubTicketsDialog,
  SubTicketFormDialog,
} from './SubTicketDialogs'
import { TopUpDialog } from './TopUpDialog'
import { useOrderMutation } from './useOrderMutation'

/**
 * Phiếu con cho thợ trên tab Sản xuất: chia số lượng + gram, mở khâu cho thợ tự nhận,
 * xác nhận giao và KCS nhận lại từng phiếu.
 */
export function SubTicketsPanel({
  order,
  canManage,
  isAdmin,
  locked,
  canPrint,
  busy,
  undoingEntryId,
  onConfirm,
  onReturn,
  onEditHandover,
  onUndoReturn,
}: {
  order: ProductionOrderDetail
  /** Người lên đơn hoặc admin — được tạo / sửa / xoá phiếu con. */
  canManage: boolean
  isAdmin: boolean
  locked: boolean
  canPrint: boolean
  busy: boolean
  /** Khâu đang gỡ nhận lại — để quay đúng nút của dòng đó. */
  undoingEntryId?: string | null
  onConfirm: (ticket: SubTicket) => void
  onReturn: (entry: StageEntry) => void
  onEditHandover: (entry: StageEntry) => void
  onUndoReturn: (entry: StageEntry) => void
}) {
  const code = order.code
  const [formOpen, setFormOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [editing, setEditing] = useState<SubTicket | null>(null)
  const [deleting, setDeleting] = useState<SubTicket | null>(null)
  const [clearingSplit, setClearingSplit] = useState(false)
  const [openStage, setOpenStage] = useState(false)
  const [toppingUp, setToppingUp] = useState<SubTicket | null>(null)
  const [actionMenu, setActionMenu] = useState<{ anchorEl: HTMLElement; ticketId: string } | null>(null)

  const save = useOrderMutation(
    code,
    (payload: SubTicketPayload) =>
      editing ? updateSubTicketApi(code, editing.no, payload) : createSubTicketApi(code, payload),
    editing ? 'Đã lưu phiếu con' : 'Đã tạo phiếu con',
  )
  const split = useOrderMutation(
    code,
    (tickets: SubTicketPayload[]) => splitSubTicketsApi(code, tickets),
    'Đã chia đơn thành phiếu con',
  )
  const clearSplit = useOrderMutation(code, () => clearSubTicketsApi(code), 'Đã hủy chia, đơn quay về phiếu mẹ')
  const remove = useOrderMutation(code, (ticket: SubTicket) => deleteSubTicketApi(code, ticket.no), 'Đã xoá phiếu con')
  const topUp = useOrderMutation(
    code,
    (payload: { qty?: number | null; silverWeight?: string | null; reason?: string }) =>
      topUpSubTicketApi(code, toppingUp?.no ?? 0, payload),
    `Đã cấp thêm cho phiếu ${toppingUp?.code ?? ''}`,
  )
  const open = useOrderMutation(
    code,
    (payload: { stage: StageCode; nos: number[] }) => openSubTicketStageApi(code, payload),
    'Đã mở khâu cho thợ nhận',
  )
  const cancel = useOrderMutation(
    code,
    (ticket: SubTicket) => cancelSubTicketPendingApi(code, ticket.no),
    'Đã huỷ mở khâu',
  )
  const unclaim = useOrderMutation(
    code,
    (ticket: SubTicket) => unclaimSubTicketApi(code, ticket.no),
    'Đã gỡ thợ nhận',
  )

  const tickets = order.subTickets
  if (tickets.length === 0 && !canManage) return null

  const finished = Boolean(order.finishedGoods)
  const active = !locked && !finished
  const remaining = remainingSplit(order)
  const openable = openableStages(order)
  const pending = busy || cancel.isPending || unclaim.isPending
  const byId = new Map(order.stages.map((entry) => [entry.id, entry]))
  const canCreate = active && canManage && order.silverWeight != null && remaining.qty > 0
  // Đơn đã chạy trên phiếu mẹ (đã giao khâu, hay đang mở khâu chờ thợ) thì không chia nữa —
  // các khâu đã làm thuộc cả đơn, chia lúc này phiếu con sẽ mất lịch sử. Khớp luật ở BE.
  const parentStarted =
    order.stages.some((entry) => entry.subTicketId == null) ||
    (order.workTicket != null && order.workTicket.state !== 'IDLE')
  const canSplit = canCreate && tickets.length === 0 && order.qty >= 2 && !parentStarted
  const canClearSplit =
    active &&
    canManage &&
    tickets.length > 0 &&
    tickets.every(
      (ticket) =>
        ticket.entryCount === 0 &&
        ticket.topUps.length === 0 &&
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
            Phiếu con cho thợ
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Đã chia {order.subTicketTotals.qty}/{order.qty} sp
            {order.silverWeight != null
              ? ` · ${formatQty(order.subTicketTotals.silverWeight)}/${formatQty(order.silverWeight)} g bạc`
              : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {tickets.length >= 2 ? (
            <Tooltip title={openable.stages.length ? '' : 'Không có phiếu con nào đang chờ mở khâu'}>
              <span>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!active || openable.stages.length === 0}
                  onClick={() => setOpenStage(true)}
                >
                  Mở khâu cho thợ nhận
                </Button>
              </span>
            </Tooltip>
          ) : null}
          {canManage && tickets.length === 0 ? (
            <Tooltip
              title={
                order.silverWeight == null
                  ? 'Nhập Tổng TL bạc của đơn trước'
                  : order.qty < 2
                    ? 'Đơn chỉ có 1 sản phẩm nên làm trực tiếp trên phiếu mẹ'
                    : parentStarted
                      ? 'Đơn đã chạy trên phiếu mẹ — làm tiếp trên phiếu mẹ, không chia phiếu con nữa'
                      : remaining.qty <= 0
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
                  setEditing(null)
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

      {canManage && order.silverWeight == null ? (
        <Alert severity="info" sx={{ mb: 1 }}>
          Nhập Tổng TL bạc của đơn ({order.source === 'BTP' ? 'Sửa đơn' : 'Cập nhật Đúc hoặc Sửa đơn'}) để chia gram
          bạc cho các phiếu con.
        </Alert>
      ) : null}

      {tickets.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Một phần việc thì giao khâu và theo dõi ngay trên phiếu mẹ. Chỉ chia phiếu con khi có từ 2 phần việc làm
          song song: mỗi phiếu giữ một phần số lượng và gram bạc riêng.
          {parentStarted
            ? ' Đơn này đã giao khâu trên phiếu mẹ nên không chia được nữa — làm tiếp trên phiếu mẹ.'
            : ' Chia trước khi giao khâu đầu tiên; đã giao rồi thì đơn đi tiếp trên phiếu mẹ.'}
        </Typography>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table
            size="small"
            sx={{
              minWidth: 720,
              '& td, & th': { px: 1, py: 0.6, fontSize: '0.84rem', borderColor: '#dfe5ea' },
              '& th': { fontWeight: 700, bgcolor: '#f4f6f7' },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Phiếu</TableCell>
                <TableCell align="right">SL</TableCell>
                <TableCell align="right">Bạc (g)</TableCell>
                <TableCell>Khâu</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Thợ</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((ticket) => {
                const entries = order.stages.filter((entry) => entry.subTicketId === ticket.id)
                const last = entries.at(-1)
                const openEntry = ticket.openEntryId ? byId.get(ticket.openEntryId) : undefined
                const stage = ticket.activeStage ?? last?.stage ?? null
                // Cột Thợ phải nói về cùng khâu với cột Khâu. Đang chờ thợ nhận thì khâu mới
                // chưa có ai — hiện thợ của khâu trước ở đây là trông như đã có người nhận.
                const waiting = ticket.state === 'WAITING'
                const worker =
                  ticket.state === 'CLAIMED'
                    ? ticket.claimedByName
                    : ticket.state === 'WORKING' || ticket.state === 'SUBMITTED'
                      ? openEntry?.craftsmanName
                      : waiting
                        ? null
                        : last?.craftsmanName
                return (
                  <TableRow key={ticket.id} hover>
                    <TableCell>
                      <Link component={RouterLink} to={`/tickets/${ticket.code}`} sx={{ fontWeight: 700 }}>
                        {ticket.code}
                      </Link>
                      {ticket.note ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {ticket.note}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">
                      {ticket.qty}
                      {ticket.availableQty !== ticket.qty ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          hiện {ticket.availableQty}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">
                      {formatQty(ticket.silverWeight)}
                      {Number(ticket.availableSilver) !== Number(ticket.silverWeight) ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          hiện {formatQty(ticket.availableSilver)}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {stage ? STAGE_LABEL[stage] : '—'}
                      {ticket.state === 'SUBMITTED' ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          thợ đã báo xong — chờ KCS cân lại
                        </Typography>
                      ) : null}
                      {ticket.state === 'IDLE' && last ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          đã nhận lại {formatDateShort(last.returnedAt)}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <SubTicketStateChip
                        state={ticket.state}
                        label={ticket.state === 'IDLE' && !last ? 'Chưa giao khâu' : undefined}
                      />
                    </TableCell>
                    <TableCell>
                      {worker ?? '—'}
                      {ticket.state === 'CLAIMED' ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          nhận lúc {formatDateShort(ticket.claimedAt)}
                        </Typography>
                      ) : null}
                      {waiting && last ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          khâu trước: {STAGE_LABEL[last.stage]} · {last.craftsmanName}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                        {ticket.state === 'CLAIMED' && active ? (
                          <Button size="small" variant="contained" onClick={() => onConfirm(ticket)}>
                            Xác nhận giao
                          </Button>
                        ) : null}
                        {openEntry ? (
                          <>
                            {/* KCS chỉ nhận lại khi thợ đã báo làm xong — khớp luật ở BE. */}
                            {ticket.state === 'SUBMITTED' ? (
                              <Button size="small" variant="contained" onClick={() => onReturn(openEntry)}>
                                KCS nhận lại
                              </Button>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                chờ thợ báo xong
                              </Typography>
                            )}
                          </>
                        ) : null}
                        <Tooltip title="Thao tác khác">
                          <IconButton
                            size="small"
                            aria-label={`Thao tác khác cho ${ticket.code}`}
                            onClick={(event) => setActionMenu({ anchorEl: event.currentTarget, ticketId: ticket.id })}
                            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                          >
                            <MoreHorizIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Menu
                          anchorEl={actionMenu?.ticketId === ticket.id ? actionMenu.anchorEl : null}
                          open={actionMenu?.ticketId === ticket.id}
                          onClose={() => setActionMenu(null)}
                        >
                          {openEntry ? (
                            <MenuItem
                              onClick={() => {
                                setActionMenu(null)
                                onEditHandover(openEntry)
                              }}
                            >
                              <ListItemText primary="Sửa thông tin giao" />
                            </MenuItem>
                          ) : null}
                          {ticket.state === 'CLAIMED' ? (
                            <MenuItem
                              disabled={pending}
                              onClick={() => {
                                setActionMenu(null)
                                unclaim.mutate(ticket)
                              }}
                            >
                              <ListItemText
                                primary={unclaim.isPending && unclaim.variables?.id === ticket.id ? 'Đang gỡ thợ…' : 'Gỡ thợ nhận'}
                              />
                            </MenuItem>
                          ) : null}
                          {ticket.state === 'WAITING' || ticket.state === 'CLAIMED' ? (
                            <MenuItem
                              disabled={pending}
                              onClick={() => {
                                setActionMenu(null)
                                cancel.mutate(ticket)
                              }}
                            >
                              <ListItemText
                                primary={cancel.isPending && cancel.variables?.id === ticket.id ? 'Đang huỷ…' : 'Huỷ mở khâu'}
                              />
                            </MenuItem>
                          ) : null}
                          {ticket.state === 'IDLE' && last?.returnedAt && isAdmin && active ? (
                            <MenuItem
                              disabled={pending}
                              onClick={() => {
                                setActionMenu(null)
                                onUndoReturn(last)
                              }}
                            >
                              <ListItemText primary={undoingEntryId === last.id ? 'Đang gỡ…' : 'Gỡ nhận lại'} />
                            </MenuItem>
                          ) : null}
                          {canManage && active && !ticket.outcome ? (
                            <MenuItem
                              onClick={() => {
                                setActionMenu(null)
                                setToppingUp(ticket)
                              }}
                            >
                              <ListItemText primary="Cấp thêm" />
                            </MenuItem>
                          ) : null}
                          {canManage && active && ticket.entryCount === 0 && ticket.topUps.length === 0 ? (
                            <MenuItem
                              onClick={() => {
                                setActionMenu(null)
                                setEditing(ticket)
                                setFormOpen(true)
                              }}
                            >
                              <ListItemText primary="Sửa phiếu con" />
                            </MenuItem>
                          ) : null}
                          {canManage && tickets.length !== 2 && ticket.entryCount === 0 && ticket.topUps.length === 0 ? (
                            <MenuItem
                              onClick={() => {
                                setActionMenu(null)
                                setDeleting(ticket)
                              }}
                              sx={{ color: 'error.main' }}
                            >
                              <TrashIcon />
                              <ListItemText primary="Xoá phiếu con" sx={{ ml: 1 }} />
                            </MenuItem>
                          ) : null}
                          <MenuItem
                            component={RouterLink}
                            to={`/orders/${code}/tickets/${ticket.no}/print`}
                            target="_blank"
                            disabled={!canPrint}
                            onClick={() => setActionMenu(null)}
                          >
                            <PrintIcon fontSize="small" />
                            <ListItemText
                              primary="In phiếu con"
                              secondary={canPrint ? undefined : 'Đơn chưa báo Đúc'}
                              sx={{ ml: 1 }}
                            />
                          </MenuItem>
                        </Menu>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tickets.length === 1 ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Dữ liệu cũ đang có đúng 1 phiếu con. Hãy thêm phiếu thứ hai trước khi mở khâu, hoặc xóa phiếu này để quay
          về quy trình phiếu mẹ.
        </Alert>
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
        ticket={editing}
        saving={save.isPending}
        onClose={() => setFormOpen(false)}
        onExited={() => setEditing(null)}
        onSave={(payload) => save.mutate(payload, { onSuccess: () => setFormOpen(false) })}
      />

      <TopUpDialog
        ticket={toppingUp}
        saving={topUp.isPending}
        onClose={() => setToppingUp(null)}
        onExited={() => setToppingUp(null)}
        onSave={(payload) => topUp.mutate(payload, { onSuccess: () => setToppingUp(null) })}
      />

      <OpenStageDialog
        open={openStage}
        order={order}
        saving={open.isPending}
        onClose={() => setOpenStage(false)}
        onSave={(payload) => open.mutate(payload, { onSuccess: () => setOpenStage(false) })}
      />

      <ConfirmDeleteDialog
        open={deleting != null}
        title="Xoá phiếu con"
        description={`Xoá phiếu con ${deleting?.code ?? ''}? Số lượng và gram bạc của phiếu trả lại phần chưa chia.`}
        deleting={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting, { onSuccess: () => setDeleting(null) })}
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
