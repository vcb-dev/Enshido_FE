import { useMemo, useState, type ReactNode } from 'react'
import { Box, Button, Link, ListItemText, Menu, MenuItem, Stack, Tab, Tabs, Tooltip } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  createProductionOrderApi,
  getProductionOrderLookupsApi,
  listProductionOrdersApi,
  type ProductionOrderRow,
  type ProductionRequestType,
  type ProductionSource,
  type ProductionStatus,
  type UpsertProductionOrderPayload,
} from '../api/productionOrders'
import { formatStockedDate } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import {
  ColumnHeaderFilter,
  ColumnHeaderSearch,
  DataTable,
  PageHeader,
  type Column,
  type ColumnFilterOption,
} from '../components/ui'
import { useTableParams } from '../hooks/useTableParams'
import {
  formatDateTime,
  REQUEST_TYPES,
  REQUEST_TYPE_META,
  SOURCE_HINT,
  SOURCE_META,
  SOURCES,
  STATUS_META,
  STATUS_TABS,
} from '../orders/catalog'
import { RequestTypeChip, SourceChip, StatusChip } from '../orders/OrderChips'
import { invalidateBtpStock } from '../orders/btpStock'
import { ProductionOrderFormDialog } from '../orders/ProductionOrderFormDialog'

export function ProductionOrdersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  // Giữ loại đơn sau khi đóng để form không nhảy loại trong lúc dialog đang mờ dần.
  const [createSource, setCreateSource] = useState<ProductionSource>('NVL')
  const [createMenu, setCreateMenu] = useState<HTMLElement | null>(null)
  const table = useTableParams({
    pageSize: 25,
    filters: { status: '', requestType: '', source: '' },
  })
  const { params, setFilter, setSearch } = table

  const listParams = {
    status: params.status as ProductionStatus | '',
    requestType: params.requestType as ProductionRequestType | '',
    source: params.source as ProductionSource | '',
    search: params.search,
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
      if (order.source === 'BTP') invalidateBtpStock(queryClient)
      navigate(`/orders/${order.code}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo(
    () =>
      orderColumns({
        search: (
          <ColumnHeaderSearch
            value={params.search}
            onChange={setSearch}
            placeholder="Tìm mã, mô tả…"
          />
        ),
        source: (
          <ColumnHeaderFilter
            valueId={params.source}
            options={SOURCE_OPTIONS}
            onChange={(id) => setFilter({ source: id })}
          />
        ),
        requestType: (
          <ColumnHeaderFilter
            valueId={params.requestType}
            options={REQUEST_TYPE_OPTIONS}
            onChange={(id) => setFilter({ requestType: id })}
          />
        ),
      }),
    [params.requestType, params.search, params.source, setFilter, setSearch],
  )
  const counts = list.data?.statusCounts
  const items = list.data?.items ?? []
  // Tab trạng thái không tính là bộ lọc cột — "Xóa lọc" giữ nguyên tab đang xem.
  const columnFiltered = Boolean(params.source || params.requestType || params.search.trim())

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
        minWidth={1722}
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
          <>
            {columnFiltered ? (
              <Button
                size="small"
                onClick={() => setFilter({ source: '', requestType: '', search: '' })}
              >
                Xóa lọc
              </Button>
            ) : null}
            <Box sx={{ flex: 1, minWidth: 8 }} />
            <Button
              variant="contained"
              endIcon={<ArrowDropDownIcon />}
              onClick={(event) => setCreateMenu(event.currentTarget)}
            >
              Lên đơn
            </Button>
          </>
        }
      />

      <Menu
        anchorEl={createMenu}
        open={Boolean(createMenu)}
        onClose={() => setCreateMenu(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {CREATE_SOURCES.map((source) => (
          <MenuItem
            key={source}
            onClick={() => {
              setCreateMenu(null)
              setCreateSource(source)
              setCreating(true)
            }}
          >
            <ListItemText primary={SOURCE_META[source].label} secondary={SOURCE_HINT[source]} />
          </MenuItem>
        ))}
      </Menu>

      <ProductionOrderFormDialog
        open={creating}
        order={null}
        initialSource={createSource}
        lookups={lookups.data}
        saving={create.isPending}
        onClose={() => setCreating(false)}
        onSave={(payload) => create.mutate(payload)}
      />
    </Stack>
  )
}

const CREATE_SOURCES: ProductionSource[] = ['BTP', 'NVL']

const SOURCE_OPTIONS: ColumnFilterOption[] = SOURCES.map((source) => ({
  id: source,
  name: SOURCE_META[source].label,
}))

const REQUEST_TYPE_OPTIONS: ColumnFilterOption[] = REQUEST_TYPES.map((type) => ({
  id: type,
  name: REQUEST_TYPE_META[type].label,
}))

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

/** Ô lọc đặt trên hàng filter, ngay dưới tên cột — giống các màn tồn kho. */
type ColumnFilters = { search: ReactNode; source: ReactNode; requestType: ReactNode }

function orderColumns(filters: ColumnFilters): Column<ProductionOrderRow>[] {
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
      width: 132,
      sortable: true,
      card: 'title',
      cellSx: { fontWeight: 700 },
      filter: filters.search,
    },
    {
      key: 'source',
      header: 'Loại đơn',
      width: 150,
      filter: filters.source,
      // Chip giữ nguyên bề ngang, mã BTP dài thì cắt bớt — không cho tràn sang cột bên cạnh.
      cellSx: { overflow: 'hidden' },
      render: (row) => (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Box sx={{ display: 'flex', flexShrink: 0 }}>
            <SourceChip source={row.source} />
          </Box>
          {row.btpSku ? (
            <Box
              component="span"
              sx={{
                fontSize: 12,
                color: 'text.secondary',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.btpSku}
            </Box>
          ) : null}
        </Stack>
      ),
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
      width: 140,
      filter: filters.requestType,
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
