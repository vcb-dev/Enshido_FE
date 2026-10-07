import { Fragment, useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
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
import SyncIcon from '@mui/icons-material/Sync'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { QRCodeSVG } from 'qrcode.react'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { can, Permission } from '../auth/permissions'
import {
  changeProductionStatusApi,
  type StatusLog,
  cancelOrderPendingApi,
  deleteProductionOrderApi,
  getProductionOrderApi,
  getProductionOrderLookupsApi,
  handoverOrderApi,
  assignSubTicketApi,
  confirmStageApi,
  handoverSubTicketApi,
  openOrderStageApi,
  undoFinishOrderApi,
  undoReturnApi,
  updateCastingApi,
  updateProductionOrderApi,
  type CastingPayload,
  type HandoverPayload,
  type ProductionOrderDetail,
  type ProductionStatus,
  type StageCode,
  type StageEntry,
  type SubTicket,
  type SubTicketState,
  type UpsertProductionOrderPayload,
} from '../api/productionOrders'
import { formatQty, formatStockedDate } from '../api/inventory'
import { ImageLightbox, ZoomThumb } from '../components/ImageLightbox'
import { DialogForm, FormSelect, FormTextField, OrderDetailSkeleton, PageHeader, TrashIcon } from '../components/ui'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'
import { WorkHistory } from '../orders/WorkHistory'
import { OrderCostingCard } from '../orders/OrderCostingCard'
import {
  formatDateShort,
  formatDateTime,
  isInStage,
  MANUAL_STATUSES,
  parentWorkTicketUrl,
  subTicketUrl,
  SILVER_LOSS_LIMITS,
  STAGE_LABEL,
  STAGES,
  STATUS_META,
  STATUS_TABS,
} from '../orders/catalog'
import { BTP_WAREHOUSE_CODE, invalidateBtpStock } from '../orders/btpStock'
import { invalidateNvlStock } from '../orders/nvlStock'
import { afterProductionOrderSaved, removeProductionOrderFromLists } from '../orders/orderCache'
import { RequestTypeChip, SourceChip, StatusChip, SubTicketStateChip } from '../orders/OrderChips'
import { ProductionOrderFormDialog } from '../orders/ProductionOrderFormDialog'
import { CastingDialog, HandoverDialog, type HandoverDialogState } from '../orders/StageDialogs'
import { SubTicketToolbar } from '../orders/SubTicketToolbar'
import { SubTicketWorkActions } from '../orders/SubTicketWorkActions'
import { AssignWorkerDialog } from '../orders/SubTicketDialogs'
import { KeeperConfirmDialog } from '../orders/KeeperConfirmDialog'
import { StoneSkipBar } from '../orders/StoneSkipBar'
import { ticketTimeline, TICKET_PHASE_STATUSES, type TicketTimelineRow } from '../orders/ticketTimeline'
import { useOrderMutation } from '../orders/useOrderMutation'
import { stageColumns } from '../orders/ticketRows'
import { MaterialRequestsCard } from '../orders/MaterialRequests'
import { SubTicketMatrixCard } from '../orders/SubTicketMatrixCard'
import { CollapsibleMatrix } from '../orders/CollapsibleMatrix'
import { TicketMatrix } from '../orders/TicketMatrix'
import { deadlineWarning } from '../orders/deadline'
import { VerticalInfoList } from '../orders/VerticalInfoList'
import { LIVE_REFRESH_MS, liveRefresh } from '../hooks/liveRefresh'

export function ProductionOrderDetailPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.roleCode === 'ADMIN' || Boolean(user?.extraRoles?.includes('ADMIN'))

  const [editing, setEditing] = useState(false)
  const [handover, setHandover] = useState<HandoverDialogState | null>(null)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [keeperTarget, setKeeperTarget] = useState<StageEntry | null>(null)
  const [assignTarget, setAssignTarget] = useState<{
    ticket: SubTicket
    stageOptions: StageCode[]
  } | null>(null)
  const [castingOpen, setCastingOpen] = useState(false)
  const [statusDialog, setStatusDialog] = useState(false)
  const [statusPreset, setStatusPreset] = useState<ProductionStatus | null>(null)
  const [parentStageDialog, setParentStageDialog] = useState(false)
  const [moreMenu, setMoreMenu] = useState<HTMLElement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedSubTicketId, setSelectedSubTicketId] = useState<string | null>(null)

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
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    // Thợ nhận phiếu / báo xong trên điện thoại của họ — không tự làm mới thì màn này đứng
    // ở trạng thái cũ tới khi tải lại trang. Các hộp thoại chỉ nạp form lúc mở nên làm mới
    // giữa chừng không xoá thứ người dùng đang gõ.
    // Thợ cập nhật trên máy khác — vá cache khi cùng phiên; poll khi đang xem tab Sản xuất.
    ...liveRefresh(tab === 'production' ? LIVE_REFRESH_MS.active : false),
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
  // Đơn không chia chạy trực tiếp trên phiếu mẹ; đơn chia phiếu được giao cho thợ theo từng phiếu.
  const saveHandover = useOrderMutation(
    code,
    (payload: HandoverPayload) => {
      if (handover?.mode === 'confirm') {
        // Thợ là người đã tự nhận phiếu, khâu là khâu đang mở — server tự lấy.
        return handoverSubTicketApi(code, handover.ticket.no, {
          handedAt: payload.handedAt,
          handedQty: payload.handedQty,
          handedSilverWeight: payload.handedSilverWeight,
          note: payload.note,
          materials: payload.materials,
        })
      }
      if (handover?.mode === 'confirm-order') {
        return handoverOrderApi(code, {
          handedAt: payload.handedAt,
          handedQty: payload.handedQty,
          handedSilverWeight: payload.handedSilverWeight,
          note: payload.note,
          materials: payload.materials,
        })
      }
      throw new Error('Không có khâu nào để giao')
    },
    handover?.mode === 'confirm-order' ? 'Đã xác nhận giao trên phiếu mẹ' : 'Đã xác nhận giao cho thợ',
  )
  const assignWorker = useOrderMutation(
    code,
    ({
      ticket,
      stage,
      craftsmanUserId,
      stones,
    }: {
      ticket: SubTicket
      stage: StageCode
      craftsmanUserId: string
      stones: Array<{
        materialId: string
        stoneCount: number | null
        weight: string
      }>
    }) => assignSubTicketApi(code, ticket.no, { stage, craftsmanUserId, stones }),
    'Đã chỉ định thợ — thợ quét QR nhận hàng',
  )
  const confirmStage = useOrderMutation(
    code,
    (entry: StageEntry) => confirmStageApi(code, entry.id),
    'Thủ kho đã xác nhận — hàng đạt nhập kho BTP, hàng lỗi + nguyên liệu thừa nhập kho NVL',
  )
  const undoReturn = useOrderMutation(code, (entry: StageEntry) => undoReturnApi(code, entry.id), 'Đã gỡ nhận lại')
  const status = useOrderMutation(
    code,
    (payload: { status: ProductionStatus; note?: string }) => changeProductionStatusApi(code, payload),
    'Đã đổi trạng thái',
  )
  const undoFinish = useOrderMutation(code, () => undoFinishOrderApi(code), 'Đã gỡ hoàn thiện đơn')
  const openParentStage = useOrderMutation(
    code,
    (stage: StageCode) => openOrderStageApi(code, stage),
    'Đã mở khâu trên phiếu mẹ cho thợ nhận',
  )
  const cancelParentStage = useOrderMutation(
    code,
    () => cancelOrderPendingApi(code),
    'Đã hủy mở khâu trên phiếu mẹ',
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
      removeProductionOrderFromLists(queryClient, detail.data!.id, code)
      navigate('/orders', { replace: true })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (detail.isLoading) return <OrderDetailSkeleton />
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
  const directOnParent = order.subTickets.length === 0
  const splitIntoTickets = order.subTickets.length >= 2
  const parentStages = stages.filter((entry) => !entry.subTicketId)
  const parentOpenEntry = parentStages.find((entry) => !entry.returnedAt)
  const parentWork = order.workTicket
  const parentLastEntry = parentStages.at(-1)
  const parentReworking = !isInStage(order.status)
  const parentOpenableStages =
    !parentLastEntry || parentReworking
      ? STAGES
      : STAGES.filter((stage) => STAGES.indexOf(stage) > STAGES.indexOf(parentLastEntry.stage))
  // Đơn BTP lấy hàng đúc sẵn: không qua Đúc, giao khâu và in phiếu ngay.
  const isBtp = order.source === 'BTP'
  // Đơn NVL vào Nguội khi đã cắt cây thông (cân phôi); đơn cũ nhập tay đi theo ngày Đúc.
  const canPrint = isBtp || Boolean(order.castingSentDate || order.cutAt)
  const castingReady = isBtp || Boolean(order.cutAt || (order.castingSentDate && order.castingReturnedDate))
  const locked = order.status === 'DELIVERED' || (order.finishedGoods?.shippedQty ?? 0) > 0
  // Người lên đơn, thủ kho và admin được chia phiếu con (khớp `canManage` phía BE).
  const canManageTickets =
    isAdmin || can(user, Permission.WAREHOUSE_KEEPER) || (user != null && order.createdByUserId === user.id)
  // QC nhận lại hàng và chốt Lỗi / Hoàn thiện.
  const canDelete =
    isAdmin &&
    stages.length === 0 &&
    !order.lastPrintedAt &&
    (order.status === 'NEW' || (isBtp && order.status === 'WAIT_FILING'))
  const ticketStale = order.lastPrintedAt != null && order.dataChangedAt > order.lastPrintedAt

  function openConfirmHandover(ticket: SubTicket) {
    setHandover({ mode: 'confirm', ticket })
    setHandoverOpen(true)
  }

  return (
    <Stack spacing={1.5} sx={{ pb: 3 }}>
      <PageHeader
        title={`Lệnh ${order.intakeSxCode || order.code}`}
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
              Lệnh sản xuất
            </Link>
            <Typography color="text.primary">{order.intakeSxCode || order.code}</Typography>
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
                  to={directOnParent ? `/orders/${order.code}/print` : `/orders/${order.code}/tickets/print-all`}
                  target="_blank"
                  disabled={!canPrint}
                >
                  {directOnParent ? 'In phiếu' : `In ${order.subTickets.length} phiếu con`}
                </Button>
              </span>
            </Tooltip>
            {/* Thao tác ít dùng gom vào menu để đầu trang chỉ còn một nút chính. */}
            <IconButton
              aria-label="Thao tác khác"
              onClick={(event) => setMoreMenu(event.currentTarget)}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
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
            setStatusPreset(null)
            setStatusDialog(true)
          }}
        >
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Đổi trạng thái" secondary={locked ? 'Đơn đã giao / đã xuất hàng' : undefined} />
        </MenuItem>
        {directOnParent ? null : (
          <MenuItem
            component={RouterLink}
            to={`/orders/${order.code}/print`}
            target="_blank"
            disabled={!canPrint}
            onClick={() => setMoreMenu(null)}
          >
            <ListItemIcon>
              <PrintIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="In phiếu tổng" secondary="Không có mã QR — QR nằm trên từng phiếu con" />
          </MenuItem>
        )}
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
        <Alert severity="info">
          Đơn chưa có phôi sau đúc — thủ kho cắt cây thông (cân phôi) để chuyển sang Nguội.
        </Alert>
      ) : order.lastPrintedAt == null ? (
        <Alert severity="info">
          {isBtp ? 'Đơn BTP chưa in phiếu cho thợ.' : 'Đơn đã sẵn sàng vào Nguội nhưng chưa in phiếu cho thợ.'}
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
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 300px' },
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
            <Section title="Tổng quan đơn">
              <OverviewSummary
                order={order}
                onOpenProduction={() => setTab('production')}
              />
              {splitIntoTickets ? <ProductionTicketSummary tickets={order.subTickets} /> : null}
              <Divider sx={{ my: 2 }} />
              <InfoGrid order={order} />
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Gallery label="Ảnh chi tiết đơn hàng" images={order.images.filter((image) => image.kind === 'DETAIL')} />
                <Gallery label="Ảnh sản phẩm" images={order.images.filter((image) => image.kind === 'PRODUCT')} />
              </Stack>
            </Section>
          ) : null}

          {tab === 'production' ? (
            <Section
              title="Điều hành sản xuất"
              action={
                <SyncStatus
                  fetching={detail.isFetching}
                  updatedAt={detail.dataUpdatedAt}
                  onRefresh={() => void detail.refetch()}
                />
              }
            >
              {directOnParent ? (
                <Box
                  sx={{
                    mb: 1.5,
                    p: 1.25,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: '#f8fafb',
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{
                      justifyContent: 'space-between',
                      alignItems: { sm: 'center' },
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Quy trình trên phiếu mẹ
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Người điều hành mở khâu; thợ xem phiếu {order.code} ở “Phiếu của tôi” và tự nhận.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      {parentWork?.state === 'CLAIMED' && !canManageTickets ? (
                        <Typography variant="caption" color="text.secondary">
                          chờ người lên đơn chọn NVL và giao
                        </Typography>
                      ) : parentWork?.state === 'CLAIMED' ? (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            setHandover({
                              mode: 'confirm-order',
                              ticket: parentWork,
                            })
                            setHandoverOpen(true)
                          }}
                        >
                          Xác nhận giao
                        </Button>
                      ) : parentWork?.state === 'SUBMITTED' && parentOpenEntry ? (
                        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                          Chờ QC nhận lại (màn Phiếu QC)
                        </Typography>
                      ) : parentWork?.state === 'WORKING' ? (
                        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                          Chờ thợ báo xong
                        </Typography>
                      ) : parentWork?.state === 'WAITING' ? (
                        <Button
                          size="small"
                          color="inherit"
                          loading={cancelParentStage.isPending}
                          onClick={() => cancelParentStage.mutate(undefined)}
                        >
                          Hủy mở khâu
                        </Button>
                      ) : parentOpenableStages.length > 0 && !order.finishedGoods ? (
                        <Tooltip
                          title={castingReady ? '' : 'Cắt cây thông (cân phôi) cho đơn trước khi giao khâu'}
                        >
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={!castingReady || locked}
                              onClick={() => setParentStageDialog(true)}
                            >
                              Mở khâu cho thợ nhận
                            </Button>
                          </span>
                        </Tooltip>
                      ) : null}
                    </Stack>
                  </Stack>
                  {parentWork && parentWork.state !== 'IDLE' ? (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <SubTicketStateChip state={parentWork.state} />
                        <Typography variant="body2">
                          {parentWork.state === 'WAITING'
                            ? `Khâu ${STAGE_LABEL[parentWork.pendingStage!]} đang chờ thợ nhận.`
                            : parentWork.state === 'CLAIMED'
                              ? `Thợ ${parentWork.claimedByName ?? '—'} đã nhận khâu ${STAGE_LABEL[parentWork.pendingStage!]} — chờ cân bạc và xác nhận giao.`
                              : parentWork.state === 'SUBMITTED'
                                ? `Thợ ${parentOpenEntry?.craftsmanName ?? '—'} đã báo xong — chờ QC cân lại.`
                                : `Thợ ${parentOpenEntry?.craftsmanName ?? '—'} đang làm khâu ${parentWork.activeStage ? STAGE_LABEL[parentWork.activeStage] : '—'}.`}
                        </Typography>
                      </Stack>
                    </Alert>
                  ) : null}
                  <Box sx={{ mt: 0.5 }}>
                    <WorkHistory order={order} ticket={null} />
                  </Box>
                </Box>
              ) : (
                // Đơn đã chia phiếu con không còn khung phiếu mẹ — thao tác cấp đơn xem ở đây.
                <Box sx={{ mb: 1 }}>
                  <WorkHistory order={order} ticket={null} />
                </Box>
              )}
              {directOnParent ? (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Phiếu sản xuất {order.code}
                  </Typography>
                  <CollapsibleMatrix>
                    <TicketMatrix
                      order={order}
                      outcomeActions={{
                        FINISH: order.finishedGoods ? (
                          isAdmin && (order.finishedGoods.shippedQty ?? 0) === 0 ? (
                            <Button
                              size="small"
                              color="inherit"
                              loading={undoFinish.isPending}
                              onClick={() => undoFinish.mutate(undefined)}
                            >
                              Gỡ hoàn thiện
                            </Button>
                          ) : null
                        ) : null,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                      Hao hụt bạc mỗi khâu: ≤ {SILVER_LOSS_LIMITS.ok}% đạt (xanh) · {SILVER_LOSS_LIMITS.ok}–
                      {SILVER_LOSS_LIMITS.warn}% cần xem lại (vàng) · trên {SILVER_LOSS_LIMITS.warn}% quá cao (đỏ).
                    </Typography>
                  </CollapsibleMatrix>
                  <ReworkHistory stages={parentStages} />
                  {order.workTicket ? (
                    <Box sx={{ mt: 1.5 }}>
                      <MaterialRequestsCard
                        order={order}
                        ticketNo={null}
                        materials={order.workTicket.materials}
                        userId={user?.id ?? null}
                        canHandle={can(user, Permission.WAREHOUSE_KEEPER)}
                        isAdmin={isAdmin}
                      />
                    </Box>
                  ) : null}
                </Box>
              ) : null}
              <SubTicketToolbar order={order} canManage={canManageTickets} locked={locked} />
              <StoneSkipBar order={order} locked={locked} />
              {order.subTickets.length ? (() => {
                const selectedTicket =
                  order.subTickets.find((ticket) => ticket.id === selectedSubTicketId) ??
                  (!splitIntoTickets ? order.subTickets[0] : undefined)
                const selectedTab = splitIntoTickets
                  ? selectedTicket?.id ?? 'all-tickets'
                  : selectedTicket?.id ?? order.subTickets[0].id
                const showingSummary = splitIntoTickets && selectedTab === 'all-tickets'
                return (
                  <Paper variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
                    <Tabs
                      variant="scrollable"
                      scrollButtons="auto"
                      value={selectedTab}
                      onChange={(_, value: string) => setSelectedSubTicketId(value)}
                      aria-label="Phiếu con"
                      sx={{
                        borderBottom: 1,
                        borderColor: 'divider',
                        bgcolor: '#f8f3eb',
                        '& .MuiTab-root': { alignItems: 'flex-start', textAlign: 'left', minHeight: 56, px: 1.5 },
                      }}
                    >
                      {splitIntoTickets ? (
                        <Tab
                          value="all-tickets"
                          id="sub-ticket-tab-all"
                          aria-controls="sub-ticket-panel-all"
                          label={<Typography variant="body2" sx={{ fontWeight: 700 }}>Tổng hợp cả đơn</Typography>}
                        />
                      ) : null}
                      {order.subTickets.map((ticket) => (
                        <Tab
                          key={ticket.id}
                          value={ticket.id}
                          id={`sub-ticket-tab-${ticket.id}`}
                          aria-controls={`sub-ticket-panel-${ticket.id}`}
                          label={
                            <Stack spacing={0.5} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{ticket.code}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {ticket.qty} sp · {ticket.activeStage ? STAGE_LABEL[ticket.activeStage] : 'Chưa có khâu'}
                              </Typography>
                            </Stack>
                          }
                        />
                      ))}
                    </Tabs>
                    <Box
                      role="tabpanel"
                      id={showingSummary ? 'sub-ticket-panel-all' : `sub-ticket-panel-${selectedTicket!.id}`}
                      aria-labelledby={showingSummary ? 'sub-ticket-tab-all' : `sub-ticket-tab-${selectedTicket!.id}`}
                      sx={{ minWidth: 0, p: { xs: 1, md: 1.5 } }}
                    >
                      {showingSummary ? (
                        <>
                          <CollapsibleMatrix>
                            <TicketMatrix order={order} />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                              Hao hụt bạc mỗi khâu: ≤ {SILVER_LOSS_LIMITS.ok}% đạt (xanh) · {SILVER_LOSS_LIMITS.ok}–
                              {SILVER_LOSS_LIMITS.warn}% cần xem lại (vàng) · trên {SILVER_LOSS_LIMITS.warn}% quá cao (đỏ).
                            </Typography>
                          </CollapsibleMatrix>
                          <ReworkHistory stages={stages} />
                        </>
                      ) : selectedTicket ? (
                        <>
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                              <Link component={RouterLink} to={`/tickets/${selectedTicket.code}`} sx={{ fontWeight: 700 }}>
                                {selectedTicket.code}
                              </Link>
                              <SubTicketStateChip state={selectedTicket.state} />
                              <Typography variant="caption" color="text.secondary">
                                {Number(selectedTicket.materials.issuedMetalWeight)
                                  ? `Xuất thêm ${formatQty(selectedTicket.materials.issuedMetalWeight)} g bạc · `
                                  : ''}
                                {selectedTicket.materials.pendingCount
                                  ? `${selectedTicket.materials.pendingCount} yêu cầu chờ xuất`
                                  : ''}
                              </Typography>
                            </Stack>
                            {/* Mã QR của chính phiếu con: thợ quét để vào phiếu, nhận việc, báo xong từng khâu. */}
                            <Stack spacing={0.25} sx={{ alignItems: 'center', flexShrink: 0 }}>
                              <Box
                                component={RouterLink}
                                to={`/tickets/${selectedTicket.code}`}
                                aria-label={`Mở phiếu ${selectedTicket.code}`}
                                sx={{ p: 0.75, bgcolor: '#fff', border: '1px solid #ded3c3', borderRadius: 1, lineHeight: 0 }}
                              >
                                <QRCodeSVG value={subTicketUrl(selectedTicket.code)} size={88} marginSize={0} />
                              </Box>
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                {selectedTicket.code}
                              </Typography>
                            </Stack>
                          </Stack>
                          <Box sx={{ mb: 1.25 }}>
                            <SubTicketWorkActions
                              order={order}
                              ticket={selectedTicket}
                              canManage={canManageTickets}
                              isAdmin={isAdmin}
                              locked={locked}
                              canPrint={canPrint}
                              busy={undoReturn.isPending}
                              undoingEntryId={undoReturn.isPending ? undoReturn.variables?.id : null}
                              onConfirm={openConfirmHandover}
                              onAssign={(ticket, stageOptions) => setAssignTarget({ ticket, stageOptions })}
                              onKeeperConfirm={setKeeperTarget}
                              onUndoReturn={(entry) => undoReturn.mutate(entry)}
                            />
                          </Box>
                          <CollapsibleMatrix>
                            <SubTicketMatrixCard
                              order={order}
                              ticket={selectedTicket}
                              isAdmin={isAdmin}
                              showHeader={false}
                              showQr={false}
                              embedded
                            />
                          </CollapsibleMatrix>
                          <Box sx={{ mt: 1.5 }}>
                            <MaterialRequestsCard
                              order={order}
                              ticketNo={selectedTicket.no}
                              materials={selectedTicket.materials}
                              userId={user?.id ?? null}
                              canHandle={can(user, Permission.WAREHOUSE_KEEPER)}
                              isAdmin={isAdmin}
                            />
                          </Box>
                        </>
                      ) : null}
                    </Box>
                  </Paper>
                )
              })() : null}
            </Section>
          ) : null}

          {tab === 'cost' ? (
            <OrderCostingCard code={order.code} />
          ) : null}

          {tab === 'goods' ? <FinishedGoodsCard order={order} /> : null}
        </Stack>

        <Stack
          spacing={1.5}
          sx={{
            minWidth: 0,
            position: { lg: 'sticky' },
            top: { lg: 12 },
            alignSelf: 'start',
          }}
        >
          {directOnParent ? (
            <Section title="Mã QR">
              <Stack spacing={1} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: '#fff',
                    border: '1px solid #ded3c3',
                    borderRadius: 1,
                  }}
                >
                  <QRCodeSVG value={parentWorkTicketUrl(order.code)} size={112} marginSize={1} />
                </Box>
                <Typography variant="h6">{order.code}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                  Quét để mở phiếu và cập nhật khâu
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  In lần cuối: {formatDateTime(order.lastPrintedAt)}
                </Typography>
              </Stack>
            </Section>
          ) : null}

          <Section title="Trạng thái đơn">
            <StatusTimeline order={order} isBtp={isBtp} selectedTicketId={selectedSubTicketId} />
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
              </Stack>
            </Section>
          ) : (
            <Section
              title="Đúc"
              action={
                // Đã cắt cây thông hoặc đã giao khâu thì đơn đã vào Nguội — số liệu đúc đã chốt.
                order.cutAt || order.stages.length > 0 ? null : (
                  <Button
                    size="small"
                    variant={order.castingSentDate ? 'outlined' : 'contained'}
                    disabled={order.status === 'DELIVERED'}
                    onClick={() => setCastingOpen(true)}
                  >
                    {order.castingSentDate ? 'Cập nhật' : 'Báo Đúc'}
                  </Button>
                )
              }
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Field label="Ngày báo Đúc" value={formatStockedDate(order.castingSentDate)} />
                <Field label="Ngày Đúc về" value={formatStockedDate(order.castingReturnedDate)} />
                <Field
                  label="Phôi sau đúc"
                  value={
                    order.cut ? (
                      formatDateTime(order.cut.cutAt)
                    ) : (
                      'Chưa có phôi'
                    )
                  }
                />
                <Field
                  label="Phôi nhận"
                  value={order.cut ? `${order.cut.qty} sp · ${formatQty(order.cut.weight)} g` : '—'}
                />
              </Box>
              <Gallery label="Ảnh cân phôi sau đúc" images={order.images.filter((image) => image.kind === 'CUT_BLANK')} />
            </Section>
          )}

        </Stack>
      </Box>

      {editing ? (
        <ProductionOrderFormDialog
          open
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
      ) : null}

      <CastingDialog
        open={castingOpen}
        sentDate={order.castingSentDate}
        returnedDate={order.castingReturnedDate}
        saving={casting.isPending}
        onClose={() => setCastingOpen(false)}
        onSave={(payload) => casting.mutate(payload, { onSuccess: () => setCastingOpen(false) })}
      />

      <HandoverDialog
        open={handoverOpen}
        order={order}
        state={handover}
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
              void queryClient.invalidateQueries({
                queryKey: ['production-order', code],
              })
            },
          })
        }
      />

      <KeeperConfirmDialog
        entry={keeperTarget}
        ticketCode={
          order.subTickets.find((ticket) => ticket.no === keeperTarget?.subTicketNo)?.code ?? order.code
        }
        saving={confirmStage.isPending}
        onClose={() => setKeeperTarget(null)}
        onConfirm={(entry) =>
          confirmStage.mutate(entry, {
            onSuccess: () => setKeeperTarget(null),
            onError: () => setKeeperTarget(null),
          })
        }
      />

      <AssignWorkerDialog
        open={assignTarget != null}
        ticket={assignTarget?.ticket ?? null}
        stageOptions={assignTarget?.stageOptions ?? []}
        workers={(lookups.data?.users ?? []).filter((worker) => lookups.data?.workerIds.includes(worker.id))}
        saving={assignWorker.isPending}
        onClose={() => setAssignTarget(null)}
        onSave={(payload) =>
          assignWorker.mutate(payload, {
            onSuccess: () => setAssignTarget(null),
            onError: () => setAssignTarget(null),
          })
        }
      />

      <OpenOrderStageDialog
        open={parentStageDialog}
        stages={parentOpenableStages}
        saving={openParentStage.isPending}
        onClose={() => setParentStageDialog(false)}
        onSave={(stage) =>
          openParentStage.mutate(stage, {
            onSuccess: () => setParentStageDialog(false),
          })
        }
      />

      <StatusDialog
        open={statusDialog}
        current={order.status}
        isBtp={isBtp}
        initialTarget={statusPreset}
        saving={status.isPending}
        onClose={() => {
          setStatusDialog(false)
          setStatusPreset(null)
        }}
        onSave={(payload) =>
          status.mutate(payload, {
            onSuccess: () => {
              setStatusDialog(false)
              setStatusPreset(null)
            },
          })
        }
      />

      <ConfirmDeleteDialog
        open={deleting}
        title="Xóa lệnh sản xuất"
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
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.25,
          gap: 1,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  )
}

