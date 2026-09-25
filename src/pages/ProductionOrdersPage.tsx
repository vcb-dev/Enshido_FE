import { useMemo, useState, type ReactNode } from 'react'
import { Box, Button, Chip, IconButton, Link, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import {
  createProductionOrderApi,
  deleteProductionOrderApi,
  getProductionOrderApi,
  getProductionOrderLookupsApi,
  listBtpOptionsApi,
  listFinishedProductOptionsApi,
  listNvlOptionsApi,
  listProductionOrdersApi,
  updateProductionOrderApi,
  type ProductionOrderDetail,
  type ProductionOrderListResponse,
  type ProductionOrderRow,
  type ProductionRequestType,
  type ProductionSource,
  type ProductionStatus,
  type SubTicketSummary,
  type UpsertProductionOrderPayload,
} from '../api/productionOrders'
import { formatQty, formatStockedDate } from '../api/inventory'
import {
  ColumnHeaderDate,
  ColumnHeaderFilter,
  ColumnHeaderSearch,
  DataTable,
  EyeIcon,
  PageHeader,
  RowActions,
  type Column,
} from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useDeleteRowDialog } from '../hooks/useDeleteRowDialog'
import { useTableParams } from '../hooks/useTableParams'
import {
  formatDateTime,
  REQUEST_TYPES,
  REQUEST_TYPE_META,
  STATUS_META,
  STATUS_TABS,
  SUB_TICKET_STATE_META,
} from '../orders/catalog'
import { RequestTypeChip, StatusChip, SubTicketStateChip } from '../orders/OrderChips'
import { invalidateBtpStock } from '../orders/btpStock'
import { invalidateNvlStock } from '../orders/nvlStock'
import { afterProductionOrderSaved } from '../orders/orderCache'
import { deadlineWarning } from '../orders/deadline'
import { ProductionOrderFormDialog } from '../orders/ProductionOrderFormDialog'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'

