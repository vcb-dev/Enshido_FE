import { useMemo, useState } from 'react'
import { Box, Stack, Tab, Tabs } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import {
  createProductionOrderApi,
  deleteProductionOrderApi,
  getProductionOrderApi,
  getProductionOrderLookupsApi,
  listProductionOrdersApi,
  updateProductionOrderApi,
  type ProductionOrderDetail,
  type ProductionOrderListResponse,
  type ProductionOrderRow,
  type ProductionRequestType,
  type ProductionSource,
  type ProductionStatus,
  type UpsertProductionOrderPayload,
} from '../api/productionOrders'
import { formatStockedDate } from '../api/inventory'
import {
  DataTable,
  FILTER_FIELD_SX,
  PageHeader,
  PanelToolbar,
  RowActions,
  SelectInput,
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
} from '../orders/catalog'
import { RequestTypeChip, StatusChip } from '../orders/OrderChips'
import { invalidateBtpStock } from '../orders/btpStock'
import { invalidateNvlStock } from '../orders/nvlStock'
import { afterProductionOrderSaved } from '../orders/orderCache'
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
    filters: { status: '', requestType: '', source: 'NVL' as ProductionSource },
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
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort || undefined,
    dir: params.sort ? params.dir : undefined,
  }

  const list = useQuery({
    queryKey: ['production-orders', listParams],
    queryFn: () => listProductionOrdersApi(listParams),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
  const lookups = useQuery({
    queryKey: ['production-order-lookups'],
    queryFn: getProductionOrderLookupsApi,
    staleTime: 5 * 60_000,
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

  const columns = useMemo(
    () =>
      orderColumns(listSource, {
        onView: (row) => navigate(`/orders/${row.code}`),
        onEdit: (row) => loadEdit.mutate(row),
        onDelete: (row) => del.request(row),
        isAdmin,
      }),
    [del.request, isAdmin, listSource, loadEdit.mutate, navigate],
  )
  const counts = list.data?.statusCounts
  const items = list.data?.items ?? []
  const narrowed = Boolean(statusTab || params.requestType || params.search.trim())

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: { md: 1 }, minHeight: { md: 0 }, height: { md: '100%' }, overflow: { xs: 'visible', md: 'hidden' } }}
    >
      <PageHeader
        title="Đơn sản xuất"
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
          <Tab key={status} value={status} label={tabLabel(STATUS_META[status].label, counts?.[status])} />
        ))}
      </Tabs>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        loading={list.isFetching}
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
        minWidth={listSource === 'BTP' ? 1328 : 1208}
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
          <PanelToolbar
            search={params.search}
            onSearchChange={table.setSearch}
            searchPlaceholder="Tìm mã SX, mã theo dõi, người chốt, mô tả…"
            filters={
              <SelectInput
                label="Yêu cầu làm hàng"
                value={params.requestType}
                onChange={(value) => table.setFilter({ requestType: value })}
                options={REQUEST_TYPES.map((type) => ({ value: type, label: REQUEST_TYPE_META[type].label }))}
                placeholder="Tất cả"
                sx={FILTER_FIELD_SX}
              />
            }
            filterCount={params.requestType ? 1 : 0}
            onClearFilters={() => table.setFilter({ requestType: '' })}
            createLabel={listSource === 'BTP' ? 'Lên đơn BTP' : 'Lên đơn mới'}
            onCreate={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          />
        }
      />

      <ProductionOrderFormDialog
        open={formOpen}
        order={editing}
        initialSource={listSource}
        lookups={lookups.data}
        saving={editing ? update.isPending : create.isPending}
        onClose={() => setFormOpen(false)}
        onExited={() => setEditing(null)}
        onSave={(payload) => (editing ? update.mutateAsync(payload) : create.mutateAsync(payload))}
      />
      <ConfirmDeleteDialog
        open={Boolean(del.row)}
        title="Xóa đơn sản xuất"
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
    isAdmin: boolean
  },
): Column<ProductionOrderRow>[] {
  const btpSku: Column<ProductionOrderRow> | null =
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
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: 116,
      sortable: true,
      card: 'meta',
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      key: 'code',
      header: 'Mã SX',
      width: 76,
      sortable: true,
      card: 'title',
      cellSx: { fontWeight: 700 },
    },
    ...(btpSku ? [btpSku] : []),
    {
      key: 'requestType',
      header: 'Yêu cầu làm hàng',
      width: 124,
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
          } satisfies Column<ProductionOrderRow>,
        ]
      : []),
    {
      key: 'qty',
      header: 'SL cần làm',
      width: 128,
      numeric: true,
      sortable: true,
      render: (row) => `${row.qty}${row.qtyUnit ? ` ${row.qtyUnit}` : ''}`,
    },
    { key: 'returnedQty', header: 'Đã trả', width: 68, numeric: true },
    {
      key: 'leadTime',
      header: 'Thời gian cần',
      width: 104,
      ellipsis: true,
      render: (row) => row.leadTime ?? '—',
    },
    {
      key: 'trackingCode',
      header: 'Mã theo dõi',
      width: 96,
      ellipsis: true,
      render: (row) => row.trackingCode ?? '—',
    },
    { key: 'closedBy', header: 'Người chốt', width: 120, ellipsis: true, sortable: true },
    { key: 'description', header: 'Mô tả / Yêu cầu sản phẩm', width: 260, ellipsis: true },
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
      width: 108,
      sortable: true,
      render: (row) => formatStockedDate(row.receivedDate),
    },
    {
      key: 'dueDate',
      header: 'Ngày cần trả',
      width: 108,
      render: (row) => formatStockedDate(row.dueDate),
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
    },
  ]
}
