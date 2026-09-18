import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  IconButton,
  Link,
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
import { Link as RouterLink } from 'react-router-dom'
import {
  cancelSubTicketPendingApi,
  createSubTicketApi,
  deleteSubTicketApi,
  openSubTicketStageApi,
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
import { OpenStageDialog, openableStages, remainingSplit, SubTicketFormDialog } from './SubTicketDialogs'
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
  onConfirm: (ticket: SubTicket) => void
  onReturn: (entry: StageEntry) => void
  onEditHandover: (entry: StageEntry) => void
  onUndoReturn: (entry: StageEntry) => void
}) {
  const code = order.code
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SubTicket | null>(null)
  const [deleting, setDeleting] = useState<SubTicket | null>(null)
  const [openStage, setOpenStage] = useState(false)
  const [toppingUp, setToppingUp] = useState<SubTicket | null>(null)

  const save = useOrderMutation(
    code,
    (payload: SubTicketPayload) =>
      editing ? updateSubTicketApi(code, editing.no, payload) : createSubTicketApi(code, payload),
    editing ? 'Đã lưu phiếu con' : 'Đã tạo phiếu con',
  )
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
          {tickets.length > 0 ? (
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
          {canManage ? (
            <Tooltip
              title={
                order.silverWeight == null
                  ? 'Nhập Tổng TL bạc của đơn trước'
                  : remaining.qty <= 0
                    ? 'Đã chia hết số lượng đơn'
                    : ''
              }
            >
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!canCreate}
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  Tạo phiếu con
                </Button>
              </span>
            </Tooltip>
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
          Đơn nhiều thợ làm cùng lúc thì chia thành phiếu con: mỗi phiếu một phần số lượng + gram bạc, thợ tự nhận
          từng khâu, KCS cân lại riêng từng phiếu.
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
                <TableCell sx={{ minWidth: 200 }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((ticket) => {
                const entries = order.stages.filter((entry) => entry.subTicketId === ticket.id)
                const last = entries.at(-1)
                const openEntry = ticket.openEntryId ? byId.get(ticket.openEntryId) : undefined
                const stage = ticket.activeStage ?? last?.stage ?? null
                const worker =
                  ticket.state === 'CLAIMED'
                    ? ticket.claimedByName
                    : ticket.state === 'WORKING' || ticket.state === 'SUBMITTED'
                      ? openEntry?.craftsmanName
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
                            <Button size="small" variant="contained" onClick={() => onReturn(openEntry)}>
                              KCS nhận lại
                            </Button>
                            <Button size="small" onClick={() => onEditHandover(openEntry)}>
                              Sửa giao
                            </Button>
                          </>
                        ) : null}
                        {ticket.state === 'CLAIMED' ? (
                          <Button size="small" color="inherit" disabled={pending} onClick={() => unclaim.mutate(ticket)}>
                            Gỡ thợ nhận
                          </Button>
                        ) : null}
                        {ticket.state === 'WAITING' || ticket.state === 'CLAIMED' ? (
                          <Button size="small" color="inherit" disabled={pending} onClick={() => cancel.mutate(ticket)}>
                            Huỷ mở khâu
                          </Button>
                        ) : null}
                        {ticket.state === 'IDLE' && last?.returnedAt && isAdmin && active ? (
                          <Button size="small" color="inherit" disabled={pending} onClick={() => onUndoReturn(last)}>
                            Gỡ nhận lại
                          </Button>
                        ) : null}
                        {canManage && active && !ticket.outcome ? (
                          <Button size="small" onClick={() => setToppingUp(ticket)}>
                            Cấp thêm
                          </Button>
                        ) : null}
                        {canManage && active && ticket.entryCount === 0 ? (
                          <Button
                            size="small"
                            onClick={() => {
                              setEditing(ticket)
                              setFormOpen(true)
                            }}
                          >
                            Sửa
                          </Button>
                        ) : null}
                        {canManage && ticket.entryCount === 0 ? (
                          <IconButton size="small" aria-label="Xoá phiếu con" onClick={() => setDeleting(ticket)}>
                            <TrashIcon />
                          </IconButton>
                        ) : null}
                        <Tooltip title={canPrint ? 'In phiếu con' : 'Chỉ in phiếu thợ khi đơn đã báo Đúc'}>
                          <span>
                            <IconButton
                              size="small"
                              aria-label="In phiếu con"
                              component={RouterLink}
                              to={`/orders/${code}/tickets/${ticket.no}/print`}
                              target="_blank"
                              disabled={!canPrint}
                            >
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
    </Box>
  )
}
