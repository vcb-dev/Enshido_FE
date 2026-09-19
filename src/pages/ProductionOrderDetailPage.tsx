import { useState, type ReactNode } from 'react'
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
  Link,
  Paper,
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
import EditIcon from '@mui/icons-material/Edit'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import {
  changeProductionStatusApi,
  deleteProductionOrderApi,
  getProductionOrderApi,
  getProductionOrderLookupsApi,
  returnStageApi,
  startStageApi,
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
  type UpsertProductionOrderPayload,
} from '../api/productionOrders'
import { formatQty, formatStockedDate } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import { PageHeader, SelectInput, TextInput } from '../components/ui'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'
import { OrderCostingCard } from '../orders/OrderCostingCard'
import {
  formatDateShort,
  formatDateTime,
  isInStage,
  MANUAL_STATUSES,
  orderTicketUrl,
  STAGE_LABEL,
  STAGES,
  STATUS_META,
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
import { latestByStage, TICKET_HEADER_BG, TICKET_ROWS, TICKET_TONE_BG } from '../orders/ticketRows'

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
  const [deleting, setDeleting] = useState(false)

  const detail = useQuery({
    queryKey: ['production-order', code],
    queryFn: () => getProductionOrderApi(code),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
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
  const saveHandover = useOrderMutation(
    code,
    (payload: HandoverPayload & { stage?: StageCode }) => {
      if (handover?.mode === 'edit') return updateHandoverApi(code, handover.entry.id, payload)
      if (!payload.stage) throw new Error('Chọn khâu')
      return startStageApi(code, { ...payload, stage: payload.stage })
    },
    'Đã lưu thông tin giao',
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
  const last = stages[stages.length - 1]
  const openEntry = stages.find((entry) => !entry.returnedAt)
  // Đơn không nằm ở khâu nào (Mới / Sửa 3D / Đúc / Sản xuất lỗi) thì được giao lại bất kỳ khâu.
  const reworking = !isInStage(order.status)
  const startableStages =
    !last || reworking ? STAGES : STAGES.filter((stage) => STAGES.indexOf(stage) > STAGES.indexOf(last.stage))
  // Đơn BTP lấy hàng đúc sẵn: không qua Đúc, giao khâu và in phiếu ngay.
  const isBtp = order.source === 'BTP'
  const castingReady = isBtp || Boolean(order.castingSentDate && order.castingReturnedDate)
  const canStart = order.status !== 'DELIVERED' && castingReady && !openEntry && startableStages.length > 0
  const startBlockedReason =
    order.status === 'DELIVERED'
      ? 'Đơn đã giao'
      : !castingReady
        ? 'Ghi ngày báo Đúc và ngày Đúc về trước khi giao thợ'
        : openEntry
          ? `Khâu ${STAGE_LABEL[openEntry.stage]} chưa được KCS nhận lại`
          : 'Đã qua khâu cuối'
  const canPrint = isBtp || Boolean(order.castingSentDate)
  const canDelete =
    isAdmin &&
    stages.length === 0 &&
    !order.lastPrintedAt &&
    (order.status === 'NEW' || (isBtp && order.status === 'FILING'))
  const ticketStale = order.lastPrintedAt != null && order.dataChangedAt > order.lastPrintedAt

  function openStart(stage?: StageCode) {
    const ordered = stage ? [stage, ...startableStages.filter((item) => item !== stage)] : startableStages
    setHandover({
      mode: 'start',
      stages: ordered,
      defaults: { total: last?.returnedTotalWeight ?? null, silver: last?.returnedSilverWeight ?? null },
    })
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
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<EditIcon fontSize="small" />} onClick={() => setEditing(true)}>
              Sửa đơn
            </Button>
            <Button
              variant="outlined"
              onClick={() => setStatusDialog(true)}
              disabled={order.status === 'DELIVERED' || (order.finishedGoods?.shippedQty ?? 0) > 0}
            >
              Đổi trạng thái
            </Button>
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
            {canDelete ? (
              <Button color="error" onClick={() => setDeleting(true)}>
                Xóa đơn
              </Button>
            ) : null}
          </Stack>
        }
      />

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
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 300px' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Section title="Thông tin đơn">
            <InfoGrid order={order} />
          </Section>

          <Section title="Ảnh">
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <Gallery label="Ảnh chi tiết đơn hàng" images={order.images.filter((image) => image.kind === 'DETAIL')} />
              <Gallery label="Ảnh sản phẩm" images={order.images.filter((image) => image.kind === 'PRODUCT')} />
            </Box>
          </Section>
        </Stack>

        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
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
        </Stack>
      </Box>

      <Section
        title="Quá trình sản xuất (theo phiếu thợ)"
        action={
          <Tooltip title={canStart ? '' : startBlockedReason}>
            <span>
              <Button variant="contained" onClick={() => openStart()} disabled={!canStart}>
                Giao khâu cho thợ
              </Button>
            </span>
          </Tooltip>
        }
      >
        {openEntry ? (
          <Alert severity="info" sx={{ mb: 1 }}>
            Thợ {openEntry.craftsmanName} đang làm khâu {STAGE_LABEL[openEntry.stage]} — KCS cân lại bạc khi thợ nộp lại
            rồi mới giao khâu sau.
          </Alert>
        ) : null}
        <ProcessMatrix
          stages={stages}
          lastId={last?.id}
          isAdmin={isAdmin}
          // Đã có phiếu xuất hàng thì không gỡ nhận lại được (đơn đã ra khỏi sản xuất).
          locked={order.status === 'DELIVERED' || (order.finishedGoods?.shippedQty ?? 0) > 0}
          startable={canStart ? startableStages : []}
          busy={undoReturn.isPending}
          onStart={openStart}
          onEdit={openEditHandover}
          onReturn={setReturning}
          onUndoReturn={(entry) => undoReturn.mutate(entry)}
        />
        <ReworkHistory stages={stages} />
      </Section>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
          alignItems: 'start',
        }}
      >
        <OrderCostingCard code={order.code} editable={order.status !== 'DELIVERED'} />
        <FinishedGoodsCard order={order} />
      </Box>

      <Section title="Lịch sử trạng thái">
        <Stack spacing={1}>
          {order.statusLogs.map((log) => (
            <Box key={log.id}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                {log.fromStatus && log.fromStatus !== log.toStatus ? (
                  <>
                    <Typography variant="body2">{STATUS_META[log.fromStatus].label}</Typography>
                    <Typography variant="body2">→</Typography>
                  </>
                ) : null}
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {STATUS_META[log.toStatus].label}
                </Typography>
                {log.note ? (
                  <Typography variant="body2" color="text.secondary">
                    · {log.note}
                  </Typography>
                ) : null}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {log.changedBy ?? '—'} · {formatDateTime(log.changedAt)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Section>

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
        onSave={(payload) => saveHandover.mutate(payload, { onSuccess: () => setHandoverOpen(false) })}
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

/** Mọi thao tác trả về chi tiết đơn mới — ghi thẳng vào cache rồi làm mới danh sách. */
function useOrderMutation<V>(
  code: string,
  fn: (vars: V) => Promise<ProductionOrderDetail>,
  success: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      queryClient.setQueryData(['production-order', code], order)
      // Tiền công, bạc thu hồi thay đổi theo từng lần nhận lại khâu.
      void queryClient.invalidateQueries({ queryKey: ['production-order-costing', code] })
      toast.success(success)
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })
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

function InfoGrid({ order }: { order: ProductionOrderDetail }) {
  const rows: Array<[string, ReactNode]> = [
    ['Ngày đặt đơn', formatStockedDate(order.receivedDate)],
    ['Ngày cần trả', order.dueDate ? formatStockedDate(order.dueDate) : null],
    ['Thời gian cần', order.leadTime],
    ['Phân đơn', `${order.split.no}/${order.split.total}`],
    ['Người chốt', order.closedBy],
    ['Người được hỏi', order.askedUserName],
    ['Mã theo dõi đơn', order.trackingCode],
    ['Số lượng', `${order.qty}${order.qtyUnit ? ` ${order.qtyUnit}` : ''} · đã trả ${order.returnedQty}`],
    ['Size', order.sizeLabel],
    ['Kích thước', order.size],
    ['Chất liệu', order.mainMaterial],
    ['Màu sắc (xi)', order.platingColor],
    ['Loại đá', order.stoneTypes.length ? order.stoneTypes.join(', ') : null],
    ['Màu đá', order.stoneColor],
    ['Số lượng đá (viên)', order.stoneCount],
    ['Trọng lượng đá (g)', order.stoneWeight != null ? formatQty(order.stoneWeight) : null],
    ['Mã 3D', order.model3dCode],
    [
      'Link 3D',
      order.model3dUrl ? (
        <Link href={order.model3dUrl} target="_blank" rel="noreferrer" sx={{ overflowWrap: 'anywhere' }}>
          {order.model3dUrl}
        </Link>
      ) : null,
    ],
    ['Công nợ', order.debtStatus],
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

  return (
    <Stack spacing={1.5}>
      <Field label="Mô tả / Yêu cầu sản phẩm" value={order.description} />
      <Box
        sx={{
          display: 'grid',
          columnGap: 2,
          rowGap: 1,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        {rows.map(([label, value]) => (
          <Field key={label} label={label} value={value} />
        ))}
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <Field label="Nội dung khắc laser" value={order.laserEngraving} />
        <Field label="Yêu cầu khác" value={order.otherRequirements} />
      </Box>
    </Stack>
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

const CELL_BORDER = '1px solid #b7c2cc'

/** Bảng "Quá trình sản xuất" giống hệt phiếu in, thêm hàng nút thao tác cho từng khâu. */
function ProcessMatrix({
  stages,
  lastId,
  isAdmin,
  locked,
  startable,
  busy,
  onStart,
  onEdit,
  onReturn,
  onUndoReturn,
}: {
  stages: StageEntry[]
  lastId: string | undefined
  isAdmin: boolean
  locked: boolean
  startable: StageCode[]
  busy: boolean
  onStart: (stage: StageCode) => void
  onEdit: (entry: StageEntry) => void
  onReturn: (entry: StageEntry) => void
  onUndoReturn: (entry: StageEntry) => void
}) {
  const latest = latestByStage(stages)

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table
        size="small"
        sx={{
          minWidth: 900,
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          '& td, & th': { border: CELL_BORDER, px: 1, py: 0.6, fontSize: '0.84rem' },
        }}
      >
        <TableHead>
          <TableRow sx={{ '& th': { bgcolor: TICKET_HEADER_BG, fontWeight: 700, textAlign: 'center' } }}>
            <TableCell colSpan={2} sx={{ width: 220, color: '#1b4f9c' }}>
              Quá trình sản xuất
            </TableCell>
            {STAGES.map((stage) => (
              <TableCell key={stage}>
                {STAGE_LABEL[stage]}
                {latest[stage] && latest[stage].attempt > 1 ? ` (lần ${latest[stage].attempt})` : ''}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {TICKET_ROWS.map((row) => (
            <TableRow key={row.key} sx={row.tone ? { bgcolor: TICKET_TONE_BG[row.tone] } : undefined}>
              {row.label != null ? (
                <TableCell
                  colSpan={row.sub ? 1 : 2}
                  rowSpan={row.labelRowSpan}
                  sx={{ fontWeight: row.tone ? 700 : 400, verticalAlign: 'top' }}
                >
                  {row.label}
                  {row.hint ? (
                    <Typography component="span" variant="caption" sx={{ fontStyle: 'italic', display: 'block' }}>
                      {row.hint}
                    </Typography>
                  ) : null}
                </TableCell>
              ) : null}
              {row.sub ? (
                <TableCell sx={{ width: 52, color: 'text.secondary', fontSize: '0.78rem !important' }}>{row.sub}</TableCell>
              ) : null}
              {STAGES.map((stage) => {
                const entry = latest[stage]
                return (
                  <TableCell key={stage} sx={{ textAlign: row.numeric ? 'right' : 'left' }}>
                    {entry ? row.value(entry) : ''}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
          <TableRow sx={{ '& td': { bgcolor: '#f4f6f7', textAlign: 'center' } }}>
            <TableCell colSpan={2} sx={{ textAlign: 'left !important', color: 'text.secondary' }}>
              Thao tác
            </TableCell>
            {STAGES.map((stage) => {
              const entry = latest[stage]
              return (
                <TableCell key={stage}>
                  <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                    {startable.includes(stage) && (!entry || entry.returnedAt) ? (
                      <Button size="small" variant="outlined" onClick={() => onStart(stage)}>
                        Giao thợ
                      </Button>
                    ) : null}
                    {entry && !entry.returnedAt ? (
                      <>
                        <Button size="small" variant="contained" onClick={() => onReturn(entry)}>
                          KCS nhận lại
                        </Button>
                        <Button size="small" onClick={() => onEdit(entry)}>
                          Sửa giao
                        </Button>
                      </>
                    ) : null}
                    {entry?.returnedAt && isAdmin && entry.id === lastId && !locked ? (
                      <Button size="small" color="inherit" disabled={busy} onClick={() => onUndoReturn(entry)}>
                        Gỡ nhận lại
                      </Button>
                    ) : null}
                  </Stack>
                </TableCell>
              )
            })}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/** Các lần làm trước của khâu đã làm lại — phiếu chỉ in lần gần nhất nên liệt kê riêng. */
function ReworkHistory({ stages }: { stages: StageEntry[] }) {
  const latest = latestByStage(stages)
  const older = stages.filter((entry) => latest[entry.stage]?.id !== entry.id)
  if (older.length === 0) return null

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Các lần làm trước (đã làm lại)
      </Typography>
      <Stack spacing={0.5}>
        {older.map((entry) => (
          <Typography key={entry.id} variant="body2" color="text.secondary">
            {STAGE_LABEL[entry.stage]} lần {entry.attempt}: thợ {entry.craftsmanName}, giao{' '}
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

/** Đơn trong kho thành phẩm: tự vào kho khi KCS nhận lại Ngoại Quan, xuất từng phần qua phiếu xuất hàng. */
function FinishedGoodsCard({ order }: { order: ProductionOrderDetail }) {
  const goods = order.finishedGoods
  return (
    <Section title="Kho thành phẩm & xuất hàng">
      {!goods ? (
        <Typography variant="body2" color="text.secondary">
          Chưa vào kho thành phẩm — đơn tự vào kho khi KCS nhận lại khâu Ngoại Quan.
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
          Đúc đổi qua nút “Báo Đúc”; Nguội → Hoàn thiện đổi khi giao khâu cho thợ; Đã giao tự đổi khi lập phiếu
          xuất hàng đủ số lượng. Đơn trong kho thành phẩm (chưa xuất) chuyển Sản xuất lỗi thì rút khỏi kho.
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
