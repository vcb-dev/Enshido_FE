import { useCallback, useMemo, useState } from 'react'
import { Button, Checkbox, Chip, Paper, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  confirmCastingSlipApi,
  cutCastingSlipApi,
  cutCastingSlipsApi,
  type CutCastingSlipItem,
  listCastingSlipsApi,
  rejectCastingSlipApi,
  type CastingSlip,
  type CastingSlipStatus,
  type ConfirmCastingSlipPayload,
} from '../api/castingSlips'
import { useAuth } from '../auth/AuthContext'
import { formatQty } from '../api/inventory'
import { ColumnHeaderDate, ColumnHeaderSearch, DataTable, PageHeader, type Column } from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { useTableParams } from '../hooks/useTableParams'
import { formatDateTime } from '../orders/catalog'
import { CastingSlipConfirmDialog } from '../intake/CastingSlipConfirmDialog'
import { CastingSlipCutDialog, CastingSlipsCutDialog } from '../intake/CastingSlipCutDialog'
import { canConfirmIntakeWarehouse } from '../intake/intakeWarehouseAccess'
import { applyCastingSlipRejected, applyCastingSlipUpdate } from '../casting/castingSlipsCache'
import { scheduleMyTicketsRefresh } from '../orders/myTicketsRefresh'
import { invalidateBtpStock } from '../orders/btpStock'
import { invalidateNvlWarehouse } from '../orders/nvlStock'
import { LIVE_REFRESH_MS, liveRefresh } from '../hooks/liveRefresh'
import { CastingSlipViewDialog, SlipStatusChip } from './CastingOrdersPage'

import { canCutCastingSlip, getCastingSlipCutBlockedReason, hasCastingSlipCutData } from '../casting/castingCuts'

const cellLeft = { textAlign: 'left', paddingLeft: '10px' } as const

/** Xác nhận số liệu thợ trước, rồi cắt cây từ các phiếu Đúc xong. */
const TABS: { value: CastingSlipStatus; label: string }[] = [
  { value: 'PENDING_CONFIRMATION', label: 'Chờ xác nhận đúc' },
  { value: 'DONE', label: 'Đúc xong / Cắt cây' },
]

const CUT_FILTERS = {
  status: 'DONE',
  slipDate: '',
  batchOrderCodes: '',
}

function formatGram(value: string | null) {
  if (value == null || value === '') return '—'
  return formatQty(value)
}

function renderCutStatus(slip: CastingSlip) {
  if (slip.status === 'DONE' && hasCastingSlipCutData(slip)) {
    return <>
      <Chip size="small" label="Đã cắt cây" color="success" />
      {slip.restWeightGram == null ? <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        Thiếu số liệu cây còn lại.
      </Typography> : null}
    </>
  }
  return <>
    <SlipStatusChip status={slip.status} />
    {slip.status === 'DONE' && getCastingSlipCutBlockedReason(slip) ? (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {getCastingSlipCutBlockedReason(slip)}
      </Typography>
    ) : null}
  </>
}

/**
 * Màn "Cắt cây thông": thủ kho xử lý phiếu đúc đã đúc xong — cân phôi từng đơn + phần cây
 * còn lại (hộp `CastingSlipCutDialog`), sinh lệnh SX chờ Nguội; hoặc báo lỗi đúc.
 * Dùng chung API phiếu đúc, không có bảng riêng.
 */
