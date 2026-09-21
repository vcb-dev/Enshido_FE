import { Fragment, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import EditIcon from '@mui/icons-material/Edit'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import {
  changeProductionStatusApi,
  deleteProductionOrderApi,
  getProductionOrderApi,
  getProductionOrderLookupsApi,
  handoverSubTicketApi,
  returnStageApi,
  undoReturnApi,
  updateCastingApi,
  updateHandoverApi,
  updateProductionOrderApi,
  type CastingPayload,
  type HandoverPayload,
  type ProductionOrderDetail,
  type ProductionStatus,
  type ReturnPayload,
  type StageCode,
  type StageEntry,
  type SubTicket,
  type UpsertProductionOrderPayload,
} from '../api/productionOrders'
import { formatQty, formatStockedDate } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import { PageHeader, SelectInput, TextInput, TrashIcon } from '../components/ui'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'
import { OrderCostingCard } from '../orders/OrderCostingCard'
import {
  formatDateShort,
  formatDateTime,
  isInStage,
  MANUAL_STATUSES,
  orderTicketUrl,
  SILVER_LOSS_LIMITS,
  STAGE_LABEL,
  STAGES,
  STATUS_META,
  STATUS_TABS,
} from '../orders/catalog'
import { BTP_WAREHOUSE_CODE, invalidateBtpStock } from '../orders/btpStock'
import { invalidateNvlStock } from '../orders/nvlStock'
import { afterProductionOrderSaved } from '../orders/orderCache'
import { RequestTypeChip, SourceChip, StatusChip } from '../orders/OrderChips'
import { ProductionOrderFormDialog } from '../orders/ProductionOrderFormDialog'
import {
  CastingDialog,
  HandoverDialog,
  KcsReturnDialog,
  type HandoverDialogState,
} from '../orders/StageDialogs'
import { SubTicketsPanel } from '../orders/SubTicketsPanel'
import { useOrderMutation } from '../orders/useOrderMutation'
import { stageColumns } from '../orders/ticketRows'
import { SubTicketMatrixCard } from '../orders/SubTicketMatrixCard'
import { TicketMatrix } from '../orders/TicketMatrix'

export function ProductionOrderDetailPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.roleCode === 'ADMIN' || Boolean(user?.extraRoles?.includes('ADMIN'))

  const [editing, setEditing] = useState(false)
  const [handover, setHandover] = useState<HandoverDialogState | null>(null)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [returning, setReturning] = useState<StageEntry | null>(null)
  const [castingOpen, setCastingOpen] = useState(false)
  const [statusDialog, setStatusDialog] = useState(false)
  const [moreMenu, setMoreMenu] = useState<HTMLElement | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Tab lưu trên URL để gửi link / quét QR là mở đúng khung cần xem.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: TabKey = TABS.some((item) => item.value === tabParam) ? (tabParam as TabKey) : 'overview'
  const setTab = (value: TabKey) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'overview') next.delete('tab')
        else next.set('tab', value)
        return next
      },
      { replace: true },
    )

  const detail = useQuery({
    queryKey: ['production-order', code],
    queryFn: () => getProductionOrderApi(code),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    // Thợ nhận phiếu / báo xong trên điện thoại của họ — không tự làm mới thì màn này đứng
    // ở trạng thái cũ tới khi tải lại trang. Các hộp thoại chỉ nạp form lúc mở nên làm mới
    // giữa chừng không xoá thứ người dùng đang gõ.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  const lookups = useQuery({
    queryKey: ['production-order-lookups'],
    queryFn: getProductionOrderLookupsApi,
    staleTime: 5 * 60_000,
  })

  const update = useOrderMutation(
    code,
    (payload: UpsertProductionOrderPayload) => updateProductionOrderApi(code, payload),
    'Đã lưu đơn',
  )
  const wasBtp = detail.data?.source === 'BTP'
  const wasNvl = detail.data?.source === 'NVL'
  const casting = useOrderMutation(
    code,
    (payload: CastingPayload) => updateCastingApi(code, payload),
    'Đã lưu thông tin Đúc',
  )
  // Giao khâu đi theo phiếu con: thợ tự nhận, người giao xác nhận. Ở đây chỉ còn xác nhận giao
  // và sửa lại thông tin giao.
  const saveHandover = useOrderMutation(
    code,
    (payload: HandoverPayload & { stage?: StageCode }) => {
      if (handover?.mode === 'confirm') {
        // Thợ là người đã tự nhận phiếu, khâu là khâu đang mở — server tự lấy.
        return handoverSubTicketApi(code, handover.ticket.no, {
          handedAt: payload.handedAt,
          handedQty: payload.handedQty,
          handedSilverWeight: payload.handedSilverWeight,
          note: payload.note,
        })
      }
      if (handover?.mode !== 'edit') throw new Error('Không có khâu nào để lưu')
      return updateHandoverApi(code, handover.entry.id, payload)
    },
    handover?.mode === 'confirm' ? 'Đã xác nhận giao cho thợ' : 'Đã lưu thông tin giao',
  )
  const saveReturn = useOrderMutation(
    code,
    ({ entry, payload }: { entry: StageEntry; payload: ReturnPayload }) =>
      returnStageApi(code, entry.id, payload),
    'KCS đã nhận lại',
  )
  const undoReturn = useOrderMutation(
    code,
    (entry: StageEntry) => undoReturnApi(code, entry.id),
    'Đã gỡ nhận lại',
  )
  const status = useOrderMutation(
    code,
    (payload: { status: ProductionStatus; note?: string }) => changeProductionStatusApi(code, payload),
    'Đã đổi trạng thái',
  )
  const remove = useMutation({
    mutationFn: () => deleteProductionOrderApi(code),
    onSuccess: () => {
      toast.success(`Đã xóa đơn ${code}`)
      if (wasBtp) {
        invalidateBtpStock(queryClient)
        invalidateNvlStock(queryClient)
      }
      if (wasNvl) invalidateNvlStock(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] })
      navigate('/orders', { replace: true })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (detail.isLoading) {
    return (
      <Stack sx={{ py: 6, alignItems: 'center' }}>
        <CircularProgress size={28} />
      </Stack>
    )
  }
  if (!detail.data) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">
          {detail.error instanceof Error ? detail.error.message : 'Không tải được đơn sản xuất'}
        </Alert>
        <Button component={RouterLink} to="/orders" sx={{ alignSelf: 'flex-start' }}>
          Về danh sách đơn
        </Button>
      </Stack>
    )
  }

  const order = detail.data
  const stages = order.stages
  const openEntry = stages.find((entry) => !entry.returnedAt)
  // Đơn BTP lấy hàng đúc sẵn: không qua Đúc, giao khâu và in phiếu ngay.
  const isBtp = order.source === 'BTP'
  const canPrint = isBtp || Boolean(order.castingSentDate)
  const locked = order.status === 'DELIVERED' || (order.finishedGoods?.shippedQty ?? 0) > 0
  // Người lên đơn và admin được chia phiếu con.
  const canManageTickets = isAdmin || (user != null && order.createdByUserId === user.id)
  const canDelete =
    isAdmin &&
    stages.length === 0 &&
    !order.lastPrintedAt &&
    (order.status === 'NEW' || (isBtp && order.status === 'FILING'))
  const ticketStale = order.lastPrintedAt != null && order.dataChangedAt > order.lastPrintedAt

  function openConfirmHandover(ticket: SubTicket) {
    setHandover({ mode: 'confirm', ticket })
    setHandoverOpen(true)
  }

  function openEditHandover(entry: StageEntry) {
    setHandover({ mode: 'edit', entry })
    setHandoverOpen(true)
  }

  return (
    <Stack spacing={1.5} sx={{ pb: 3 }}>
      <PageHeader
        title={`Đơn ${order.code}`}
        titleAdornment={
          <Stack direction="row" spacing={0.75}>
            <StatusChip status={order.status} size="medium" />
            <SourceChip source={order.source} size="medium" />
            <RequestTypeChip type={order.requestType} size="medium" />
          </Stack>
        }
        subtitle={`Tạo lúc ${formatDateTime(order.createdAt)}${order.createdBy ? ` bởi ${order.createdBy}` : ''}`}
        breadcrumbs={
          <Breadcrumbs>
            <Link component={RouterLink} to="/orders" underline="hover" color="inherit">
              Đơn sản xuất
            </Link>
            <Typography color="text.primary">{order.code}</Typography>
          </Breadcrumbs>
        }
        actions={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Tooltip title={canPrint ? '' : 'Chỉ in phiếu thợ khi đơn đã báo Đúc'}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<PrintIcon fontSize="small" />}
                  component={RouterLink}
                  to={`/orders/${order.code}/print`}
                  target="_blank"
                  disabled={!canPrint}
                >
                  In phiếu
                </Button>
              </span>
            </Tooltip>
            {/* Thao tác ít dùng gom vào menu để đầu trang chỉ còn một nút chính. */}
            <IconButton
              aria-label="Thao tác khác"
              onClick={(event) => setMoreMenu(event.currentTarget)}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              <MoreHorizIcon fontSize="small" />
            </IconButton>
          </Stack>
        }
      />

      <Menu anchorEl={moreMenu} open={Boolean(moreMenu)} onClose={() => setMoreMenu(null)}>
        <MenuItem
          onClick={() => {
            setMoreMenu(null)
            setEditing(true)
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Sửa đơn" />
        </MenuItem>
        <MenuItem
          disabled={locked}
          onClick={() => {
            setMoreMenu(null)
            setStatusDialog(true)
          }}
        >
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Đổi trạng thái" secondary={locked ? 'Đơn đã giao / đã xuất hàng' : undefined} />
        </MenuItem>
        {canDelete ? <Divider /> : null}
        {canDelete ? (
          <MenuItem
            onClick={() => {
              setMoreMenu(null)
              setDeleting(true)
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <TrashIcon />
            </ListItemIcon>
            <ListItemText primary="Xóa đơn" />
          </MenuItem>
        ) : null}
      </Menu>

      {!canPrint ? (
        <Alert severity="info">Đơn chưa báo Đúc — báo Đúc thì mới in được phiếu và giao khâu cho thợ.</Alert>
      ) : order.lastPrintedAt == null ? (
        <Alert severity="info">
          {isBtp ? 'Đơn BTP chưa in phiếu cho thợ.' : 'Đơn đã báo Đúc nhưng chưa in phiếu cho thợ.'}
        </Alert>
      ) : ticketStale ? (
        <Alert severity="warning">
          Dữ liệu đã thay đổi sau lần in gần nhất ({formatDateTime(order.lastPrintedAt)}) — nên in lại phiếu để phiếu
          và hệ thống khớp nhau.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Paper sx={{ px: { xs: 0.5, md: 1 } }}>
            <Tabs
              value={tab}
              onChange={(_, value: TabKey) => setTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ minHeight: 42, '& .MuiTab-root': { minHeight: 42, py: 0 } }}
            >
              {TABS.map((item) => (
                <Tab
                  key={item.value}
                  value={item.value}
                  label={
                    item.value === 'goods' && order.finishedGoods
                      ? `${item.label} (${order.finishedGoods.remainingQty})`
                      : item.label
                  }
                />
              ))}
            </Tabs>
          </Paper>

          {/* Mô tả, thông số và ảnh là một khối nhận diện đơn — gộp chung một thẻ cho trang ngắn lại. */}
          {tab === 'overview' ? (
            <Section title="Thông tin đơn">
              <InfoGrid order={order} />
              <Box sx={{ mt: 1.75, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <Gallery label="Ảnh chi tiết đơn hàng" images={order.images.filter((image) => image.kind === 'DETAIL')} />
                <Gallery label="Ảnh sản phẩm" images={order.images.filter((image) => image.kind === 'PRODUCT')} />
              </Box>
            </Section>
          ) : null}

          {tab === 'production' ? (
            <Section title="Quá trình sản xuất (theo phiếu thợ)">
              <SubTicketsPanel
                order={order}
                canManage={canManageTickets}
                isAdmin={isAdmin}
                locked={locked}
                canPrint={canPrint}
                busy={undoReturn.isPending}
                onConfirm={openConfirmHandover}
                onReturn={setReturning}
                onEditHandover={openEditHandover}
                onUndoReturn={(entry) => undoReturn.mutate(entry)}
              />
              {openEntry && !openEntry.subTicketId ? (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Thợ {openEntry.craftsmanName} đang làm khâu {STAGE_LABEL[openEntry.stage]} — KCS cân lại bạc khi thợ
                  nộp lại rồi mới giao khâu sau.
                </Alert>
              ) : null}
              {/* Phiếu mẹ chỉ để xem: cột khâu là số cộng của các phiếu con. */}
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Cả đơn (số cộng của các phiếu con)
              </Typography>
              <TicketMatrix order={order} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                Hao hụt bạc mỗi khâu: ≤ {SILVER_LOSS_LIMITS.ok}% đạt (xanh) · {SILVER_LOSS_LIMITS.ok}–
                {SILVER_LOSS_LIMITS.warn}% cần xem lại (vàng) · trên {SILVER_LOSS_LIMITS.warn}% quá cao (đỏ).
              </Typography>
              <ReworkHistory stages={stages} />

              {order.subTickets.length ? (
                <Typography variant="body2" sx={{ fontWeight: 700, mt: 2 }}>
                  Từng phiếu con — chốt Lỗi / Hoàn thiện ở đây
                </Typography>
              ) : null}
              {order.subTickets.map((ticket) => (
                <Box key={ticket.id} sx={{ mt: 1 }}>
                  <SubTicketMatrixCard order={order} ticket={ticket} isAdmin={isAdmin} linkToTicket />
                </Box>
              ))}
            </Section>
          ) : null}

          {tab === 'cost' ? (
            <OrderCostingCard code={order.code} editable={order.status !== 'DELIVERED'} />
          ) : null}

          {tab === 'goods' ? <FinishedGoodsCard order={order} /> : null}
        </Stack>

        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Section title="Mã QR">
            <Stack spacing={1} sx={{ alignItems: 'center' }}>
              <Box sx={{ p: 1, bgcolor: '#fff', border: '1px solid #d5dbe0', borderRadius: 1 }}>
                <QRCodeSVG value={orderTicketUrl(order.code)} size={148} marginSize={1} />
              </Box>
              <Typography variant="h6">{order.code}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                Quét để mở đơn và cập nhật khâu
              </Typography>
              <Typography variant="caption" color="text.secondary">
                In lần cuối: {formatDateTime(order.lastPrintedAt)}
              </Typography>
            </Stack>
          </Section>

          <Section title="Trạng thái đơn">
            <StatusTimeline order={order} isBtp={isBtp} />
          </Section>

          {isBtp ? (
            <Section title="BTP">
              <Stack spacing={1}>
                <Field
                  label="Mã BTP"
                  value={
                    order.btp ? (
                      <Link component={RouterLink} to={`/warehouses/${BTP_WAREHOUSE_CODE}/stock`}>
                        {order.btp.sku ?? '—'} · {order.btp.name}
                      </Link>
                    ) : (
                      'BTP đã bị gỡ khỏi kho'
                    )
                  }
                />
                <Typography variant="caption" color="text.secondary">
                  Lấy hàng đúc sẵn từ kho BTP — không qua 3D và Đúc. Phiếu xuất BTP và NVL tự tạo khi lên
                  đơn; đổi mã hoặc số lượng trên đơn thì kho tự cập nhật.
                </Typography>
              </Stack>
            </Section>
          ) : (
            <Section
              title="Đúc"
              action={
                <Button
                  size="small"
                  variant={order.castingSentDate ? 'outlined' : 'contained'}
                  disabled={order.status === 'DELIVERED'}
                  onClick={() => setCastingOpen(true)}
                >
                  {order.castingSentDate ? 'Cập nhật' : 'Báo Đúc'}
                </Button>
              }
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Field label="Ngày báo Đúc" value={formatStockedDate(order.castingSentDate)} />
                <Field label="Ngày Đúc về" value={formatStockedDate(order.castingReturnedDate)} />
              </Box>
            </Section>
          )}

        </Stack>
      </Box>

      <ProductionOrderFormDialog
        open={editing}
        order={order}
        lookups={lookups.data}
        saving={update.isPending}
        onClose={() => setEditing(false)}
        onSave={async (payload) => {
          const saved = await update.mutateAsync(payload)
          setEditing(false)
          afterProductionOrderSaved(queryClient, saved, order)
        }}
      />

      <CastingDialog
        open={castingOpen}
        sentDate={order.castingSentDate}
        returnedDate={order.castingReturnedDate}
        silverWeight={order.silverWeight}
        saving={casting.isPending}
        onClose={() => setCastingOpen(false)}
        onSave={(payload) => casting.mutate(payload, { onSuccess: () => setCastingOpen(false) })}
      />

      <HandoverDialog
        open={handoverOpen}
        state={handover}
        users={lookups.data?.users ?? []}
        saving={saveHandover.isPending}
        onClose={() => setHandoverOpen(false)}
        onExited={() => setHandover(null)}
        onSave={(payload) =>
          saveHandover.mutate(payload, {
            onSuccess: () => setHandoverOpen(false),
            // Máy chủ từ chối thì form đang mở đã không còn đúng (phiếu đổi trạng thái, thiếu
            // quyền…): đóng lại, toast đã nói lý do, tải lại đơn để thấy trạng thái thật.
            onError: () => {
              setHandoverOpen(false)
              void queryClient.invalidateQueries({ queryKey: ['production-order', code] })
            },
          })
        }
      />

      <KcsReturnDialog
        entry={returning}
        saving={saveReturn.isPending}
        onClose={() => setReturning(null)}
        onSave={(payload) =>
          returning && saveReturn.mutate({ entry: returning, payload }, { onSuccess: () => setReturning(null) })
        }
      />

      <StatusDialog
        open={statusDialog}
        current={order.status}
        isBtp={isBtp}
        saving={status.isPending}
        onClose={() => setStatusDialog(false)}
        onSave={(payload) => status.mutate(payload, { onSuccess: () => setStatusDialog(false) })}
      />

      <ConfirmDeleteDialog
        open={deleting}
        title="Xóa đơn sản xuất"
        description={`Xóa đơn ${order.code}? Ảnh của đơn cũng bị xóa khỏi kho ảnh.`}
        deleting={remove.isPending}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
      />
    </Stack>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.25, gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
        {value == null || value === '' ? '—' : value}
      </Typography>
    </Box>
  )
}

/**
 * Quy trình đơn xếp dọc: mỗi lần đổi trạng thái là một dòng theo thứ tự thời gian (kể cả
 * làm lại / ghi lỗi), dòng cuối là trạng thái hiện tại; các bước chưa tới liệt kê mờ phía dưới.
 */
function StatusTimeline({ order, isBtp }: { order: ProductionOrderDetail; isBtp: boolean }) {
  // API trả log mới nhất trước — đảo lại để đọc từ trên xuống theo thời gian.
  const logs = [...order.statusLogs].reverse()
  // Đơn BTP không qua 3D và Đúc; Sản xuất lỗi là nhánh ngoài luồng nên chỉ hiện khi đã xảy ra.
  const flow = STATUS_TABS.filter(
    (status) => status !== 'DEFECT' && !(isBtp && (status === 'REDO_3D' || status === 'CASTING')),
  )
  const passed = new Set(logs.map((log) => log.toStatus))
  // Đơn đang ở Sản xuất lỗi thì không nằm trong luồng — lấy mốc là bước trong luồng gần nhất đã qua.
  const anchor =
    flow.indexOf(order.status) >= 0
      ? order.status
      : [...logs].reverse().find((log) => flow.includes(log.toStatus))?.toStatus
  const anchorIndex = anchor ? flow.indexOf(anchor) : -1
  const pending = flow.filter((status, index) => index > anchorIndex && !passed.has(status))

  return (
    <Table
      size="small"
      sx={{
        '& td, & th': { px: 0.75, py: 0.5, fontSize: '0.78rem', borderColor: '#e3e8ec' },
        '& th': { fontWeight: 700, color: 'text.secondary' },
      }}
    >
      <TableHead>
        <TableRow>
          <TableCell>Trạng thái</TableCell>
          <TableCell>Thời gian</TableCell>
          <TableCell>Người xử lý</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {logs.map((log, index) => {
          const current = index === logs.length - 1
          return (
            <Fragment key={log.id}>
              <TableRow
                sx={{
                  ...(current ? { bgcolor: '#eaf3ff' } : null),
                  ...(log.note ? { '& td': { borderBottom: 'none' } } : null),
                }}
              >
                <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: current ? 700 : 400 }}>
                  <StatusDot status={log.toStatus} />
                  {STATUS_META[log.toStatus].label}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateShort(log.changedAt)}</TableCell>
                <TableCell>{log.changedBy ?? '—'}</TableCell>
              </TableRow>
              {log.note ? (
                <TableRow sx={current ? { bgcolor: '#eaf3ff' } : undefined}>
                  <TableCell colSpan={3} sx={{ pt: '0 !important', color: 'text.secondary', fontStyle: 'italic' }}>
                    {log.note}
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          )
        })}
        {pending.map((status) => (
          <TableRow key={status} sx={{ opacity: 0.45 }}>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
              <StatusDot status={status} />
              {STATUS_META[status].label}
            </TableCell>
            <TableCell>—</TableCell>
            <TableCell />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function StatusDot({ status }: { status: ProductionStatus }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 8,
        height: 8,
        mr: 0.75,
        borderRadius: '50%',
        bgcolor: STATUS_META[status].bg,
        border: '1px solid #b7c2cc',
        verticalAlign: 'middle',
      }}
    />
  )
}

function InfoGrid({ order }: { order: ProductionOrderDetail }) {
  const orderFields: Array<[string, ReactNode]> = [
    ['Ngày đặt đơn', formatStockedDate(order.receivedDate)],
    ['Ngày cần trả', order.dueDate ? formatStockedDate(order.dueDate) : null],
    ['Thời gian cần', order.leadTime],
    ['Số lượng', `${order.qty}${order.qtyUnit ? ` ${order.qtyUnit}` : ''} · đã trả ${order.returnedQty}`],
    ['Người chốt', order.closedBy],
    ['Người được hỏi', order.askedUserName],
    ['Mã theo dõi đơn', order.trackingCode],
    ['Công nợ', order.debtStatus],
  ]

  const productFields: Array<[string, ReactNode]> = [
    ['Size', order.sizeLabel],
    ['Kích thước', order.size],
    ['Chất liệu', order.mainMaterial],
    ['Màu sắc (xi)', order.platingColor],
    ['Loại đá', order.stoneTypes.length ? order.stoneTypes.join(', ') : null],
    ['Màu đá', order.stoneColor],
    ['Số lượng đá (viên)', order.stoneCount],
    ['Trọng lượng đá (g)', order.stoneWeight != null ? formatQty(order.stoneWeight) : null],
    ['Tổng TL bạc (g)', order.silverWeight != null ? formatQty(order.silverWeight) : null],
  ]

  // Đơn không tách thì Phân đơn luôn là 1/1 — giấu cả nhóm cho đỡ rối.
  const splitFields: Array<[string, ReactNode]> = [
    ['Phân đơn', `${order.split.no}/${order.split.total}`],
    [
      'Đơn mẹ',
      order.parentCode ? (
        <Link component={RouterLink} to={`/orders/${order.parentCode}`}>
          {order.parentCode}
        </Link>
      ) : null,
    ],
    [
      'Đơn con',
      order.children.length ? (
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {order.children.map((child) => (
            <Link key={child.code} component={RouterLink} to={`/orders/${child.code}`}>
              {child.code} ({STATUS_META[child.status].label})
            </Link>
          ))}
        </Stack>
      ) : null,
    ],
  ]
  const hasSplit = order.parentCode != null || order.children.length > 0

  return (
    <Stack spacing={1.75}>
      <Box sx={{ p: 1.25, bgcolor: '#f4f6f7', borderRadius: 1 }}>
        <Field label="Mô tả / Yêu cầu sản phẩm" value={order.description} />
      </Box>

      <FieldGroup title="Đơn hàng" fields={orderFields} />

      <FieldGroup title="Sản phẩm" fields={productFields}>
        <Box sx={{ mt: 1, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <Field label="Nội dung khắc laser" value={order.laserEngraving} />
          <Field label="Yêu cầu khác" value={order.otherRequirements} />
        </Box>
      </FieldGroup>

      {hasSplit ? <FieldGroup title="Phân đơn" fields={splitFields} /> : null}
    </Stack>
  )
}

/** Một nhóm trường trong khối thông tin đơn: tiêu đề nhỏ + lưới 4 cột. */
function FieldGroup({
  title,
  fields,
  children,
}: {
  title: string
  fields: Array<[string, ReactNode]>
  children?: ReactNode
}) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
      >
        {title}
      </Typography>
      <Box
        sx={{
          mt: 0.5,
          display: 'grid',
          columnGap: 2,
          rowGap: 1,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        {fields.map(([label, value]) => (
          <Field key={label} label={label} value={value} />
        ))}
      </Box>
      {children}
    </Box>
  )
}

function Gallery({ label, images }: { label: string; images: ProductionOrderDetail['images'] }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
        {label} ({images.length})
      </Typography>
      {images.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có ảnh
        </Typography>
      ) : (
        <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
          {images.map((image) => (
            <Box
              key={image.id}
              component="a"
              href={image.url}
              target="_blank"
              rel="noreferrer"
              sx={{ display: 'block', width: 96, height: 96 }}
            >
              <Box
                component="img"
                src={cloudinaryThumb(image.url, 192)}
                alt=""
                loading="lazy"
                sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 1, border: '1px solid #d5dbe0' }}
              />
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}

type TabKey = 'overview' | 'production' | 'cost' | 'goods'

/** Trang chi tiết chia theo việc: xem đơn → làm hàng → tiền → giao hàng. */
const TABS: Array<{ value: TabKey; label: string }> = [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'production', label: 'Sản xuất' },
  { value: 'cost', label: 'Chi phí' },
  { value: 'goods', label: 'Kho thành phẩm' },
]

/** Các lần làm trước của khâu đã làm lại — phiếu chỉ in lần gần nhất nên liệt kê riêng. */
function ReworkHistory({ stages }: { stages: StageEntry[] }) {
  const columns = stageColumns(stages)
  const shown = new Set(STAGES.flatMap((stage) => columns[stage].entries.map((entry) => entry.id)))
  const older = stages.filter((entry) => !shown.has(entry.id))
  if (older.length === 0) return null

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Các lần làm trước (đã làm lại)
      </Typography>
      <Stack spacing={0.5}>
        {older.map((entry) => (
          <Typography key={entry.id} variant="body2" color="text.secondary">
            {STAGE_LABEL[entry.stage]} lần {entry.attempt}
            {entry.subTicketNo ? ` (phiếu con ${entry.subTicketNo})` : ''}: thợ {entry.craftsmanName}, giao{' '}
            {formatDateShort(entry.handedAt)} ({entry.handedSilverWeight ? formatQty(entry.handedSilverWeight) : '—'} g
            bạc) → KCS {entry.returnedByName ?? '—'} nhận lại {formatDateShort(entry.returnedAt)} (
            {entry.returnedSilverWeight ? formatQty(entry.returnedSilverWeight) : '—'} g bạc), hao hụt{' '}
            {entry.silverLoss != null ? `${formatQty(entry.silverLoss)} g` : '—'}
          </Typography>
        ))}
      </Stack>
    </Box>
  )
}

/** Đơn trong kho thành phẩm: vào kho khi chốt Hoàn thiện trên phiếu, xuất từng phần qua phiếu xuất hàng. */
function FinishedGoodsCard({ order }: { order: ProductionOrderDetail }) {
  const goods = order.finishedGoods
  return (
    <Section title="Kho thành phẩm & xuất hàng">
      {!goods ? (
        <Typography variant="body2" color="text.secondary">
          Chưa vào kho thành phẩm — đơn vào kho khi bấm “Xác nhận hoàn thiện” ở cột Hoàn thiện trên phiếu.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Field label="Nhập kho" value={`${formatDateTime(goods.receivedAt)} · ${goods.receivedByName}`} />
            <Field label="Số lượng nhập" value={goods.qty} />
            <Field label="Đã xuất" value={`${goods.shippedQty} / ${goods.qty}`} />
            <Field label="Còn trong kho" value={goods.remainingQty} />
          </Box>
          {goods.shipments.length ? (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Phiếu xuất hàng
              </Typography>
              {goods.shipments.map((shipment) => (
                <Typography key={shipment.code} variant="body2">
                  <Link component={RouterLink} to={`/finished-goods/shipments/${shipment.code}`} sx={{ fontWeight: 600 }}>
                    {shipment.code}
                  </Link>{' '}
                  · {formatStockedDate(shipment.shippedAt)} · {shipment.customerName} · SL {shipment.qty}
                </Typography>
              ))}
            </Stack>
          ) : null}
          {goods.remainingQty > 0 ? (
            <Button
              variant="outlined"
              size="small"
              component={RouterLink}
              to={`/warehouses/thanh-pham/outbound?create=${order.code}`}
              sx={{ alignSelf: 'flex-start' }}
            >
              Lập phiếu xuất hàng
            </Button>
          ) : null}
        </Stack>
      )}
    </Section>
  )
}

function StatusDialog({
  open,
  current,
  isBtp,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  current: ProductionStatus
  isBtp: boolean
  saving: boolean
  onClose: () => void
  onSave: (payload: { status: ProductionStatus; note?: string }) => void
}) {
  const [target, setTarget] = useState<ProductionStatus | ''>('')
  const [note, setNote] = useState('')

  // Đơn BTP không qua 3D nên không có Sửa 3D.
  const manual = MANUAL_STATUSES.filter((item) => item !== current && !(isBtp && item === 'REDO_3D'))
  const options = manual.map((item) => ({
    value: item,
    label: STATUS_META[item].label,
    disabled: (item === 'NEW' || item === 'REDO_3D') && isInStage(current),
  }))
  const noteRequired = target === 'DEFECT'

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        transition: {
          onExited: () => {
            setTarget('')
            setNote('')
          },
        },
      }}
    >
      <DialogTitle>Đổi trạng thái đơn</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary">
          Đúc đổi qua nút “Báo Đúc”; Nguội → Xi đổi khi giao khâu cho thợ; Hoàn thiện chốt ở cột Hoàn thiện
          trên phiếu; Đã giao tự đổi khi lập phiếu xuất hàng đủ số lượng. Đơn trong kho thành phẩm (chưa xuất)
          chuyển Sản xuất lỗi thì rút khỏi kho.
        </Typography>
        <SelectInput<ProductionStatus>
          label="Trạng thái mới"
          value={target}
          onChange={setTarget}
          options={options}
          required
        />
        <TextInput
          label={noteRequired ? 'Mô tả lỗi' : 'Ghi chú'}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          required={noteRequired}
          multiline
          minRows={2}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button
          variant="contained"
          disabled={saving || !target || (noteRequired && !note.trim())}
          onClick={() => target && onSave({ status: target, note: note.trim() || undefined })}
        >
          Lưu
        </Button>
      </DialogActions>
    </Dialog>
  )
}