function SyncStatus({
  fetching,
  updatedAt,
  onRefresh,
}: {
  fetching: boolean
  updatedAt: number
  onRefresh: () => void
}) {
  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—'

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Typography variant="caption" color={fetching ? 'primary.main' : 'text.secondary'}>
        {fetching ? 'Đang đồng bộ…' : `Cập nhật ${updatedLabel}`}
      </Typography>
      <Tooltip title="Làm mới trạng thái">
        <span>
          <IconButton size="small" aria-label="Làm mới trạng thái" disabled={fetching} onClick={onRefresh}>
            <SyncIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  )
}

/** Tóm tắt vận hành để người điều hành nhận ra ngay phiếu nào đang tắc ở bước nào. */
function ProductionTicketSummary({ tickets }: { tickets: SubTicket[] }) {
  if (tickets.length === 0) return null

  const count = (state: SubTicketState) => tickets.filter((ticket) => ticket.state === state).length
  const cards: Array<{
    label: string
    value: number
    state?: SubTicketState
    tone?: string
  }> = [
    { label: 'Tổng phiếu', value: tickets.length, tone: '#f3eee6' },
    { label: 'Chờ mở', value: count('IDLE'), state: 'IDLE' },
    { label: 'Chờ thợ', value: count('WAITING'), state: 'WAITING' },
    { label: 'Đã nhận', value: count('CLAIMED'), state: 'CLAIMED' },
    { label: 'Đang làm', value: count('WORKING'), state: 'WORKING' },
    { label: 'Chờ QC', value: count('SUBMITTED'), state: 'SUBMITTED' },
    {
      label: 'Đã chốt',
      value: count('DEFECT') + count('FINISH'),
      tone: '#e6f4ea',
    },
  ]

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(4, minmax(0, 1fr))',
        },
        gap: 0.75,
        mb: 1.5,
      }}
    >
      {cards.map((card) => (
        <Box
          key={card.label}
          sx={{
            minWidth: 0,
            p: 1,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: card.tone ?? 'background.paper',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            {card.value}
          </Typography>
          {card.state ? (
            <Box sx={{ mt: 0.5, '& .MuiChip-root': { height: 22 } }}>
              <SubTicketStateChip state={card.state} label={card.label} />
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {card.label}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
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
 *
 * Đơn đã chia từ 2 phiếu con trở lên: nhật ký của cả đơn chỉ ghi phiếu đi xa nhất, nên tô dòng
 * cuối là "hiện tại" sẽ làm phiếu chưa làm trông như đang ở khâu đó. Khi đó bảng theo phiếu
 * con đang chọn ở tab bên cạnh: phần đầu của cả đơn + quy trình riêng của phiếu đó. Chưa chọn
 * phiếu (tab "Tổng hợp cả đơn") thì không tô trạng thái nào.
 */
function StatusTimeline({
  order,
  isBtp,
  selectedTicketId,
}: {
  order: ProductionOrderDetail
  isBtp: boolean
  selectedTicketId: string | null
}) {
  // API trả log mới nhất trước — đảo lại để đọc từ trên xuống theo thời gian.
  const logs = [...order.statusLogs].reverse()
  const split = order.subTickets.length >= 2
  const ticket = split ? order.subTickets.find((item) => item.id === selectedTicketId) : undefined
  // Đơn BTP không qua 3D và Đúc; Sản xuất lỗi là nhánh ngoài luồng nên chỉ hiện khi đã xảy ra.
  const flow = STATUS_TABS.filter(
    (status) =>
      status !== 'DEFECT' &&
      status !== 'FILING_DEFECT' &&
      status !== 'STONE_DEFECT' &&
      !(isBtp && (status === 'REDO_3D' || status === 'CASTING')),
  )

  const toRow = (log: StatusLog): TicketTimelineRow => ({
    key: log.id,
    status: log.toStatus,
    label: STATUS_META[log.toStatus].label,
    at: log.changedAt,
    by: log.changedBy,
    note: log.note,
  })
  // Đơn chia phiếu: dòng của cả đơn = trước khi phiếu nào vào khâu + kết cục chung (Lỗi / Hoàn thiện…).
  const firstPhase = split ? logs.findIndex((log) => TICKET_PHASE_STATUSES.includes(log.toStatus)) : -1
  const head = firstPhase >= 0 ? logs.slice(0, firstPhase) : logs
  const tail =
    firstPhase >= 0
      ? logs
          .slice(firstPhase)
          .filter((log) => !TICKET_PHASE_STATUSES.includes(log.toStatus) && log.toStatus !== 'WAIT_FILING')
      : []

  let rows: TicketTimelineRow[]
  let currentKey: string | undefined
  if (!split) {
    rows = logs.map(toRow)
    currentKey = rows.at(-1)?.key
  } else if (ticket) {
    // Phiếu đã chọn: dòng Chờ nguội của cả đơn (kèm ghi chú đúc xong) là dòng đầu, bỏ dòng "start" lặp.
    const startLog = logs.find((log) => log.toStatus === 'WAIT_FILING')
    const own = ticketTimeline(ticket, order.stages, startLog)
    rows = [...head.map(toRow), ...(startLog ? own.slice(1) : own)]
    currentKey = own.at(-1)?.key
  } else {
    rows = [...head, ...tail].map(toRow)
    currentKey = tail.length ? tail.at(-1)?.id : firstPhase >= 0 ? undefined : head.at(-1)?.id
  }

  const passed = new Set(rows.map((row) => row.status).filter((status) => status != null))
  // Mốc các bước chưa tới: trạng thái của phiếu đang xem; đơn đang ở Sản xuất lỗi / chưa chọn phiếu
  // thì lấy bước trong luồng gần nhất đã qua.
  const reference = ticket ? ticket.status : order.status
  const anchor =
    flow.indexOf(reference) >= 0
      ? reference
      : [...rows].reverse().find((row) => row.status != null && flow.includes(row.status))?.status
  const anchorIndex = anchor ? flow.indexOf(anchor) : -1
  const pending = !split || ticket
    ? flow.filter((status, index) => index > anchorIndex && !passed.has(status))
    : flow.filter((status, index) => index > (head.length ? flow.indexOf(head.at(-1)!.toStatus) : -1) && !passed.has(status))

  return (
    <Table
      size="small"
      sx={{
        '& td, & th': {
          px: 0.75,
          py: 0.5,
          fontSize: '0.78rem',
          borderColor: '#e9e0d4',
        },
        '& th': { fontWeight: 700, color: 'text.secondary' },
      }}
    >
      <TableHead>
        {split ? (
          <TableRow>
            <TableCell colSpan={3} sx={{ fontWeight: 700 }}>
              {ticket ? `Phiếu ${ticket.code} · ${ticket.qty} sp` : 'Cả đơn'}
            </TableCell>
          </TableRow>
        ) : null}
        <TableRow>
          <TableCell>Trạng thái</TableCell>
          <TableCell>Thời gian</TableCell>
          <TableCell>Người xử lý</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const current = row.key === currentKey
          return (
            <Fragment key={row.key}>
              <TableRow
                sx={{
                  ...(current ? { bgcolor: '#f6e9d4' } : null),
                  ...(row.note ? { '& td': { borderBottom: 'none' } } : null),
                }}
              >
                <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: current ? 700 : 400 }}>
                  {row.status ? <StatusDot status={row.status} /> : <Box component="span" sx={{ mr: 1.75 }} />}
                  {row.label}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateShort(row.at)}</TableCell>
                <TableCell>{row.by ?? '—'}</TableCell>
              </TableRow>
              {row.note ? (
                <TableRow sx={current ? { bgcolor: '#f6e9d4' } : undefined}>
                  <TableCell colSpan={3} sx={{ pt: '0 !important', color: 'text.secondary', fontStyle: 'italic' }}>
                    {row.note}
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
        {split && !ticket ? (
          <TableRow>
            <TableCell colSpan={3} sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
              Đơn đã chia phiếu con — chọn một phiếu ở phần Điều hành sản xuất để xem trạng thái riêng của phiếu đó.
            </TableCell>
          </TableRow>
        ) : null}
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
        border: '1px solid #cbbda9',
        verticalAlign: 'middle',
      }}
    />
  )
}

/** Tóm tắt NVL thợ đã xin xuất + hao hụt của cả đơn / phiếu. */
function materialsSummary(materials: ProductionOrderDetail['materials']) {
  const parts: string[] = []
  if (Number(materials.issuedMetalWeight)) parts.push(`${formatQty(materials.issuedMetalWeight)} g bạc`)
  if (materials.issuedStoneCount) parts.push(`${materials.issuedStoneCount} viên đá`)
  if (materials.silverLoss != null) {
    parts.push(
      `hao hụt ${formatQty(materials.silverLoss)} g${materials.silverLossPercent != null ? ` (${materials.silverLossPercent}%)` : ''}`,
    )
  }
  if (materials.stoneLoss) parts.push(`mất ${materials.stoneLoss} viên đá`)
  return parts.length ? parts.join(' · ') : 'Chưa xuất thêm'
}

/** Ảnh chụp vận hành của đơn: người điều hành nhìn từ trên xuống là biết việc tiếp theo. */
function OverviewSummary({
  order,
  onOpenProduction,
}: {
  order: ProductionOrderDetail
  onOpenProduction: () => void
}) {
  const tickets = order.subTickets.length
    ? order.subTickets.map((ticket) => ({
        state: ticket.state,
        activeStage: ticket.activeStage,
        pendingStage: ticket.pendingStage,
        availableQty: ticket.outcome ? 0 : ticket.availableQty,
      }))
    : order.workTicket
      ? [
          {
            state: order.workTicket.state,
            activeStage: order.workTicket.activeStage,
            pendingStage: order.workTicket.pendingStage,
            availableQty: order.finishedGoods ? 0 : order.workTicket.availableQty,
          },
        ]
      : []
  const count = (state: SubTicketState) => tickets.filter((ticket) => ticket.state === state).length
  const stages = Array.from(
    new Set(
      tickets
        .map((ticket) => ticket.activeStage ?? ticket.pendingStage)
        .filter((stage): stage is StageCode => stage != null),
    ),
  )
  const availableQty = tickets.reduce((sum, ticket) => sum + ticket.availableQty, 0)
  const deadline = deadlineWarning(order.dueDate, order.status)
  const waitingForStock = (order.finishedGoods?.pendingQty ?? 0) > 0

  let actionTitle = 'Theo dõi tiến độ đơn'
  let actionDetail = 'Mở phần Sản xuất để xem lịch sử và điều hành từng phiếu.'
  if (waitingForStock) {
    actionTitle = `${order.finishedGoods!.pendingQty} ${order.qtyUnit ?? 'sản phẩm'} đang chờ vào tồn`
    actionDetail = 'Kho thành phẩm cần xác nhận phiếu nhập trước khi số lượng được tính vào tồn.'
  } else if (order.materials.pendingCount > 0) {
    actionTitle = `${order.materials.pendingCount} yêu cầu xuất NVL đang chờ`
    actionDetail = 'Thợ xin thêm bạc / đá cho khâu đang làm — kho cân và xuất, hoặc từ chối kèm lý do.'
  } else if (count('SUBMITTED') > 0) {
    actionTitle = `${count('SUBMITTED')} phiếu chờ QC nhận lại`
    actionDetail = 'Cân lại số lượng và bạc, sau đó xác nhận nhận lại cho thợ.'
  } else if (count('CLAIMED') > 0) {
    actionTitle = `${count('CLAIMED')} phiếu đã có thợ nhận`
    actionDetail = 'Cân hàng và xác nhận giao để thợ bắt đầu làm.'
  } else if (count('IDLE') > 0 && !order.finishedGoods) {
    actionTitle = `${count('IDLE')} phiếu chờ mở khâu tiếp theo`
    actionDetail = 'Kiểm tra khâu vừa xong rồi mở khâu tiếp theo hoặc chốt kết cục phiếu.'
  } else if (count('WAITING') > 0) {
    actionTitle = `${count('WAITING')} phiếu đang chờ thợ nhận`
    actionDetail = 'Phiếu đã mở khâu; theo dõi để giao hàng ngay khi thợ nhận.'
  } else if (count('WORKING') > 0) {
    actionTitle = `${count('WORKING')} phiếu đang được thợ thực hiện`
    actionDetail = 'Chờ thợ báo xong, sau đó QC cân và nhận lại.'
  } else if (order.status === 'NEW' || order.status === 'REDO_3D') {
    actionTitle = order.status === 'NEW' ? 'Cần báo Đúc' : 'Đang chờ sửa 3D'
    actionDetail = 'Hoàn tất bước chuẩn bị để có thể in phiếu và mở khâu cho thợ.'
  } else if (order.finishedGoods) {
    actionTitle = 'Sản xuất đã hoàn thiện'
    actionDetail = 'Theo dõi nhập tồn và xuất hàng tại phần Kho thành phẩm.'
  }

  const progress = (
    [
      ['Chờ mở', count('IDLE')],
      ['Chờ thợ', count('WAITING')],
      ['Đã nhận', count('CLAIMED')],
      ['Đang làm', count('WORKING')],
      ['Chờ QC', count('SUBMITTED')],
      ['Hoàn thiện', count('FINISH')],
      ['Lỗi', count('DEFECT')],
    ] satisfies Array<[string, number]>
  ).filter(([, value]) => value > 0)

  return (
    <Stack spacing={1.25}>
      <Box
        sx={{
          p: 1.5,
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: 'primary.light',
          bgcolor: '#fbf4e8',
        }}
      >
        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
          Việc cần làm
        </Typography>
        <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 700 }}>
          {actionTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {actionDetail}
        </Typography>
        {waitingForStock ? (
          <Button
            size="small"
            variant="contained"
            component={RouterLink}
            to="/warehouses/thanh-pham/inbound"
            sx={{ mt: 1.25 }}
          >
            Mở phiếu nhập thành phẩm
          </Button>
        ) : (
          <Button size="small" variant="contained" onClick={onOpenProduction} sx={{ mt: 1.25 }}>
            Mở điều hành sản xuất
          </Button>
        )}
      </Box>

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          px: 1.5,
        }}
      >
        <VerticalInfoList
          items={[
            {
              label: 'Đang ở đâu',
              value: stages.length ? stages.map((stage) => STAGE_LABEL[stage]).join(', ') : STATUS_META[order.status].label,
            },
            {
              label: tickets.length ? 'Đang có trên phiếu' : 'Tổng đơn',
              value: tickets.length
                ? `${availableQty} ${order.qtyUnit ?? 'sản phẩm'}`
                : `${order.qty} ${order.qtyUnit ?? 'sản phẩm'}`,
            },
            {
              label: 'NVL xuất thêm',
              value: materialsSummary(order.materials),
            },
            {
              label: 'Tiến độ phiếu',
              value: progress.length ? (
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {progress.map(([label, value]) => (
                    <Chip key={label} size="small" variant="outlined" label={`${label}: ${value}`} />
                  ))}
                </Stack>
              ) : (
                'Chưa mở phiếu sản xuất'
              ),
            },
            {
              label: 'Hạn trả',
              value: (
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{order.dueDate ? formatStockedDate(order.dueDate) : '—'}</span>
                  {deadline ? (
                    <Chip
                      size="small"
                      color={deadline.tone === 'overdue' ? 'error' : 'warning'}
                      label={deadline.label}
                    />
                  ) : null}
                </Stack>
              ),
            },
          ]}
        />
      </Box>
    </Stack>
  )
}

function InfoGrid({ order }: { order: ProductionOrderDetail }) {
  const orderFields: Array<[string, ReactNode]> = [
    ['Ngày đặt đơn', formatStockedDate(order.receivedDate)],
    ['Ngày cần trả', order.dueDate ? formatStockedDate(order.dueDate) : null],
    ['Số lượng', `${order.qty}${order.qtyUnit ? ` ${order.qtyUnit}` : ''} · đã trả ${order.returnedQty}`],
    ['Người chốt', order.closedBy],
    ['Khách hàng', order.customerName],
    ['Người được hỏi', order.askedUserName],
    ['Mã sản phẩm', order.trackingCode],
    ['Công nợ', order.debtStatus],
  ]

  const productFields: Array<[string, ReactNode]> = [
    ['Tên sản phẩm', order.productName ?? order.btp?.name],
    ['Size', order.sizeLabel],
    ['Kích thước', order.size],
    ['Chất liệu', order.mainMaterial],
    ['Màu sắc (xi)', order.platingColor],
    ['Loại đá', order.stoneTypes.length ? order.stoneTypes.join(', ') : null],
    ['Màu đá', order.stoneColor],
    ['Số lượng đá (viên)', order.stoneCount],
    ['Trọng lượng (g)', order.weight != null ? formatQty(order.weight) : null],
    ['Nội dung khắc laser', order.laserEngraving],
    ['Yêu cầu khác', order.otherRequirements],
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
      <Box
        sx={{
          px: 1.5,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          bgcolor: '#f8fafb',
        }}
      >
        <VerticalInfoList items={[{ label: 'Mô tả / Yêu cầu sản phẩm', value: order.description }]} />
      </Box>

      <FieldGroup title="Đơn hàng" fields={orderFields} />

      <FieldGroup title="Sản phẩm" fields={productFields} />

      {hasSplit ? <FieldGroup title="Phân đơn" fields={splitFields} /> : null}
    </Stack>
  )
}

/** Một nhóm trường theo chiều dọc để đọc lần lượt, không phải quét ngang qua nhiều cột. */
function FieldGroup({
  title,
  fields,
}: {
  title: string
  fields: Array<[string, ReactNode]>
}) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          px: 1.5,
          py: 1,
          fontWeight: 700,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          bgcolor: '#f8f3eb',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {title}
      </Typography>
      <Box sx={{ px: 1.5 }}>
        <VerticalInfoList items={fields.map(([label, value]) => ({ label, value }))} />
      </Box>
    </Box>
  )
}