export function CastingCutsPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const dialog = useCrudDialog<CastingSlip>()
  const [confirmTarget, setConfirmTarget] = useState<CastingSlip | null>(null)
  const [selected, setSelected] = useState<CastingSlip[]>([])
  const [bulkTargets, setBulkTargets] = useState<CastingSlip[]>([])
  const [cutTarget, setCutTarget] = useState<CastingSlip | null>(null)
  const table = useTableParams({ pageSize: 25, filters: CUT_FILTERS })
  const { params } = table
  const status = (params.status || 'DONE') as CastingSlipStatus
  const canConfirm = canConfirmIntakeWarehouse(user)

  const list = useQuery({
    queryKey: ['casting-slips', 'cuts', status, params.page, params.pageSize, params.slipDate, params.batchOrderCodes],
    queryFn: () =>
      listCastingSlipsApi({
        status,
        slipDate: params.slipDate,
        batchOrderCodes: params.batchOrderCodes,
        page: params.page,
        pageSize: params.pageSize,
      }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    // Thợ đúc báo xong trên máy khác — phiếu chờ cắt phải tự hiện.
    ...liveRefresh(LIVE_REFRESH_MS.list),
  })

  const confirm = useMutation({
    mutationFn: (slip: CastingSlip) => confirmCastingSlipApi(slip.id),
    onSuccess: (updated) => {
      setConfirmTarget(null)
      dialog.close()
      toast.success(`Phiếu ${updated.code}: đã xác nhận — Đúc xong`)
      applyCastingSlipUpdate(queryClient, updated)
      scheduleMyTicketsRefresh(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['casting-slips'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const cut = useMutation({
    mutationFn: ({ slip, payload }: { slip: CastingSlip; payload: ConfirmCastingSlipPayload }) =>
      cutCastingSlipApi(slip.id, payload),
    onSuccess: (updated) => {
      setCutTarget(null)
      setSelected((current) => current.filter((slip) => slip.id !== updated.id))
      dialog.close()
      toast.success(`Phiếu ${updated.code}: đã cắt cây thông, ${updated.orders.length} đơn chuyển Chờ nguội`)
      applyCastingSlipUpdate(queryClient, updated)
      scheduleMyTicketsRefresh(queryClient)
      // Cập nhật phiếu và lệnh sản xuất sau khi cắt cây.
      void queryClient.invalidateQueries({ queryKey: ['casting-slips'] })
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['production-order-lookups'] })
      invalidateBtpStock(queryClient)
      invalidateNvlWarehouse(queryClient)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const cutMany = useMutation({
    mutationFn: (items: CutCastingSlipItem[]) => cutCastingSlipsApi(items),
    onSuccess: (updated) => {
      setBulkTargets([])
      setSelected([])
      toast.success(`Đã cắt cây thông: ${updated.reduce((sum, slip) => sum + slip.orders.length, 0)} đơn chuyển Chờ nguội`)
      for (const slip of updated) applyCastingSlipUpdate(queryClient, slip)
      scheduleMyTicketsRefresh(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['casting-slips'] })
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['production-order-lookups'] })
      invalidateBtpStock(queryClient)
      invalidateNvlWarehouse(queryClient)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const toggleSelected = (slip: CastingSlip) => setSelected((current) =>
    current.some((item) => item.id === slip.id)
      ? current.filter((item) => item.id !== slip.id)
      : current.length < 25 ? [...current, slip] : current,
  )
  const rejectCast = useMutation({
    mutationFn: (slip: CastingSlip) => rejectCastingSlipApi(slip.id),
    onSuccess: (redo, failedSlip) => {
      toast.success(`Đã báo lỗi đúc — phiếu làm lại ${redo.code} (Chờ đúc).`)
      applyCastingSlipRejected(queryClient, { ...failedSlip, status: 'CAST_FAILED' }, redo)
      scheduleMyTicketsRefresh(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['casting-slips'] })
      dialog.close()
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const confirmingId = confirm.isPending ? confirm.variables?.id : null
  const cuttingId = cut.isPending ? cut.variables?.slip.id : null
  const rejectingId = rejectCast.isPending ? rejectCast.variables?.id : null

  const askRejectCast = useCallback(
    (slip: CastingSlip) => {
      const orders = slip.orders.map((line) => line.code).join(', ')
      if (
        !window.confirm(
          `Báo lỗi đúc phiếu ${slip.code} (${orders})?\n\nHệ thống tạo phiếu mới cùng số liệu, đơn về Chờ đúc để thợ làm lại.`,
        )
      ) {
        return
      }
      rejectCast.mutate(slip)
    },
    [rejectCast.mutate],
  )

  const renderActions = useCallback(
    (row: CastingSlip) => (
      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button size="small" variant="outlined" onClick={() => dialog.openView(row)}>
          Xem chi tiết
        </Button>
        {canCutCastingSlip(row) && canConfirm ? (
          <Button
            size="small"
            variant="contained"
            disabled={cuttingId === row.id}
            onClick={() => setCutTarget(row)}
          >
            Cắt cây thông
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
              Xác nhận đúc
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
    [askRejectCast, canConfirm, confirmingId, cuttingId, dialog.openView, rejectingId],
  )

  const renderSelection = (row: CastingSlip) => <Tooltip title={
    getCastingSlipCutBlockedReason(row) ?? (list.isPlaceholderData ? 'Đang tải danh sách phiếu.' :
      cutMany.isPending ? 'Đang lưu cắt cây.' :
      selected.length >= 25 && !selected.some((item) => item.id === row.id) ? 'Chỉ chọn tối đa 25 phiếu.' : '')
  }><span><Checkbox
    checked={selected.some((item) => item.id === row.id)}
    disabled={!canCutCastingSlip(row) || list.isPlaceholderData || cutMany.isPending ||
      (selected.length >= 25 && !selected.some((item) => item.id === row.id))}
    onChange={() => toggleSelected(row)}
    slotProps={{ input: { 'aria-label': `Chọn phiếu ${row.code}, các đơn ${row.batchOrderCodes}` } }}
  /></span></Tooltip>

  const columns = useMemo<Column<CastingSlip, CastingSlip>[]>(
    () => [
      ...(status === 'DONE' && canConfirm ? [{
        key: 'selection',
        header: 'Chọn',
        width: 65,
        render: renderSelection,
        renderSub: renderSelection,
      }] : []),
      {
        key: 'code',
        header: 'Mã phiếu đúc',
        width: 110,
        align: 'left',
        headSx: cellLeft,
        cellSx: { ...cellLeft, fontWeight: 700 },
        render: (row) => row.code,
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
        render: renderCutStatus,
        renderSub: renderCutStatus,
      },
      {
        key: 'slipDate',
        header: 'Ngày đúc',
        width: 110,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        renderSub: (sub) => sub.slipDate,
        filter: <ColumnHeaderDate value={params.slipDate} onChange={(slipDate) => table.setFilter({ slipDate })} />,
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
        key: 'startedByName',
        header: 'Thợ đúc',
        width: 130,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => row.startedByName ?? '—',
        renderSub: (sub) => sub.startedByName ?? '—',
      },
      {
        key: 'castTreeWeightGram',
        header: 'Cây thông sau đúc (g)',
        width: 150,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => formatGram(row.castTreeWeightGram),
        renderSub: (sub) => formatGram(sub.castTreeWeightGram),
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
        key: 'confirmedAt',
        header: 'Xác nhận đúc',
        width: 170,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) =>
          row.confirmedAt ? (
            <>
              {formatDateTime(row.confirmedAt)}
              {row.confirmedByName ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {row.confirmedByName}
                </Typography>
              ) : null}
            </>
          ) : (
            '—'
          ),
        renderSub: (sub) => (sub.confirmedAt ? formatDateTime(sub.confirmedAt) : '—'),
      },
      {
        key: 'actions',
        header: 'Hành động',
        width: 300,
        align: 'center',
        render: (row) => renderActions(row),
        renderSub: (sub) => renderActions(sub),
      },
    ],
    [renderActions, params.slipDate, params.batchOrderCodes, table.setFilter, status, canConfirm, selected, list.isPlaceholderData, cutMany.isPending],
  )

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: { md: 1 }, minHeight: { md: 0 }, height: { md: '100%' }, overflow: { xs: 'visible', md: 'hidden' } }}
    >
      <PageHeader
        title="Cắt cây thông"
        subtitle="Chọn các phiếu Đúc xong để cắt nhiều đơn cùng lần. Nhập số liệu từng đơn; tất cả đơn đã cắt chuyển sang Chờ nguội."
        compactSubtitle
      />
      <Paper sx={{ px: 1.5 }}>
        <Tabs value={status} onChange={(_, value: CastingSlipStatus) => { table.setFilter({ status: value }); setSelected([]) }}>
          {TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </Tabs>
      </Paper>
      {status === 'DONE' && canConfirm ? <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" disabled={!selected.length || cutMany.isPending} onClick={() => setBulkTargets(selected)}>
          Cắt các đơn đã chọn ({selected.reduce((sum, slip) => sum + slip.orders.length, 0)} đơn)
        </Button>
        {selected.length ? <Button onClick={() => setSelected([])}>Bỏ chọn</Button> : null}
        <Typography variant="caption" color="text.secondary">Chọn phiếu là chọn toàn bộ đơn trong cây thông (tối đa 25 phiếu).</Typography>
      </Stack> : null}
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
        emptyText={
          status === 'PENDING_CONFIRMATION' ? 'Không có phiếu đúc nào chờ xác nhận.' : 'Chưa có phiếu đúc xong.'
        }
        variant="grid"
        fixedLayout
        minWidth={900}
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
        canCast={false}
        busy={confirm.isPending || cut.isPending}
        busyReject={rejectCast.isPending}
        onConfirm={(slip) => setConfirmTarget(slip)}
        onCut={(slip) => setCutTarget(slip)}
        onReject={askRejectCast}
        onEnterResult={dialog.close}
        onClose={dialog.close}
      />
      <CastingSlipConfirmDialog
        slip={confirmTarget}
        saving={confirm.isPending}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => confirmTarget && confirm.mutate(confirmTarget)}
      />
      <CastingSlipsCutDialog
        slips={bulkTargets}
        saving={cutMany.isPending}
        onClose={() => setBulkTargets([])}
        onSave={(items) => cutMany.mutate(items)}
      />
      <CastingSlipCutDialog
        slip={cutTarget}
        saving={cut.isPending}
        onClose={() => setCutTarget(null)}
        onSave={(payload) => cutTarget && cut.mutate({ slip: cutTarget, payload })}
      />
    </Stack>
  )
}
