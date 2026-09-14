import { useMemo, useState } from 'react'
import { Box, Link, Stack, Tab, Tabs, Tooltip } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  createProductionOrderApi,
  getProductionOrderLookupsApi,
  listProductionOrdersApi,
  type ProductionOrderRow,
  type ProductionRequestType,
  type ProductionStatus,
  type UpsertProductionOrderPayload,
} from '../api/productionOrders'
import { formatStockedDate } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import {
  DataTable,
  FILTER_FIELD_SX,
  PageHeader,
  PanelToolbar,
  SelectInput,
  type Column,
} from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useTableParams } from '../hooks/useTableParams'
import { formatDateTime, REQUEST_TYPES, REQUEST_TYPE_META, STATUS_META, STATUS_TABS } from '../orders/catalog'
import { RequestTypeChip, StatusChip } from '../orders/OrderChips'
import { ProductionOrderFormDialog } from '../orders/ProductionOrderFormDialog'

export function ProductionOrdersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const table = useTableParams({
    pageSize: 25,
    filters: { status: '', requestType: '' },
  })
  const { params } = table
  const search = useDebouncedValue(params.search, 300)

  const listParams = {
    status: params.status as ProductionStatus | '',
    requestType: params.requestType as ProductionRequestType | '',
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
    onSuccess: async (order) => {
      toast.success(`Đã lên đơn ${order.code}`)
      setCreating(false)
      await queryClient.invalidateQueries({ queryKey: ['production-orders'] })
      await queryClient.invalidateQueries({ queryKey: ['production-order-lookups'] })
      navigate(`/orders/${order.code}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo(() => orderColumns(), [])
  const counts = list.data?.statusCounts
  const items = list.data?.items ?? []

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
        value={params.status}
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
        emptyText={table.hasFilters ? 'Không có đơn khớp bộ lọc.' : 'Chưa có đơn sản xuất.'}
        variant="grid"
        fixedLayout
        minWidth={1500}
        showIndex
        indexOffset={(params.page - 1) * params.pageSize}
        onRowClick={(row) => navigate(`/orders/${row.code}`)}
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
            searchPlaceholder="Tìm mã SX, mã theo dõi, mã 3D, người chốt, mô tả…"
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
            createLabel="Lên đơn"
            onCreate={() => setCreating(true)}
          />
        }
      />

      <ProductionOrderFormDialog
        open={creating}
        order={null}
        lookups={lookups.data}
        saving={create.isPending}
        onClose={() => setCreating(false)}
        onSave={(payload) => create.mutate(payload)}
      />
    </Stack>
  )
}

function tabLabel(label: string, count: number | undefined) {
  return count == null ? label : `${label} (${count})`
}

function Thumbs({ images }: { images: ProductionOrderRow['images'] }) {
  if (images.length === 0) return <>—</>
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      {images.slice(0, 2).map((image) => (
        <Box
          key={image.id}
          component="img"
          src={cloudinaryThumb(image.url, 64)}
          alt=""
          loading="lazy"
          sx={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 0.5, border: '1px solid #d5dbe0' }}
        />
      ))}
      {images.length > 2 ? (
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
          +{images.length - 2}
        </Box>
      ) : null}
    </Stack>
  )
}

function orderColumns(): Column<ProductionOrderRow>[] {
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
    {
      key: 'detailImages',
      header: 'Ảnh chi tiết đơn',
      width: 104,
      render: (row) => <Thumbs images={row.images.filter((image) => image.kind === 'DETAIL')} />,
    },
    {
      key: 'productImages',
      header: 'Ảnh sản phẩm',
      width: 104,
      render: (row) => <Thumbs images={row.images.filter((image) => image.kind === 'PRODUCT')} />,
    },
    {
      key: 'requestType',
      header: 'Yêu cầu làm hàng',
      width: 124,
      render: (row) => <RequestTypeChip type={row.requestType} />,
    },
    { key: 'qty', header: 'Số lượng', width: 80, numeric: true, sortable: true },
    { key: 'returnedQty', header: 'Đã trả', width: 68, numeric: true },
    {
      key: 'model3dCode',
      header: 'Mã 3D',
      width: 116,
      ellipsis: true,
      render: (row) => row.model3dCode ?? '—',
    },
    {
      key: 'model3dUrl',
      header: 'Link 3D',
      width: 90,
      render: (row) =>
        row.model3dUrl ? (
          <Tooltip title={row.model3dUrl}>
            <Link
              href={row.model3dUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              Mở link
            </Link>
          </Tooltip>
        ) : (
          '—'
        ),
    },
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
  ]
}