/** Ảnh nhỏ của đơn; bấm vào xem ảnh lớn ngay trên trang, không mở tab mới. */
function Gallery({ label, images }: { label: string; images: ProductionOrderDetail['images'] }) {
  const [viewing, setViewing] = useState<number | null>(null)
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
          {images.map((image, index) => (
            <ZoomThumb
              key={image.id}
              url={image.url}
              label={`Xem ảnh lớn ${index + 1}/${images.length}`}
              onClick={() => setViewing(index)}
            />
          ))}
        </Stack>
      )}
      <ImageLightbox
        images={images}
        index={viewing}
        title={label}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
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
            bạc) → QC {entry.returnedByName ?? '—'} nhận lại {formatDateShort(entry.returnedAt)} (
            {entry.returnedSilverWeight ? formatQty(entry.returnedSilverWeight) : '—'} g bạc), hao hụt{' '}
            {entry.silverLoss != null ? `${formatQty(entry.silverLoss)} g` : '—'}
          </Typography>
        ))}
      </Stack>
    </Box>
  )
}

/** Chốt Hoàn thiện tạo phiếu chờ; kho xác nhận rồi số lượng mới được cộng vào tồn. */
function FinishedGoodsCard({ order }: { order: ProductionOrderDetail }) {
  const goods = order.finishedGoods
  return (
    <Section title="Kho thành phẩm & xuất hàng">
      {!goods ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có phiếu hoàn thiện.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Field
              label={goods.pendingQty > 0 ? 'Tạo phiếu chờ nhập' : 'Nhập kho'}
              value={`${formatDateTime(goods.receivedAt)} · ${goods.receivedByName}`}
            />
            <Field label="Đã hoàn thiện" value={goods.completedQty} />
            <Field label="Chờ vào tồn" value={goods.pendingQty} />
            <Field label="Đã vào tồn" value={goods.qty} />
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

function OpenOrderStageDialog({
  open,
  stages,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  stages: StageCode[]
  saving: boolean
  onClose: () => void
  onSave: (stage: StageCode) => void
}) {
  const form = useForm<{ stage: StageCode | '' }>({
    defaultValues: { stage: '' },
  })
  const stage = useWatch({ control: form.control, name: 'stage' })

  useEffect(() => {
    if (!open) return
    const current = form.getValues('stage')
    form.reset({
      stage: current && stages.includes(current) ? current : (stages[0] ?? ''),
    })
  }, [open, stages, form])

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Mở khâu trên phiếu mẹ</DialogTitle>
      <DialogForm form={form} onSubmit={(values) => values.stage && onSave(values.stage)}>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            pt: '8px !important',
          }}
        >
          <FormSelect<{ stage: StageCode | '' }, StageCode>
            name="stage"
            label="Khâu"
            options={stages.map((item) => ({
              value: item,
              label: STAGE_LABEL[item],
            }))}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={!stage} loading={saving}>
            Mở khâu
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}

type StatusValues = { target: ProductionStatus | ''; note: string }

function StatusDialog({
  open,
  current,
  isBtp,
  initialTarget,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  current: ProductionStatus
  isBtp: boolean
  initialTarget?: ProductionStatus | null
  saving: boolean
  onClose: () => void
  onSave: (payload: { status: ProductionStatus; note?: string }) => void
}) {
  const form = useForm<StatusValues>({
    defaultValues: { target: '', note: '' },
  })
  const [target, note] = useWatch({
    control: form.control,
    name: ['target', 'note'],
  })

  useEffect(() => {
    if (open && initialTarget) form.setValue('target', initialTarget)
  }, [open, initialTarget, form])

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
          onExited: () => form.reset({ target: '', note: '' }),
        },
      }}
    >
      <DialogTitle>Đổi trạng thái đơn</DialogTitle>
      <DialogForm
        form={form}
        onSubmit={(values) =>
          values.target &&
          onSave({
            status: values.target,
            note: values.note.trim() || undefined,
          })
        }
      >
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            pt: '8px !important',
          }}
        >
          <FormSelect<StatusValues, ProductionStatus> name="target" label="Trạng thái mới" options={options} required />
          <FormTextField<StatusValues>
            name="note"
            label={noteRequired ? 'Mô tả lỗi' : 'Ghi chú'}
            required={noteRequired}
            rules={{ validate: (value, values) => (values.target !== 'DEFECT' || value.trim() ? true : 'Nhập mô tả lỗi') }}
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!target || (noteRequired && !note.trim())}
            loading={saving}
            loadingPosition="start"
          >
            Lưu
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