export function ProductionOrdersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.roleCode === 'ADMIN' || Boolean(user?.extraRoles?.includes('ADMIN'))
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductionOrderDetail | null>(null)
  const table = useTableParams({
    pageSize: 25,
    filters: {
      status: '',
      requestType: '',
      source: 'NVL' as ProductionSource,
      receivedDate: '',
      dueDate: '',
    },
  })
  const { params } = table
  const listSource: ProductionSource = params.source === 'BTP' ? 'BTP' : 'NVL'
  const statusTab = STATUS_TABS.includes(params.status as ProductionStatus)
    ? (params.status as ProductionStatus | '')
    : ''
  const search = useDebouncedValue(params.search, 300)

  const listParams = {
    status: statusTab,
    requestType: params.requestType as ProductionRequestType | '',
    source: listSource,
    search,
    receivedDate: params.receivedDate,
    dueDate: params.dueDate,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort || undefined,
    dir: params.sort ? params.dir : undefined,
  }

  const list = useQuery({
    queryKey: ['production-orders', listParams],
    queryFn: () => listProductionOrdersApi(listParams),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    // Đây là màn điều hành; trạng thái phiếu có thể đổi từ điện thoại của thợ.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
  const lookups = useQuery({
    queryKey: ['production-order-lookups'],
    queryFn: getProductionOrderLookupsApi,
    staleTime: 5 * 60_000,
    enabled: formOpen,
  })

  const create = useMutation({
    mutationFn: (payload: UpsertProductionOrderPayload) => createProductionOrderApi(payload),
    onSuccess: (order) => {
      afterProductionOrderSaved(queryClient, order)
      setFormOpen(false)
      toast.success(`Đã lên đơn ${order.code}`)
      navigate(`/orders/${order.code}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const update = useMutation({
    mutationFn: (payload: UpsertProductionOrderPayload) => {
      if (!editing) throw new Error('Không tìm thấy đơn để sửa')
      return updateProductionOrderApi(editing.code, payload)
    },
    onSuccess: (order) => {
      afterProductionOrderSaved(queryClient, order, editing)
      toast.success(`Đã lưu đơn ${order.code}`)
      setFormOpen(false)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const loadEdit = useMutation({
    mutationFn: (row: ProductionOrderRow) => getProductionOrderApi(row.code),
    onSuccess: (order) => {
      setEditing(order)
      setFormOpen(true)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const del = useDeleteRowDialog<ProductionOrderRow>({
    mutationFn: (row) => deleteProductionOrderApi(row.code),
    successMessage: 'Đã xóa đơn',
    queryKeys: [['production-orders']],
    invalidateKeys: [['production-orders'], ['production-order-lookups']],
    onRemoved: (row) => {
      queryClient.setQueriesData(
        { queryKey: ['production-orders'] },
        (current: ProductionOrderListResponse | undefined) => {
          if (!current?.items) return current
          return {
            ...current,
            items: current.items.filter((item) => item.id !== row.id),
            total: Math.max(0, current.total - 1),
          }
        },
      )
      if (row.source === 'BTP') {
        invalidateBtpStock(queryClient)
        invalidateNvlStock(queryClient)
      }
      if (row.source === 'NVL') invalidateNvlStock(queryClient)
    },
  })

  const requestTypeOptions = useMemo(
    () => REQUEST_TYPES.map((type) => ({ id: type, name: REQUEST_TYPE_META[type].label })),
    [],
  )
  const columns = useMemo(
    () =>
      orderColumns(
        listSource,
        {
          onView: (row) => navigate(`/orders/${row.code}`),
          onEdit: (row) => loadEdit.mutate(row),
          onDelete: (row) => del.request(row),
          loadingEditId: loadEdit.isPending ? (loadEdit.variables?.id ?? null) : null,
          isAdmin,
        },
        {
          search: (
            <ColumnHeaderSearch
              value={params.search}
              onChange={table.setSearch}
              placeholder="Tìm mã SX, mô tả…"
            />
          ),
          requestType: {
            valueId: params.requestType,
            options: requestTypeOptions,
            onChange: (id) => table.setFilter({ requestType: id }),
          },
          receivedDate: (
            <ColumnHeaderDate
              value={params.receivedDate}
              onChange={(value) => table.setFilter({ receivedDate: value })}
            />
          ),
          dueDate: (
            <ColumnHeaderDate
              value={params.dueDate}
              onChange={(value) => table.setFilter({ dueDate: value })}
            />
          ),
        },
      ),
    [
      del.request,
      isAdmin,
      listSource,
      loadEdit.mutate,
      loadEdit.isPending,
      loadEdit.variables,
      navigate,
      params.dueDate,
      params.receivedDate,
      params.requestType,
      params.search,
      requestTypeOptions,
      table.setSearch,
      table.setFilter,
    ],
  )
  const counts = list.data?.statusCounts
  const items = list.data?.items ?? []
  const columnFiltered = Boolean(
    params.requestType || params.search.trim() || params.receivedDate || params.dueDate,
  )
  const narrowed = Boolean(statusTab || columnFiltered)

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: { md: 1 }, minHeight: { md: 0 }, height: { md: '100%' }, overflow: { xs: 'visible', md: 'hidden' } }}
    >
      <PageHeader
        title="Lệnh sản xuất"
        subtitle="Lên đơn, theo dõi trạng thái và in phiếu cho thợ."
        compactSubtitle
      />

      <Tabs
        value={listSource}
        onChange={(_, value: ProductionSource) => table.setFilter({ source: value })}
        sx={{
          flexShrink: 0,
          minHeight: 44,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 44, py: 0, fontWeight: 600 },
        }}
      >
        <Tab value="NVL" label="Đơn mới" />
        <Tab value="BTP" label="Đơn BTP" />
      </Tabs>

      <Tabs
        value={statusTab}
        onChange={(_, value: string) => table.setFilter({ status: value })}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          flexShrink: 0,
          minHeight: 40,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 40, py: 0 },
        }}
      >
        <Tab value="" label={tabLabel('Tất cả', counts?.ALL)} />
        {STATUS_TABS.map((status) => (
          <Tab key={status} value={status} label={<StatusTabLabel status={status} count={counts?.[status]} />} />
        ))}
      </Tabs>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        subRows={{
          get: (row) =>
            statusTab
              ? row.subTickets.filter((sub) => {
                  const subStatus = subTicketListStatus(sub)
                  return subStatus === statusTab || (subStatus == null && row.status === statusTab)
                })
              : row.subTickets,
          key: (sub) => sub.code,
          label: (count) => `${count} phiếu con`,
          autoExpandKey: statusTab || undefined,
        }}
        loading={list.isLoading && !list.data}
        errorText={list.error instanceof Error ? list.error.message : undefined}
        emptyText={
          narrowed
            ? 'Không có đơn khớp bộ lọc.'
            : listSource === 'BTP'
              ? 'Chưa có đơn BTP.'
              : 'Chưa có đơn mới.'
        }
        variant="grid"
        fixedLayout
        minWidth={listSource === 'BTP' ? 1720 : 1600}
        showIndex
        indexOffset={(params.page - 1) * params.pageSize}
        sort={table.sortState}
        onSortChange={table.toggleSort}
        page={params.page}
        pageSize={params.pageSize}
        total={list.data?.total ?? 0}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        rowsLabel="đơn"
        sx={{ flex: { md: 1 } }}
        toolbar={
          <>
            {columnFiltered ? (
              <Button
                size="small"
                onClick={() => {
                  table.setSearch('')
                  table.setFilter({ requestType: '', receivedDate: '', dueDate: '' })
                }}
              >
                Xóa lọc
              </Button>
            ) : null}
            <Box sx={{ flex: 1, minWidth: 8 }} />
            <Button
              variant="contained"
              onClick={() => {
                void queryClient.prefetchQuery({
                  queryKey: ['production-order-lookups'],
                  queryFn: getProductionOrderLookupsApi,
                  staleTime: 5 * 60_000,
                })
                void queryClient.prefetchQuery({
                  queryKey: ['nvl-options'],
                  queryFn: () => listNvlOptionsApi(),
                  staleTime: 60_000,
                })
                void queryClient.prefetchQuery({
                  queryKey: ['finished-product-options'],
                  queryFn: () => listFinishedProductOptionsApi(),
                  staleTime: 60_000,
                })
                if (listSource === 'BTP') {
                  void queryClient.prefetchQuery({
                    queryKey: ['btp-options'],
                    queryFn: () => listBtpOptionsApi(),
                    staleTime: 60_000,
                  })
                }
                setEditing(null)
                setFormOpen(true)
              }}
            >
              {listSource === 'BTP' ? 'Lên đơn BTP' : 'Lên đơn mới'}
            </Button>
          </>
        }
      />

      {formOpen ? (
        <ProductionOrderFormDialog
          open
          order={editing}
          initialSource={listSource}
          lookups={lookups.data}
          saving={editing ? update.isPending : create.isPending}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSave={(payload) => (editing ? update.mutateAsync(payload) : create.mutateAsync(payload))}
        />
      ) : null}
      <ConfirmDeleteDialog
        open={Boolean(del.row)}
        title="Xóa lệnh sản xuất"
        description={
          del.row
            ? `Xóa đơn ${del.row.code}? Ảnh của đơn cũng bị xóa khỏi kho ảnh.`
            : ''
        }
        deleting={del.deleting}
        onClose={del.cancel}
        onConfirm={del.confirm}
      />
    </Stack>
  )
}

function tabLabel(label: string, count: number | undefined) {
  return count == null ? label : `${label} (${count})`
}

function StatusTabLabel({ status, count }: { status: ProductionStatus; count: number | undefined }) {
  const meta = STATUS_META[status]
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: meta.bg, flexShrink: 0 }} />
      <span>{tabLabel(meta.label, count)}</span>
    </Stack>
  )
}

function deleteHint(row: ProductionOrderRow, isAdmin: boolean) {
  if (!isAdmin) return 'Chỉ admin được xóa đơn'
  if (row.status === 'NEW') return 'Xóa'
  if (row.source === 'BTP' && row.status === 'FILING') return 'Xóa'
  return 'Chỉ xóa được đơn mới tạo, chưa giao khâu'
}

function orderColumns(
  source: ProductionSource,
  actions: {
    onView: (row: ProductionOrderRow) => void
    onEdit: (row: ProductionOrderRow) => void
    onDelete: (row: ProductionOrderRow) => void
    /** Đơn đang được tải chi tiết để mở form sửa. */
    loadingEditId: string | null
    isAdmin: boolean
  },
  filters: {
    search: ReactNode
    requestType: {
      valueId: string
      options: Array<{ id: string; name: string }>
      onChange: (id: string) => void
    }
    receivedDate: ReactNode
    dueDate: ReactNode
  },
): Column<ProductionOrderRow, SubTicketSummary>[] {
  const btpSku: Column<ProductionOrderRow, SubTicketSummary> | null =
    source === 'BTP'
      ? {
          key: 'btpSku',
          header: 'Mã BTP',
          width: 120,
          ellipsis: true,
          render: (row) => row.btpSku ?? '—',
        }
      : null

  return [
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      width: 136,
      sortable: true,
      card: 'meta',
      render: (row) => formatDateTime(row.createdAt),
      renderSub: (sub) => formatDateTime(sub.createdAt),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: 220,
      sortable: true,
      card: 'meta',
      render: (row) => <OrderStatus row={row} />,
      renderSub: (sub) => <SubTicketStatus sub={sub} />,
    },
    {
      key: 'code',
      header: 'Mã SX',
      width: 168,
      sortable: true,
      card: 'title',
      cellSx: { fontWeight: 700 },
      filter: filters.search,
      render: (row) =>
        row.subTickets.length ? (
          <>
            {row.code}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
              {row.subTickets.length} phiếu con
            </Typography>
          </>
        ) : (
          row.code
        ),
      renderSub: (sub) => (
        <>
          <Link
            component={RouterLink}
            to={`/tickets/${sub.code}`}
            underline="none"
            color="inherit"
            sx={{ fontWeight: 600 }}
          >
            {sub.code}
          </Link>
          {sub.workerName ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
              thợ {sub.workerName}
            </Typography>
          ) : null}
        </>
      ),
    },
    {
      key: 'btpName',
      header: 'Tên thành phẩm',
      width: 180,
      ellipsis: true,
      render: (row) => row.btpName?.trim() || '—',
    },
    ...(btpSku ? [btpSku] : []),
    {
      key: 'requestType',
      header: 'Yêu cầu làm hàng',
      width: 148,
      filter: <ColumnHeaderFilter {...filters.requestType} />,
      render: (row) => <RequestTypeChip type={row.requestType} />,
    },
    ...(source === 'NVL'
      ? [
          {
            key: 'sizeLabel',
            header: 'Size',
            width: 80,
            ellipsis: true,
            render: (row: ProductionOrderRow) => row.sizeLabel ?? '—',
          } satisfies Column<ProductionOrderRow, SubTicketSummary>,
        ]
      : []),
    {
      key: 'qty',
      header: 'SL cần làm',
      width: 128,
      numeric: true,
      sortable: true,
      render: (row) => `${row.qty}${row.qtyUnit ? ` ${row.qtyUnit}` : ''}`,
      renderSub: (sub, row) => (
        <>
          {sub.qty}
          {row.qtyUnit ? ` ${row.qtyUnit}` : ''}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {formatQty(sub.silverWeight)} g bạc
          </Typography>
        </>
      ),
    },
    { key: 'returnedQty', header: 'Đã trả', width: 68, numeric: true },
    {
      key: 'trackingCode',
      header: 'Mã theo dõi',
      width: 96,
      ellipsis: true,
      render: (row) => row.trackingCode ?? '—',
    },
    { key: 'closedBy', header: 'Người chốt', width: 120, ellipsis: true, sortable: true },
    {
      key: 'description',
      header: 'Mô tả / Yêu cầu sản phẩm',
      width: 260,
      ellipsis: true,
      renderSub: (sub) => sub.note,
    },
    {
      key: 'size',
      header: 'Kích thước',
      width: 120,
      ellipsis: true,
      render: (row) => row.size ?? '—',
    },
    {
      key: 'receivedDate',
      header: 'Ngày đặt đơn',
      width: 148,
      sortable: true,
      filter: filters.receivedDate,
      render: (row) => formatStockedDate(row.receivedDate),
    },
    {
      key: 'dueDate',
      header: 'Ngày cần trả',
      width: 156,
      filter: filters.dueDate,
      render: (row) => <DeadlineCell row={row} />,
    },
    {
      key: 'actions',
      header: 'Hành động',
      width: 120,
      align: 'center',
      card: 'actions',
      cellSx: { overflow: 'visible' },
      render: (row) => (
        <Box onClick={(event) => event.stopPropagation()}>
          <RowActions
            onView={() => actions.onView(row)}
            onEdit={() => actions.onEdit(row)}
            editLoading={actions.loadingEditId === row.id}
            onDelete={() => actions.onDelete(row)}
            deleteDisabled={!actions.isAdmin || !(row.status === 'NEW' || (row.source === 'BTP' && row.status === 'FILING'))}
            titles={{
              view: 'Xem chi tiết',
              edit: 'Chỉnh sửa',
              delete: deleteHint(row, actions.isAdmin),
            }}
          />
        </Box>
      ),
      renderSub: (sub) => (
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <Tooltip title="Xem phiếu con">
            <IconButton size="small" aria-label={`Xem phiếu con ${sub.code}`} component={RouterLink} to={`/tickets/${sub.code}`}>
              <EyeIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ]
}

/**
 * Trạng thái của một phiếu con: khâu đang ở (cùng màu chip với trạng thái đơn ở dòng cha, để
 * dò cột là thấy tiến độ), bên dưới là bước trong khâu — chờ thợ nhận, đang làm, chờ KCS…
 */
function SubTicketStatus({ sub }: { sub: SubTicketSummary }) {
  if (sub.state === 'FINISH') return <StatusChip status="FINISHING" />
  if (sub.state === 'DEFECT') return <StatusChip status="DEFECT" />
  if (!sub.stage) return <SubTicketStateChip state="IDLE" label="Chưa giao khâu" />
  return (
    <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      <StatusChip status={sub.stage} />
      <SubTicketStateChip
        state={sub.state}
        label={sub.state === 'IDLE' ? 'KCS đã nhận lại' : undefined}
      />
    </Stack>
  )
}

function OrderStatus({ row }: { row: ProductionOrderRow }) {
  if (row.subTickets.length) {
    const counts = new Map<ProductionStatus, number>()
    for (const ticket of row.subTickets) {
      const status = subTicketListStatus(ticket)
      if (status) counts.set(status, (counts.get(status) ?? 0) + 1)
    }
    if (counts.size) {
      return (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {STATUS_TABS.filter((status) => counts.has(status)).map((status) => (
            <StatusChip
              key={status}
              status={status}
              label={`${STATUS_META[status].label} · ${counts.get(status)}`}
            />
          ))}
        </Stack>
      )
    }
  }
  const detail =
    row.workState && row.workStage && row.workState !== 'FINISH' && row.workState !== 'DEFECT'
      ? row.workState === 'IDLE'
        ? 'KCS đã nhận lại'
        : SUB_TICKET_STATE_META[row.workState].label
      : null
  return (
    <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      <StatusChip status={row.status} />
      {detail ? (
        <SubTicketStateChip state={row.workState!} label={detail} />
      ) : null}
    </Stack>
  )
}

function subTicketListStatus(sub: SubTicketSummary): ProductionStatus | null {
  if (sub.state === 'FINISH') return 'FINISHING'
  if (sub.state === 'DEFECT') return 'DEFECT'
  return sub.stage
}

const DEADLINE_TONE = {
  overdue: { bg: '#fdecea', fg: '#b3261e', border: '#ef9a9a' },
  today: { bg: '#ffebee', fg: '#b71c1c', border: '#e57373' },
  soon: { bg: '#fff4d6', fg: '#8a6100', border: '#f0c36d' },
} as const

function DeadlineCell({ row }: { row: ProductionOrderRow }) {
  const warning = deadlineWarning(row.dueDate, row.status)
  if (!row.dueDate) return '—'
  const tone = warning ? DEADLINE_TONE[warning.tone] : null
  return (
    <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="body2" sx={{ fontWeight: warning ? 700 : 400, color: tone?.fg }}>
        {formatStockedDate(row.dueDate)}
      </Typography>
      {warning && tone ? (
        <Chip
          size="small"
          label={warning.label}
          sx={{
            height: 22,
            bgcolor: tone.bg,
            color: tone.fg,
            border: '1px solid',
            borderColor: tone.border,
            fontWeight: 700,
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      ) : null}
    </Stack>
  )
}
