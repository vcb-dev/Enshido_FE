import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Link, Stack, Tab, Tabs, Tooltip } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  createShipmentApi,
  getFinishedGoodsLookupsApi,
  getFinishedGoodsStockApi,
  listShipmentsApi,
  type FinishedGoodsStockRow,
  type ShipmentListRow,
  type ShipmentPayload,
} from '../api/finishedGoods'
import { formatMoney, formatStockedDate } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import { DataTable, PageHeader, PanelToolbar, type Column } from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { paginate, sortRows, useTableParams } from '../hooks/useTableParams'
import { ShipmentFormDialog } from '../finishedGoods/ShipmentFormDialog'
import { formatDateTime } from '../orders/catalog'

type TabCode = 'stock' | 'shipments'

export function FinishedGoodsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: TabCode = searchParams.get('tab') === 'shipments' ? 'shipments' : 'stock'
  const table = useTableParams({ pageSize: 25 })
  const { params } = table
  const search = useDebouncedValue(params.search, 300)
  const [creating, setCreating] = useState<{ orderCode: string | null } | null>(null)

  const stock = useQuery({
    queryKey: ['finished-goods-stock'],
    queryFn: () => getFinishedGoodsStockApi(),
    staleTime: 15_000,
  })
  const shipments = useQuery({
    queryKey: ['finished-goods-shipments', search, params.page, params.pageSize],
    queryFn: () => listShipmentsApi({ search, page: params.page, pageSize: params.pageSize }),
    enabled: tab === 'shipments',
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
  const lookups = useQuery({
    queryKey: ['finished-goods-lookups'],
    queryFn: getFinishedGoodsLookupsApi,
    staleTime: 5 * 60_000,
  })

  // "Lập phiếu xuất hàng" từ trang đơn: /finished-goods?create=A001
  const createParam = searchParams.get('create')
  useEffect(() => {
    if (!createParam) return
    setCreating({ orderCode: createParam })
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('create')
        return next
      },
      { replace: true },
    )
  }, [createParam, setSearchParams])

  const create = useMutation({
    mutationFn: (payload: ShipmentPayload) => createShipmentApi(payload),
    onSuccess: async (shipment) => {
      toast.success(`Đã lập phiếu xuất ${shipment.code}`)
      setCreating(null)
      await Promise.all(
        [['finished-goods-stock'], ['finished-goods-shipments'], ['finished-goods-lookups'], ['production-orders'], ['production-order']].map(
          (queryKey) => queryClient.invalidateQueries({ queryKey }),
        ),
      )
      navigate(`/finished-goods/shipments/${shipment.code}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const stockItems = useMemo(() => stock.data?.items ?? [], [stock.data?.items])
  const stockRows = useMemo(() => {
    const keyword = params.search.trim().toLowerCase()
    if (!keyword) return stockItems
    return stockItems.filter((row) =>
      [row.orderCode, row.description].some((field) => field.toLowerCase().includes(keyword)),
    )
  }, [stockItems, params.search])

  const stockColumns = useMemo(() => stockTableColumns((orderCode) => setCreating({ orderCode })), [])
  const shipmentColumns = useMemo(() => shipmentTableColumns(), [])

  const totalValue = stockItems.reduce((sum, row) => sum + Number(row.stockValue), 0)
  const totalQty = stockItems.reduce((sum, row) => sum + row.remainingQty, 0)

  function switchTab(next: TabCode) {
    table.reset()
    setSearchParams(next === 'stock' ? {} : { tab: next }, { replace: true })
  }

  const toolbar = (
    <PanelToolbar
      search={params.search}
      onSearchChange={table.setSearch}
      searchPlaceholder={tab === 'stock' ? 'Tìm mã SX, mô tả…' : 'Tìm mã phiếu, khách hàng, mã SX…'}
      createLabel="Lập phiếu xuất"
      onCreate={() => setCreating({ orderCode: null })}
    />
  )

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: { md: 1 }, minHeight: { md: 0 }, height: { md: '100%' }, overflow: { xs: 'visible', md: 'hidden' } }}
    >
      <PageHeader
        title="Kho thành phẩm"
        subtitle={`Đơn tự vào kho khi KCS nhận lại khâu Ngoại Quan. Đang tồn ${totalQty} sản phẩm · giá trị ${formatMoney(String(Math.round(totalValue)))} đ.`}
        compactSubtitle
      />

      <Tabs
        value={tab}
        onChange={(_, value: TabCode) => switchTab(value)}
        sx={{ flexShrink: 0, minHeight: 40, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { minHeight: 40, py: 0 } }}
      >
        <Tab value="stock" label={`Tồn kho (${stockItems.length})`} />
        <Tab value="shipments" label={`Phiếu xuất hàng${shipments.data ? ` (${shipments.data.total})` : ''}`} />
      </Tabs>

      {tab === 'stock' ? (
        <DataTable
          columns={stockColumns}
          rows={paginate(sortRows(stockRows, params.sort, params.dir), params.page, params.pageSize)}
          rowKey={(row) => row.orderCode}
          loading={stock.isFetching}
          errorText={stock.error instanceof Error ? stock.error.message : undefined}
          emptyText="Kho thành phẩm đang trống."
          variant="grid"
          fixedLayout
          minWidth={1180}
          showIndex
          indexOffset={(params.page - 1) * params.pageSize}
          sort={table.sortState}
          onSortChange={table.toggleSort}
          page={params.page}
          pageSize={params.pageSize}
          total={stockRows.length}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          rowsLabel="đơn"
          sx={{ flex: { md: 1 } }}
          toolbar={toolbar}
        />
      ) : (
        <DataTable
          columns={shipmentColumns}
          rows={shipments.data?.items ?? []}
          rowKey={(row) => row.code}
          loading={shipments.isFetching}
          errorText={shipments.error instanceof Error ? shipments.error.message : undefined}
          emptyText="Chưa có phiếu xuất hàng."
          variant="grid"
          fixedLayout
          minWidth={1100}
          showIndex
          indexOffset={(params.page - 1) * params.pageSize}
          onRowClick={(row) => navigate(`/finished-goods/shipments/${row.code}`)}
          page={params.page}
          pageSize={params.pageSize}
          total={shipments.data?.total ?? 0}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          rowsLabel="phiếu"
          sx={{ flex: { md: 1 } }}
          toolbar={toolbar}
        />
      )}

      {stock.data && stockItems.some((row) => row.costWarnings > 0) && tab === 'stock' ? (
        <Alert severity="warning" sx={{ flexShrink: 0 }}>
          Một số đơn có cảnh báo chi phí (thiếu phiếu xuất bạc gắn đơn…) — mở đơn để xem.
        </Alert>
      ) : null}

      <ShipmentFormDialog
        open={creating != null}
        shipment={null}
        stock={stockItems}
        customers={lookups.data?.customers ?? []}
        paymentMethods={lookups.data?.paymentMethods ?? []}
        initialOrderCode={creating?.orderCode}
        saving={create.isPending}
        onClose={() => setCreating(null)}
        onSave={(payload) => create.mutate(payload)}
      />
    </Stack>
  )
}

function stockTableColumns(onShip: (orderCode: string) => void): Column<FinishedGoodsStockRow>[] {
  return [
    {
      key: 'orderCode',
      header: 'Mã SX',
      width: 80,
      sortable: true,
      card: 'title',
      render: (row) => (
        <Link component={RouterLink} to={`/orders/${row.orderCode}`} sx={{ fontWeight: 700 }}>
          {row.orderCode}
        </Link>
      ),
    },
    {
      key: 'image',
      header: 'Ảnh',
      width: 60,
      render: (row) =>
        row.imageUrl ? (
          <Box
            component="img"
            src={cloudinaryThumb(row.imageUrl, 64)}
            alt=""
            loading="lazy"
            sx={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 0.5, border: '1px solid #d5dbe0' }}
          />
        ) : (
          '—'
        ),
    },
    { key: 'description', header: 'Sản phẩm', width: 260, ellipsis: true },
    { key: 'sizeLabel', header: 'Size', width: 70, render: (row) => row.sizeLabel ?? '—' },
    { key: 'mainMaterial', header: 'Chất liệu', width: 90, render: (row) => row.mainMaterial ?? '—' },
    {
      key: 'receivedAt',
      header: 'Nhập kho',
      width: 136,
      sortable: true,
      render: (row) => formatDateTime(row.receivedAt),
    },
    { key: 'receivedQty', header: 'SL nhập', width: 76, numeric: true },
    { key: 'shippedQty', header: 'Đã xuất', width: 76, numeric: true },
    { key: 'remainingQty', header: 'Còn', width: 70, numeric: true, sortable: true, cellSx: { fontWeight: 700 } },
    {
      key: 'unitCost',
      header: 'Giá vốn / SP',
      width: 110,
      numeric: true,
      render: (row) =>
        row.costWarnings > 0 ? (
          <Tooltip title="Chi phí có cảnh báo — mở đơn để xem">
            <span>{formatMoney(row.unitCost)} ⚠</span>
          </Tooltip>
        ) : (
          formatMoney(row.unitCost)
        ),
    },
    { key: 'stockValue', header: 'Giá trị tồn', width: 116, numeric: true, render: (row) => formatMoney(row.stockValue) },
    {
      key: 'actions',
      header: '',
      width: 96,
      card: 'actions',
      align: 'center',
      render: (row) => (
        <Button size="small" variant="outlined" onClick={() => onShip(row.orderCode)}>
          Xuất hàng
        </Button>
      ),
    },
  ]
}

function shipmentTableColumns(): Column<ShipmentListRow>[] {
  return [
    { key: 'code', header: 'Mã phiếu', width: 90, card: 'title', cellSx: { fontWeight: 700 } },
    { key: 'shippedAt', header: 'Ngày xuất', width: 100, card: 'meta', render: (row) => formatStockedDate(row.shippedAt) },
    { key: 'customerName', header: 'Khách hàng', width: 180, ellipsis: true },
    { key: 'paymentMethod', header: 'Thanh toán', width: 110, render: (row) => row.paymentMethod ?? '—' },
    { key: 'orderCodes', header: 'Mã SX', width: 150, ellipsis: true, render: (row) => row.orderCodes.join(', ') },
    { key: 'qty', header: 'SL', width: 60, numeric: true },
    { key: 'amount', header: 'Thành tiền', width: 120, numeric: true, cellSx: { fontWeight: 700 }, render: (row) => formatMoney(row.amount) },
    { key: 'costAmount', header: 'Chi phí', width: 120, numeric: true, render: (row) => formatMoney(row.costAmount) },
    { key: 'createdByName', header: 'Người lập', width: 120, ellipsis: true },
  ]
}
