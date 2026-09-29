import { useEffect, useMemo, useState } from 'react'
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
  createCastingSlipApi,
  deleteCastingSlipApi,
  issueCastingSlipApi,
  getCastingSlipByCodeApi,
  listCastingSlipsApi,
  startCastingSlipApi,
  submitCastingSlipResultApi,
  type CastingSlip,
  type CastingSlipImage,
  type CastingSlipResultPayload,
  type CreateCastingSlipPayload,
  type CastingSlipStatus,
} from '../api/castingSlips'
import { useAuth } from '../auth/AuthContext'
import { formatQty } from '../api/inventory'
import {
  ColumnHeaderDate,
  ColumnHeaderFilter,
  ColumnHeaderSearch,
  DataTable,
  PageHeader,
  RowActions,
  type Column,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { useTableParams } from '../hooks/useTableParams'
import { formatDateTime } from '../orders/catalog'
import { CastingLossDialog } from '../intake/CastingLossDialog'
import { CastingSlipCreateDialog } from '../intake/CastingSlipCreateDialog'
import { CastingSlipIssueDialog } from '../intake/CastingSlipIssueDialog'
import { CastingSlipResultDialog } from '../intake/CastingSlipResultDialog'
import { IntakeImageThumbs } from '../intake/IntakeImageThumbs'
import { can, Permission } from '../auth/permissions'
import { canConfirmIntakeWarehouse } from '../intake/intakeWarehouseAccess'

const cellLeft = { textAlign: 'left', paddingLeft: '10px' } as const

const SLIP_STATUS_META: Record<CastingSlipStatus, { label: string; bg: string }> = {
  PENDING_ISSUE: { label: 'Chờ cấp vật tư', bg: '#8d6e63' },
  WAIT_CASTING: { label: 'Chờ đúc', bg: '#283593' },
  CASTING: { label: 'Đang đúc', bg: '#c62828' },
  PENDING_CONFIRMATION: { label: 'Chờ thủ kho xác nhận', bg: '#e65100' },
  DONE: { label: 'Đúc xong', bg: '#00695c' },
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
  const [resultTarget, setResultTarget] = useState<CastingSlip | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [issueTarget, setIssueTarget] = useState<CastingSlip | null>(null)
  const [lossOpen, setLossOpen] = useState(false)
  // `?new=<id>`: mở từ nút "Lên lệnh đúc" trên một dòng Lệnh sản xuất.
  const preselectId = searchParams.get('new')

  useEffect(() => {
    if (preselectId) setCreateOpen(true)
  }, [preselectId])

  // `/casting/:code`: thợ đúc quét QR trên phiếu giấy → mở ngay phiếu đó (bước 8).
  const scanned = useQuery({
    queryKey: ['casting-slip', scannedCode],
    queryFn: () => getCastingSlipByCodeApi(scannedCode!),
    enabled: Boolean(scannedCode),
    staleTime: 0,
  })
  useEffect(() => {
    if (scanned.data) dialog.openView(scanned.data)
  }, [scanned.data, dialog.openView])
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
  })

  // Đổi trạng thái phiếu kéo theo trạng thái đơn tạo (G, H) nên làm mới cả hai danh sách.
  function afterAction(updated: CastingSlip, message: string) {
    toast.success(message)
    void queryClient.invalidateQueries({ queryKey: ['casting-slips'] })
    void queryClient.invalidateQueries({ queryKey: ['intake-orders'] })
    dialog.openView(updated)
  }
  const create = useMutation({
    mutationFn: (payload: CreateCastingSlipPayload) => createCastingSlipApi(payload),
    onSuccess: (slip) => {
      toast.success(`Đã lên phiếu đúc ${slip.code} (${slip.orders.length} đơn) — in phiếu, cấp vật tư rồi chụp ảnh`)
      closeCreate()
      dialog.openView(slip)
      void queryClient.invalidateQueries({ queryKey: ['casting-slips'] })
      void queryClient.invalidateQueries({ queryKey: ['intake-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['casting-slip-candidates'] })
      window.open(`/casting/${slip.code}/print`, '_blank')
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
      afterAction(updated, `Phiếu ${updated.code}: đã cấp vật tư — ${updated.orders.length} đơn sang Chờ đúc`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (slip: CastingSlip) => deleteCastingSlipApi(slip.id),
    onSuccess: (_, slip) => {
      toast.success(`Đã huỷ phiếu ${slip.code} — các đơn trả về danh sách chờ đúc`)
      closeView()
      void queryClient.invalidateQueries({ queryKey: ['casting-slips'] })
      void queryClient.invalidateQueries({ queryKey: ['intake-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['casting-slip-candidates'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const start = useMutation({
    mutationFn: (slip: CastingSlip) => startCastingSlipApi(slip.id),
    onSuccess: (updated) => afterAction(updated, `Phiếu ${updated.code}: bắt đầu đúc`),
    onError: (error: Error) => toast.error(error.message),
  })
  const submitResult = useMutation({
    mutationFn: (vars: { slip: CastingSlip; payload: CastingSlipResultPayload }) =>
      submitCastingSlipResultApi(vars.slip.id, vars.payload),
    onSuccess: (updated) => {
      setResultTarget(null)
      afterAction(updated, `Phiếu ${updated.code}: đã nhập kết quả, chờ thủ kho xác nhận`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const confirm = useMutation({
    mutationFn: (slip: CastingSlip) => confirmCastingSlipApi(slip.id),
    onSuccess: (updated) => afterAction(updated, `Phiếu ${updated.code}: đã xác nhận Đúc xong`),
    onError: (error: Error) => toast.error(error.message),
  })
  const canConfirm = canConfirmIntakeWarehouse(user)
  const canCast = can(user, Permission.PRODUCTION_CAST)

  const columns = useMemo<Column<CastingSlip>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã phiếu',
        width: 100,
        align: 'left',
        headSx: cellLeft,
        cellSx: { ...cellLeft, fontWeight: 700 },
      },
      {
        key: 'status',
        header: 'Trạng thái',
        width: 190,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => <SlipStatusChip status={row.status} />,
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
      },
      {
        key: 'batchOrderCodes',
        header: 'Đơn trong lô',
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
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
      },
      {
        key: 'actions',
        header: 'Hành động',
        width: 100,
        align: 'center',
        render: (row) => (
          <RowActions titles={{ view: 'Xem phiếu đúc' }} onView={() => dialog.openView(row)} />
        ),
      },
    ],
    [
      dialog.openView,
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
        actions={
          canConfirm ? (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => setLossOpen(true)}>
                Hao hụt theo thợ
              </Button>
              <Button variant="contained" onClick={() => setCreateOpen(true)}>
                Lên phiếu đúc
              </Button>
            </Stack>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(row) => row.id}
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
        canCast={canCast}
        busy={start.isPending || confirm.isPending || remove.isPending}
        onIssue={(slip) => setIssueTarget(slip)}
        onRemove={(slip) => remove.mutate(slip)}
        onStart={(slip) => start.mutate(slip)}
        onEnterResult={(slip) => setResultTarget(slip)}
        onConfirm={(slip) => confirm.mutate(slip)}
        onClose={closeView}
      />
      <CastingLossDialog open={lossOpen} onClose={() => setLossOpen(false)} />
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
      <CastingSlipResultDialog
        slip={resultTarget}
        saving={submitResult.isPending}
        onClose={() => setResultTarget(null)}
        onSave={(payload) => resultTarget && submitResult.mutate({ slip: resultTarget, payload })}
      />
    </Stack>
  )
}

function CastingSlipViewDialog({
  open,
  slip,
  canConfirm,
  canCast,
  busy,
  onIssue,
  onRemove,
  onStart,
  onEnterResult,
  onConfirm,
  onClose,
}: {
  open: boolean
  slip: CastingSlip | null
  canConfirm: boolean
  canCast: boolean
  busy: boolean
  onIssue: (slip: CastingSlip) => void
  onRemove: (slip: CastingSlip) => void
  onStart: (slip: CastingSlip) => void
  onEnterResult: (slip: CastingSlip) => void
  onConfirm: (slip: CastingSlip) => void
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
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}
            >
              <Typography variant="body2">
                <strong>Ngày:</strong> {slip.slipDate}
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
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
        {slip && canConfirm ? (
          <Button variant="outlined" href={`/casting/${slip.code}/print`} target="_blank">
            {slip.lastPrintedAt ? 'In lại phiếu' : 'In phiếu'}
          </Button>
        ) : null}
        {slip?.status === 'PENDING_ISSUE' ? (
          canConfirm ? (
            <>
              <Button color="error" disabled={busy} onClick={() => onRemove(slip)}>
                Huỷ phiếu
              </Button>
              <Button variant="contained" onClick={() => onIssue(slip)}>
                Cấp vật tư &amp; chụp ảnh
              </Button>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
              Chờ thủ kho cấp vật tư
            </Typography>
          )
        ) : null}
        {slip?.status === 'WAIT_CASTING' && canCast ? (
          <Button variant="contained" disabled={busy} onClick={() => onStart(slip)}>
            Bắt đầu đúc
          </Button>
        ) : null}
        {slip?.status === 'CASTING' && canCast ? (
          <Button variant="contained" onClick={() => onEnterResult(slip)}>
            Nhập kết quả đúc
          </Button>
        ) : null}
        {(slip?.status === 'WAIT_CASTING' || slip?.status === 'CASTING') && !canCast ? (
          <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
            {slip.status === 'WAIT_CASTING' ? 'Chờ thợ đúc bắt đầu' : 'Chờ thợ đúc nhập kết quả'}
          </Typography>
        ) : null}
        {slip?.status === 'PENDING_CONFIRMATION' ? (
          canConfirm ? (
            <Button variant="contained" disabled={busy} onClick={() => onConfirm(slip)}>
              Xác nhận đúc xong
            </Button>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
              Chờ thủ kho xác nhận
            </Typography>
          )
        ) : null}
      </DialogActions>
    </Dialog>
  )
}
