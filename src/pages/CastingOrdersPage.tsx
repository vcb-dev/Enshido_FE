import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  confirmCastingSlipApi,
  rejectCastingSlipApi,
  createCastingSlipApi,
  issueCastingSlipApi,
  getCastingSlipByCodeApi,
  listCastingSlipsApi,
  type CastingSlip,
  type CastingSlipImage,
  type CreateCastingSlipPayload,
  type CastingSlipStatus,
  type ConfirmCastingSlipPayload,
} from '../api/castingSlips'
import { useAuth } from '../auth/AuthContext'
import { formatQty } from '../api/inventory'
import {
  ColumnHeaderDate,
  ColumnHeaderFilter,
  ColumnHeaderSearch,
  DataTable,
  PageHeader,
  type Column,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { useTableParams } from '../hooks/useTableParams'
import { formatDateTime } from '../orders/catalog'
import { CastingSlipCreateDialog } from '../intake/CastingSlipCreateDialog'
import { CastingSlipConfirmDialog } from '../intake/CastingSlipConfirmDialog'
import { CastingSlipIssueDialog } from '../intake/CastingSlipIssueDialog'
import { IntakeImageThumbs } from '../intake/IntakeImageThumbs'
import { canConfirmIntakeWarehouse } from '../intake/intakeWarehouseAccess'
import {
  applyCastingSlipCreated,
  applyCastingSlipRejected,
  applyCastingSlipUpdate,
} from '../casting/castingSlipsCache'
import { scheduleMyTicketsRefresh } from '../orders/myTicketsRefresh'
import { invalidateBtpStock } from '../orders/btpStock'
import { invalidateNvlWarehouse } from '../orders/nvlStock'
import { LIVE_REFRESH_MS, liveRefresh } from '../hooks/liveRefresh'

const cellLeft = { textAlign: 'left', paddingLeft: '10px' } as const

const SLIP_STATUS_META: Record<CastingSlipStatus, { label: string; bg: string }> = {
  PENDING_ISSUE: { label: 'Chờ cấp vật tư', bg: '#8d6e63' },
  WAIT_CASTING: { label: 'Chờ đúc', bg: '#283593' },
  CASTING: { label: 'Đang đúc', bg: '#c62828' },
  PENDING_CONFIRMATION: { label: 'Chờ thủ kho xác nhận', bg: '#e65100' },
  DONE: { label: 'Đúc xong', bg: '#00695c' },
  CAST_FAILED: { label: 'Lỗi đúc', bg: '#636e72' },
}
const SLIP_STATUS_OPTIONS = (Object.keys(SLIP_STATUS_META) as CastingSlipStatus[]).map((id) => ({
  id,
  name: SLIP_STATUS_META[id].label,
}))

function SlipStatusChip({ status }: { status: CastingSlipStatus }) {
  const meta = SLIP_STATUS_META[status]
  return <Chip size="small" label={meta.label} sx={{ bgcolor: meta.bg, color: '#fff', fontWeight: 600 }} />
}

const SLIP_FILTERS = {
  status: '',
  slipDate: '',
  batchOrderCodes: '',
  waxWeight: '',
  issueTotal: '',
}

function formatGram(value: string | null) {
  if (value == null || value === '') return '—'
  return formatQty(value)
}

export function CastingOrdersPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const dialog = useCrudDialog<CastingSlip>()
  const navigate = useNavigate()
  const { code: scannedCode } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const [issueTarget, setIssueTarget] = useState<CastingSlip | null>(null)
  /** Phiếu đang mở hộp "Xác nhận và chia phôi" (cân phôi từng đơn + phần cây còn lại). */
  const [confirmTarget, setConfirmTarget] = useState<CastingSlip | null>(null)
  // `?new=<id>`: mở từ nút "Lên lệnh đúc" trên một dòng Lệnh sản xuất.
  const preselectId = searchParams.get('new')
  /** `?issue=<mã phiếu>`: từ Lệnh sản xuất — sang Lệnh đúc và mở form cấp vật tư. */
  const issueCodeParam = searchParams.get('issue')

  useEffect(() => {
    if (preselectId) setCreateOpen(true)
  }, [preselectId])

  const issueFromOrders = useQuery({
    queryKey: ['casting-slip', 'issue-param', issueCodeParam],
    queryFn: () => getCastingSlipByCodeApi(issueCodeParam!),
    enabled: Boolean(issueCodeParam),
    staleTime: 0,
  })
  useEffect(() => {
    if (!issueCodeParam || !issueFromOrders.data) return
    setIssueTarget(issueFromOrders.data)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('issue')
        return next
      },
      { replace: true },
    )
  }, [issueCodeParam, issueFromOrders.data, setSearchParams])
  useEffect(() => {
    if (issueFromOrders.error instanceof Error) toast.error(issueFromOrders.error.message)
  }, [issueFromOrders.error])

  // `/casting/:code`: thợ đúc quét QR trên phiếu giấy → mở ngay phiếu đó (bước 8).
  const scanned = useQuery({
    queryKey: ['casting-slip', scannedCode],
    queryFn: () => getCastingSlipByCodeApi(scannedCode!),
    enabled: Boolean(scannedCode),
    staleTime: 0,
  })
  useEffect(() => {
    if (!scanned.data) return
    if (scanned.data.status === 'PENDING_ISSUE' && canConfirmIntakeWarehouse(user)) {
      setIssueTarget(scanned.data)
      navigate('/casting', { replace: true })
      return
    }
    dialog.openView(scanned.data)
  }, [scanned.data, dialog.openView, navigate, user])
  useEffect(() => {
    if (scanned.error instanceof Error) toast.error(scanned.error.message)
  }, [scanned.error])
  const table = useTableParams({ pageSize: 25, filters: SLIP_FILTERS })
  const { params } = table

  const list = useQuery({
    queryKey: [
      'casting-slips',
      params.status,
      params.page,
      params.pageSize,
      params.slipDate,
      params.batchOrderCodes,
      params.waxWeight,
      params.issueTotal,
    ],
    queryFn: () =>
      listCastingSlipsApi({
        status: params.status as CastingSlipStatus | '',
        slipDate: params.slipDate,
        batchOrderCodes: params.batchOrderCodes,
        waxWeight: params.waxWeight,
        issueTotal: params.issueTotal,
        page: params.page,
        pageSize: params.pageSize,
      }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    // Thợ đúc nhận / báo xong và thủ kho xác nhận trên máy khác — danh sách phải tự cập nhật.
    ...liveRefresh(LIVE_REFRESH_MS.list),
  })

  // Đổi trạng thái phiếu kéo theo trạng thái đơn tạo (G, H) nên làm mới cả hai danh sách.
  function afterSlipUpdated(updated: CastingSlip, message: string) {
    toast.success(message)
    applyCastingSlipUpdate(queryClient, updated)
    scheduleMyTicketsRefresh(queryClient)
    if (dialog.open && dialog.kind === 'view' && dialog.row?.id === updated.id) {
      dialog.openView(updated)
    }
  }
  const create = useMutation({
    mutationFn: (payload: CreateCastingSlipPayload) => createCastingSlipApi(payload),
    onSuccess: (slip) => {
      toast.success(
        `Đã lên phiếu đúc ${slip.code} (${slip.orders.length} đơn) — chờ cấp vật tư, chụp ảnh rồi xác nhận cấp`,
      )
      closeCreate()
      applyCastingSlipCreated(queryClient, slip)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  function closeCreate() {
    setCreateOpen(false)
    if (preselectId) {
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }
  function closeView() {
    dialog.close()
    if (scannedCode) navigate('/casting', { replace: true })
  }

  const issue = useMutation({
    mutationFn: (vars: { slip: CastingSlip; images: CastingSlipImage[] }) =>
      issueCastingSlipApi(vars.slip.id, vars.images),
    onSuccess: (updated) => {
      setIssueTarget(null)
      toast.success(`Phiếu ${updated.code}: đã cấp vật tư — ${updated.orders.length} đơn sang Chờ đúc`)
      applyCastingSlipUpdate(queryClient, updated)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  // Xác nhận đúc kiêm cắt cây: chia phôi từng đơn, sinh lệnh SX (Chờ nguội), phôi vào kho BTP,
  // phần cây còn lại vào kho NVL.
  const confirm = useMutation({
    mutationFn: ({ slip, payload }: { slip: CastingSlip; payload: ConfirmCastingSlipPayload }) =>
      confirmCastingSlipApi(slip.id, payload),
    onSuccess: (updated) => {
      setConfirmTarget(null)
      afterSlipUpdated(updated, `Phiếu ${updated.code}: đã tạo ${updated.orders.length} lệnh sản xuất, chuyển Nguội`)
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['production-order-lookups'] })
      invalidateBtpStock(queryClient)
      invalidateNvlWarehouse(queryClient)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const rejectCast = useMutation({
    mutationFn: (slip: CastingSlip) => rejectCastingSlipApi(slip.id),
    onSuccess: (redo, failedSlip) => {
      toast.success(
        `Đã báo lỗi đúc — phiếu làm lại ${redo.code} (Chờ đúc). Thợ nhận phiếu và nhập kết quả mới.`,
      )
      applyCastingSlipRejected(
        queryClient,
        { ...failedSlip, status: 'CAST_FAILED' },
        redo,
      )
      scheduleMyTicketsRefresh(queryClient)
      closeView()
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const confirmingId = confirm.isPending ? confirm.variables?.slip.id : null
  const rejectingId = rejectCast.isPending ? rejectCast.variables?.id : null

  const askRejectCast = useCallback(
    (slip: CastingSlip) => {
      const orders = slip.orders.map((line) => line.code).join(', ')
      if (
        !window.confirm(
          `Báo lỗi đúc phiếu ${slip.code} (${orders})?\n\nHệ thống tạo phiếu mới cùng số liệu, đơn về Chờ đúc (F) để thợ làm lại.`,
        )
      ) {
        return
      }
      rejectCast.mutate(slip)
    },
    [rejectCast.mutate],
  )
  const canConfirm = canConfirmIntakeWarehouse(user)

  const renderSlipActions = useCallback(
    (row: CastingSlip) => (
      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button size="small" variant="outlined" onClick={() => dialog.openView(row)}>
          Xem chi tiết
        </Button>
        {row.status === 'PENDING_ISSUE' && canConfirm ? (
          <Button size="small" variant="contained" onClick={() => setIssueTarget(row)}>
            Cấp vật tư
          </Button>
        ) : null}
        {row.status === 'PENDING_CONFIRMATION' && canConfirm ? (
          <>
            <Button
              size="small"
              variant="contained"
              color="success"
              disabled={confirmingId === row.id || rejectingId === row.id}
              onClick={() => setConfirmTarget(row)}
            >
              Xác nhận và chia phôi
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              disabled={confirmingId === row.id || rejectingId === row.id}
              onClick={() => askRejectCast(row)}
            >
              Lỗi đúc
            </Button>
          </>
        ) : null}
      </Stack>
    ),
    [
      askRejectCast,
      canConfirm,
      setConfirmTarget,
      confirmingId,
      dialog.openView,
      rejectingId,
    ],
  )

  const columns = useMemo<Column<CastingSlip, CastingSlip>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã phiếu',
        width: 100,
        align: 'left',
        headSx: cellLeft,
        cellSx: { ...cellLeft, fontWeight: 700 },
        render: (row) => (
          <>
            {row.code}
            {(row.redos?.length ?? 0) > 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
                {row.redos!.length} phiếu làm lại
              </Typography>
            ) : null}
          </>
        ),
        renderSub: (sub) => (
          <>
            {sub.code}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
              Phiếu làm lại
            </Typography>
          </>
        ),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        width: 190,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => <SlipStatusChip status={row.status} />,
        renderSub: (sub) => <SlipStatusChip status={sub.status} />,
        filter: (
          <ColumnHeaderFilter
            valueId={params.status}
            options={SLIP_STATUS_OPTIONS}
            onChange={(status) => table.setFilter({ status })}
          />
        ),
      },
      {
        key: 'slipDate',
        header: 'Ngày',
        width: 110,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        filter: (
          <ColumnHeaderDate
            value={params.slipDate}
            onChange={(slipDate) => table.setFilter({ slipDate })}
          />
        ),
        renderSub: (sub) => sub.slipDate,
      },
      {
        key: 'batchOrderCodes',
        header: 'Đơn trong lô',
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        renderSub: (sub) => sub.batchOrderCodes,
        filter: (
          <ColumnHeaderSearch
            value={params.batchOrderCodes}
            onChange={(batchOrderCodes) => table.setFilter({ batchOrderCodes })}
            placeholder="Mã đơn…"
          />
        ),
      },
      {
        key: 'waxWeightGram',
        header: 'Sáp (g)',
        width: 90,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => formatGram(row.waxWeightGram),
        renderSub: (sub) => formatGram(sub.waxWeightGram),
        filter: (
          <ColumnHeaderSearch
            value={params.waxWeight}
            onChange={(waxWeight) => table.setFilter({ waxWeight })}
            placeholder="Sáp…"
          />
        ),
      },
      {
        key: 'issueTotalGram',
        header: 'Tổng giao (g)',
        width: 110,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => formatGram(row.issueTotalGram),
        renderSub: (sub) => formatGram(sub.issueTotalGram),
        filter: (
          <ColumnHeaderSearch
            value={params.issueTotal}
            onChange={(issueTotal) => table.setFilter({ issueTotal })}
            placeholder="Tổng giao…"
          />
        ),
      },
      {
        key: 'castLossGram',
        header: 'Hao hụt đúc (g)',
        width: 130,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) =>
          row.castLossGram != null
            ? `${formatGram(row.castLossGram)}${row.castLossPercent != null ? ` (${row.castLossPercent}%)` : ''}`
            : '—',
        renderSub: (sub) =>
          sub.castLossGram != null
            ? `${formatGram(sub.castLossGram)}${sub.castLossPercent != null ? ` (${sub.castLossPercent}%)` : ''}`
            : '—',
      },
      {
        key: 'actions',
        header: 'Hành động',
        width: 360,
        align: 'center',
        render: (row) => renderSlipActions(row),
        renderSub: (sub) => renderSlipActions(sub),
      },
    ],
    [
      renderSlipActions,
      params.status,
      params.batchOrderCodes,
      params.issueTotal,
      params.slipDate,
      params.waxWeight,
      table.setFilter,
    ],
  )

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: { md: 1 }, minHeight: { md: 0 }, height: { md: '100%' }, overflow: { xs: 'visible', md: 'hidden' } }}
    >
      <PageHeader
        title="Lệnh đúc"
        subtitle="Thủ kho lọc đơn đã có sáp, lên một phiếu cho một lần đúc và in giao thợ đúc; thợ đúc quét QR để nhận."
        compactSubtitle
      />
      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(row) => row.id}
        subRows={{
          get: (row) => row.redos ?? [],
          key: (sub) => sub.id,
          label: (count) => `${count} phiếu làm lại`,
        }}
        loading={list.isLoading && !list.data}
        errorText={list.error instanceof Error ? list.error.message : undefined}
        emptyText={table.hasFilters ? 'Không có phiếu đúc khớp bộ lọc.' : 'Chưa có phiếu đúc.'}
        variant="grid"
        fixedLayout
        minWidth={720}
        page={params.page}
        pageSize={params.pageSize}
        total={list.data?.total ?? 0}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        rowsLabel="phiếu"
        sx={{ flex: { md: 1 } }}
      />
      <CastingSlipViewDialog
        open={dialog.open && dialog.kind === 'view'}
        slip={dialog.row}
        canConfirm={canConfirm}
        busy={confirm.isPending}
        busyReject={rejectCast.isPending}
        onConfirm={(slip) => setConfirmTarget(slip)}
        onReject={askRejectCast}
        onClose={closeView}
      />
      <CastingSlipConfirmDialog
        slip={confirmTarget}
        saving={confirm.isPending}
        onClose={() => setConfirmTarget(null)}
        onSave={(payload) => confirmTarget && confirm.mutate({ slip: confirmTarget, payload })}
      />
      <CastingSlipIssueDialog
        slip={issueTarget}
        saving={issue.isPending}
        onClose={() => setIssueTarget(null)}
        onSave={(images) => issueTarget && issue.mutate({ slip: issueTarget, images })}
      />
      <CastingSlipCreateDialog
        open={createOpen}
        preselectId={preselectId}
        saving={create.isPending}
        onClose={closeCreate}
        onSave={(payload) => create.mutate(payload)}
      />
    </Stack>
  )
}

function CastingSlipViewDialog({
  open,
  slip,
  canConfirm,
  busy,
  busyReject,
  onConfirm,
  onReject,
  onClose,
}: {
  open: boolean
  slip: CastingSlip | null
  canConfirm: boolean
  busy: boolean
  busyReject: boolean
  onConfirm: (slip: CastingSlip) => void
  onReject: (slip: CastingSlip) => void
  onClose: () => void
}) {
  const thumbs = useMemo(
    () =>
      (slip?.images ?? []).map((image, index) => ({
        kind: 'PRODUCT' as const,
        url: image.url,
        publicId: image.publicId,
        width: image.width,
        height: image.height,
        sortOrder: index,
      })),
    [slip?.images],
  )
  const resultThumbs = useMemo(
    () =>
      (slip?.resultImages ?? []).map((image, index) => ({
        kind: 'CASTING_TREE' as const,
        url: image.url,
        publicId: image.publicId,
        width: image.width,
        height: image.height,
        sortOrder: index,
      })),
    [slip?.resultImages],
  )

  const disabledCell = { bgcolor: 'action.hover', color: 'text.disabled' } as const

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', fontWeight: 800 }}>
        PHIẾU ĐÚC — {slip?.code ?? ''}
      </DialogTitle>
      <DialogContent>
        {slip ? (
          <Stack spacing={2}>
            <Box>
              <SlipStatusChip status={slip.status} />
            </Box>
            <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1.5, columnGap: 2.5 }}>
              <Typography variant="body2">
                <strong>Ngày:</strong> {slip.slipDate}
              </Typography>
              <Typography variant="body2">
                <strong>Giao cho thợ:</strong> {slip.startedByName ?? '—'}
              </Typography>
              {slip.createdByName ? (
                <Typography variant="body2">
                  <strong>Thủ kho lập:</strong> {slip.createdByName}
                </Typography>
              ) : null}
            </Stack>
            <Table size="small" sx={{ '& td, & th': { px: 1 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Đơn trong lô</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Mã SP</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Sản phẩm</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    SL
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    TL sáp (g)
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {slip.orders.map((line) => (
                  <TableRow key={line.intakeOrderId}>
                    <TableCell sx={{ fontWeight: 700 }}>{line.code}</TableCell>
                    <TableCell>{line.trackingCode ?? '—'}</TableCell>
                    <TableCell>{line.productName || '—'}</TableCell>
                    <TableCell align="right">{line.qty}</TableCell>
                    <TableCell align="right">{formatGram(line.waxWeightGram)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 700 }}>
                    Trọng lượng sáp (cây thông) giao
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {formatGram(slip.waxWeightGram)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Table
              size="small"
              sx={{
                border: '2px solid',
                borderColor: 'grey.600',
                borderCollapse: 'collapse',
                '& .MuiTableCell-root': {
                  border: '1px solid',
                  borderColor: 'grey.500',
                  py: 1.25,
                  px: 1.5,
                },
                '& .MuiTableHead-root .MuiTableCell-root': {
                  bgcolor: 'grey.200',
                  fontWeight: 700,
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    Giao
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    Trả
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>S999 (g)</TableCell>
                  <TableCell>{formatGram(slip.issueS999Gram)}</TableCell>
                  <TableCell align="center" sx={disabledCell}>
                    x
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Hội (g)</TableCell>
                  <TableCell>{formatGram(slip.issueMasterAlloyGram)}</TableCell>
                  <TableCell align="center" sx={disabledCell}>
                    x
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>S925 (g)</TableCell>
                  <TableCell>{formatGram(slip.issueS925Gram)}</TableCell>
                  <TableCell align="center" sx={disabledCell}>
                    x
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Tổng</TableCell>
                  <TableCell>{formatGram(slip.issueTotalGram)}</TableCell>
                  {/* Trả = cây thông sau đúc + bạc giao chưa dùng (bạc + hội đã hoà nên không tách từng loại). */}
                  <TableCell sx={{ fontWeight: 700 }}>
                    {slip.returnTotalGram != null ? (
                      formatGram(slip.returnTotalGram)
                    ) : (
                      <Typography component="span" variant="caption" color="text.secondary">
                        chờ thợ đúc nhập kết quả
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
                {slip.castLossGram != null ? (
                  <>
                    <TableRow>
                      <TableCell>Trong đó: cây thông sau đúc</TableCell>
                      <TableCell colSpan={2}>{formatGram(slip.castTreeWeightGram)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Trong đó: bạc giao chưa dùng (trả kho)</TableCell>
                      <TableCell colSpan={2}>{formatGram(slip.leftoverGram)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>
                        Hao hụt đúc{slip.startedByName ? ` — ${slip.startedByName}` : ''}
                      </TableCell>
                      <TableCell colSpan={2} sx={{ fontWeight: 700, color: Number(slip.castLossGram) < 0 ? 'error.main' : undefined }}>
                        {formatGram(slip.castLossGram)} g
                        {slip.castLossPercent != null ? ` (${slip.castLossPercent}% bạc đã dùng)` : ''}
                      </TableCell>
                    </TableRow>
                  </>
                ) : null}
              </TableBody>
            </Table>
            {thumbs.length ? (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }} gutterBottom>
                  Ảnh
                </Typography>
                <IntakeImageThumbs label="Ảnh phiếu đúc" images={thumbs} />
              </Box>
            ) : null}
            {slip.startedAt ? (
              <Typography variant="body2">
                <strong>Bắt đầu đúc:</strong> {formatDateTime(slip.startedAt)}
                {slip.startedByName ? ` · ${slip.startedByName}` : ''}
              </Typography>
            ) : null}
            {slip.castTreeWeightGram != null ? (
              <Stack spacing={0.75}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Kết quả sau đúc
                  {slip.submittedByName ? ` (${slip.submittedByName})` : ''}
                </Typography>
                <Typography variant="body2">
                  TL cây thông (trả): <strong>{formatGram(slip.castTreeWeightGram)} g</strong> · Bạc đã dùng:{' '}
                  <strong>{formatGram(slip.silverUsedGram)} g</strong> · Thạch cao đã dùng:{' '}
                  <strong>{formatGram(slip.plasterUsedGram)} g</strong>
                </Typography>
                {resultThumbs.length ? <IntakeImageThumbs label="Ảnh sau đúc" images={resultThumbs} /> : null}
              </Stack>
            ) : null}
            {slip.confirmedAt ? (
              <Typography variant="body2">
                <strong>Thủ kho xác nhận:</strong> {formatDateTime(slip.confirmedAt)}
                {slip.confirmedByName ? ` · ${slip.confirmedByName}` : ''}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose}>Đóng</Button>
        {slip?.status === 'PENDING_CONFIRMATION' && canConfirm ? (
          <>
            <Button
              variant="contained"
              color="error"
              disabled={busy || busyReject}
              onClick={() => onReject(slip)}
            >
              Lỗi đúc
            </Button>
            <Button variant="contained" disabled={busy || busyReject} onClick={() => onConfirm(slip)}>
              Xác nhận và chia phôi
            </Button>
          </>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}
