import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Box, Button, Chip, Link, Paper, Stack, Typography } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  createFinishedGoodsReceiptApi,
  createShipmentApi,
  FG_FLOW_STATUS,
  fgFlowStatus,
  getFinishedGoodsLookupsApi,
  getFinishedGoodsStockApi,
  getShipmentApi,
  listAllShipmentsApi,
  listFinishedGoodsReceiptsApi,
  receiveFinishedGoodsReceiptApi,
  updateFinishedGoodsReceiptApi,
  updateShipmentApi,
  type FgFlowStatus,
  type FinishedGoodsReceiptRow,
  type FinishedGoodsStockRow,
  type ShipmentListRow,
  type ShipmentPayload,
  type UpsertReceiptPayload,
} from '../api/finishedGoods'
import {
  formatMoney,
  formatQty,
  formatStockedDate,
  stockStatusFromQty,
  type AvailabilityCode,
  type StockTotals,
} from '../api/inventory'
import {
  ColumnHeaderFilter,
  ColumnHeaderSearch,
  DataTable,
  PageHeader,
  RowActions,
  type Column,
  type ColumnGroup,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { paginate, sortRows, useTableParams } from '../hooks/useTableParams'
import { ShipmentFormDialog } from '../finishedGoods/ShipmentFormDialog'
import { ReceiveFormDialog } from '../finishedGoods/ReceiveFormDialog'
import { ReceiveStockDialog } from '../finishedGoods/ReceiveStockDialog'
import { FinishedGoodsStockDialog } from '../finishedGoods/StockFormDialog'
import { StockFigureGrid } from '../warehouses/StockFigureGrid'
import { THANH_PHAM_WAREHOUSE, stockProfile, warehouseByCode, type WarehouseSectionCode } from '../warehouses/catalog'
import { headerTotal, uniqueFilterOptions } from '../warehouses/stockFilters'

type TabCode = 'stock' | 'inbound' | 'outbound'

type OutboundMoveRow = {
  id: string
  shipmentCode: string
  shippedAt: string
  sku: string
  name: string
  qty: string
  unitPrice: string
  amount: string
  note: string | null
  issuedBy: string
  receivedBy: string
  autoIssued: boolean
}

const numCell = { fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const }
const split = { borderLeft: '2px solid #6b4513' }
const groupHead = {
  open: { ...split, bgcolor: '#f3eee6', fontWeight: 700 },
  in: { ...split, bgcolor: '#e4f0e8', fontWeight: 700 },
  out: { ...split, bgcolor: '#f3ebe7', fontWeight: 700 },
  stock: { ...split, bgcolor: '#e8d8bd', fontWeight: 700, color: 'primary.main' },
}
const STOCK_GROUPS = {
  open: { key: 'open', label: 'Tồn đầu kỳ', headSx: groupHead.open },
  in: { key: 'in', label: 'Nhập', headSx: groupHead.in },
  out: { key: 'out', label: 'Xuất', headSx: groupHead.out },
  stock: { key: 'stock', label: 'Tồn', headSx: groupHead.stock },
} satisfies Record<string, ColumnGroup>
const groupBody = {
  open: { ...split, ...numCell, bgcolor: '#fbf8f3' },
  in: { ...split, ...numCell, bgcolor: '#f2f8f4' },
  out: { ...split, ...numCell, bgcolor: '#faf6f4' },
  stock: { ...split, ...numCell, bgcolor: '#f1e6d5', fontWeight: 700 },
}

const STATUS_FILTERS: { value: 'ALL' | AvailabilityCode; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'IN_STOCK', label: 'Còn' },
  { value: 'LOW', label: 'Sắp hết hàng' },
  { value: 'OUT_OF_STOCK', label: 'Hết hàng' },
]

const FLOW_STATUS_FILTERS: { value: 'ALL' | FgFlowStatus; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'WAITING_IN', label: FG_FLOW_STATUS.WAITING_IN.label },
  { value: 'RECEIVED', label: FG_FLOW_STATUS.RECEIVED.label },
  { value: 'WAITING_OUT', label: FG_FLOW_STATUS.WAITING_OUT.label },
  { value: 'SHIPPED', label: FG_FLOW_STATUS.SHIPPED.label },
]

export function FinishedGoodsPage({
  section,
  hideHeader = false,
}: {
  section?: WarehouseSectionCode
  hideHeader?: boolean
} = {}) {
  const tab: TabCode = section ?? 'stock'
  const warehouse = warehouseByCode(THANH_PHAM_WAREHOUSE)

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: { md: 1 }, minHeight: { md: 0 }, height: { md: '100%' }, overflow: { xs: 'visible', md: 'hidden' } }}
    >
      {hideHeader ? null : (
        <PageHeader title={warehouse?.name ?? 'Kho thành phẩm'} subtitle={warehouse?.description} compactSubtitle />
      )}
      {tab === 'stock' ? (
        <FinishedGoodsStockTable />
      ) : tab === 'inbound' ? (
        <FinishedGoodsInboundTable />
      ) : (
        <FinishedGoodsOutboundTable />
      )}
    </Stack>
  )
}

function FinishedGoodsStockTable() {
  const queryClient = useQueryClient()
  const profile = stockProfile(THANH_PHAM_WAREHOUSE)
  const dialog = useCrudDialog<FinishedGoodsStockRow>()
  const table = useTableParams({ pageSize: 8, filters: { unit: '', status: 'ALL', flowStatus: 'ALL' } })
  const { params } = table

  const stock = useQuery({
    queryKey: ['finished-goods-stock'],
    queryFn: () => getFinishedGoodsStockApi(),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  const items = useMemo(() => stock.data?.items ?? [], [stock.data?.items])
  const statusCounts = useMemo(() => {
    const counts = { IN_STOCK: 0, LOW: 0, OUT_OF_STOCK: 0 }
    for (const row of items) counts[row.availability] += 1
    return counts
  }, [items])
  const flowCounts = useMemo(() => {
    const counts: Record<FgFlowStatus, number> = {
      WAITING_IN: 0,
      RECEIVED: 0,
      WAITING_OUT: 0,
      SHIPPED: 0,
    }
    for (const row of items) counts[fgFlowStatus(row)] += 1
    return counts
  }, [items])
  const unitOptions = useMemo(
    () => uniqueFilterOptions(items.map((row) => row.qtyUnit)),
    [items],
  )
  const statusFilterOptions = useMemo(
    () =>
      STATUS_FILTERS.filter(
        (option): option is { value: AvailabilityCode; label: string } => option.value !== 'ALL',
      ).map((option) => ({
        id: option.value,
        name: `${option.label} (${statusCounts[option.value]})`,
      })),
    [statusCounts],
  )
  const flowFilterOptions = useMemo(
    () =>
      FLOW_STATUS_FILTERS.filter(
        (option): option is { value: FgFlowStatus; label: string } => option.value !== 'ALL',
      ).map((option) => ({
        id: option.value,
        name: `${option.label} (${flowCounts[option.value]})`,
      })),
    [flowCounts],
  )

  const visible = useMemo(() => {
    const nameQuery = params.search.trim().toLocaleLowerCase('vi')
    return items.filter((row) => {
      if (
        nameQuery &&
        !row.description.toLocaleLowerCase('vi').includes(nameQuery) &&
        !row.orderCode.toLocaleLowerCase('vi').includes(nameQuery) &&
        !(row.bomLines ?? []).some(
          (line) =>
            (line.sku ?? '').toLocaleLowerCase('vi').includes(nameQuery) ||
            line.name.toLocaleLowerCase('vi').includes(nameQuery),
        )
      ) {
        return false
      }
      if (params.unit && (row.qtyUnit ?? '') !== params.unit) return false
      if (params.status !== 'ALL' && row.availability !== params.status) return false
      if (params.flowStatus !== 'ALL' && fgFlowStatus(row) !== params.flowStatus) return false
      return true
    })
  }, [items, params.flowStatus, params.search, params.status, params.unit])

  const filtered = Boolean(
    params.search.trim() || params.unit || params.status !== 'ALL' || params.flowStatus !== 'ALL',
  )
  const totals = filtered ? sumStockTotals(visible) : stock.data?.totals
  const pageCount = Math.max(1, Math.ceil(visible.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize

  const columns = useMemo(
    () =>
      stockColumns(
        totals,
        {
          name: <ColumnHeaderSearch value={params.search} onChange={table.setSearch} placeholder="Tìm tên…" />,
          unit: { valueId: params.unit, options: unitOptions, onChange: (id) => table.setFilter({ unit: id }) },
          status: {
            valueId: params.status === 'ALL' ? '' : params.status,
            options: statusFilterOptions,
            onChange: (id) => table.setFilter({ status: id || 'ALL' }),
          },
          flowStatus: {
            valueId: params.flowStatus === 'ALL' ? '' : params.flowStatus,
            options: flowFilterOptions,
            onChange: (id) => table.setFilter({ flowStatus: id || 'ALL' }),
          },
        },
        {
          onView: dialog.openView,
          onEdit: dialog.openEdit,
        },
      ),
    [dialog.openEdit, dialog.openView, flowFilterOptions, params.flowStatus, params.search, params.status, params.unit, statusFilterOptions, table, totals, unitOptions],
  )

  const save = useMutation({
    mutationFn: (input: { id?: string; payload: UpsertReceiptPayload }) =>
      input.id
        ? updateFinishedGoodsReceiptApi(input.id, input.payload)
        : createFinishedGoodsReceiptApi(input.payload),
    onMutate: (input) => {
      dialog.close()
      toast.success(input.id ? 'Đã cập nhật thành phẩm' : 'Đã nhập thành phẩm vào kho')
      if (!input.id) table.setPage(1)
      const previous = patchFinishedGoodsCaches(queryClient, input)
      return { previous }
    },
    onSuccess: (_data, input) => {
      refreshFinishedGoodsQueries(queryClient, { refetch: !input.id })
    },
    onError: (error: Error, _input, ctx) => {
      ctx?.previous?.rollback()
      toast.error(error.message)
    },
  })

  return (
    <Stack spacing={1.25} sx={{ flex: { md: 1 }, minHeight: { md: 0 }, overflow: { xs: 'visible', md: 'hidden' } }}>
      <DataTable
        columns={columns}
        rows={paginate(visible, page, params.pageSize)}
        rowKey={(row) => row.orderCode}
        loading={stock.isLoading}
        errorText={stock.error instanceof Error ? stock.error.message : undefined}
        emptyText={filtered ? profile.emptyFiltered : profile.emptyText}
        variant="grid"
        minWidth={2520}
        cardBreakpoint="md"
        showIndex
        indexOffset={indexOffset}
        rowsLabel={profile.noun}
        page={page}
        pageSize={params.pageSize}
        total={visible.length}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sx={{ flex: { md: 1 } }}
        renderCard={(row, index) => (
          <StockCard
            row={row}
            index={indexOffset + index + 1}
            onView={() => dialog.openView(row)}
            onEdit={() => dialog.openEdit(row)}
          />
        )}
        toolbar={
          <>
            {filtered ? (
              <Button size="small" onClick={table.reset}>
                Xóa lọc
              </Button>
            ) : null}
            <Box sx={{ flex: 1, minWidth: 8 }} />
            <Button variant="contained" onClick={dialog.openCreate}>
              {profile.createLabel}
            </Button>
          </>
        }
      />
      <FinishedGoodsStockDialog
        open={dialog.open}
        kind={dialog.kind}
        row={dialog.row}
        nameSuggestions={items.map((item) => item.description).filter(Boolean)}
        saving={save.isPending}
        onClose={dialog.close}
        onSaved={(payload) => save.mutate({ id: dialog.row?.id, payload })}
      />
    </Stack>
  )
}

function FinishedGoodsInboundTable() {
  const queryClient = useQueryClient()
  const profile = stockProfile(THANH_PHAM_WAREHOUSE)
  const dialog = useCrudDialog<FinishedGoodsReceiptRow>()
  const table = useTableParams({ pageSize: 8, filters: { enteredBy: '' } })
  const { params } = table

  const receipts = useQuery({
    queryKey: ['finished-goods-receipts'],
    queryFn: () => listFinishedGoodsReceiptsApi(),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  const items = useMemo(() => receipts.data?.items ?? [], [receipts.data?.items])
  const enteredByOptions = useMemo(
    () => uniqueFilterOptions(items.map((row) => row.receivedByName)),
    [items],
  )

  const rows = useMemo(() => {
    const nameQuery = params.search.trim().toLocaleLowerCase('vi')
    return items.filter((row) => {
      if (
        nameQuery &&
        !row.description.toLocaleLowerCase('vi').includes(nameQuery) &&
        !row.orderCode.toLocaleLowerCase('vi').includes(nameQuery)
      ) {
        return false
      }
      if (params.enteredBy && row.receivedByName !== params.enteredBy) return false
      return true
    })
  }, [items, params.enteredBy, params.search])

  const filtering = Boolean(params.search.trim() || params.enteredBy)
  const totals = sumMoveTotals(rows)
  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize

  // Kho đếm hàng rồi mới nhập, nên nút mở hộp thoại nhập số lượng thay vì nhận thẳng.
  const [receiving, setReceiving] = useState<FinishedGoodsReceiptRow | null>(null)
  const receive = useMutation({
    mutationFn: ({ row, qty }: { row: FinishedGoodsReceiptRow; qty: number }) =>
      receiveFinishedGoodsReceiptApi(row.id, qty),
    onSuccess: async (_result, { row, qty }) => {
      setReceiving(null)
      toast.success(`Đã nhập ${formatQty(String(qty))} ${row.qtyUnit ?? 'sản phẩm'} vào tồn`)
      await Promise.all(
        [
          ['finished-goods-stock'],
          ['finished-goods-receipts'],
          ['finished-goods-order-options'],
          ['finished-product-options'],
          ['production-orders'],
          ['production-order', row.orderCode],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo(
    () => inboundColumns(totals, {
      search: params.search,
      onSearch: table.setSearch,
      enteredBy: params.enteredBy,
      enteredByOptions,
      onEnteredBy: (id) => table.setFilter({ enteredBy: id }),
      onView: dialog.openView,
      onEdit: dialog.openEdit,
      onReceive: (row) => setReceiving(row),
      receivingId: receive.isPending ? (receive.variables?.row.id ?? null) : null,
    }),
    [dialog.openEdit, dialog.openView, enteredByOptions, params.enteredBy, params.search, receive.isPending, receive.variables, table, totals],
  )

  const save = useMutation({
    mutationFn: (input: { id?: string; payload: UpsertReceiptPayload }) =>
      input.id
        ? updateFinishedGoodsReceiptApi(input.id, input.payload)
        : createFinishedGoodsReceiptApi(input.payload),
    onMutate: (input) => {
      dialog.close()
      toast.success(input.id ? 'Đã cập nhật phiếu nhập' : 'Đã nhập thành phẩm vào kho')
      const previous = patchFinishedGoodsCaches(queryClient, input)
      return { previous }
    },
    onSuccess: (_data, input) => {
      refreshFinishedGoodsQueries(queryClient, { refetch: !input.id })
    },
    onError: (error: Error, _input, ctx) => {
      ctx?.previous?.rollback()
      toast.error(error.message)
    },
  })

  return (
    <Stack spacing={1.25} sx={{ flex: { md: 1 }, minHeight: { md: 0 }, overflow: { xs: 'visible', md: 'hidden' } }}>
      <DataTable
        columns={columns}
        rows={paginate(sortRows(rows, params.sort, params.dir), page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={receipts.isLoading}
        errorText={receipts.error instanceof Error ? receipts.error.message : undefined}
        emptyText={filtering ? 'Không có dòng nhập khớp bộ lọc.' : 'Chưa có dòng nhập kho.'}
        variant="grid"
        minWidth={1580}
        showIndex
        indexOffset={indexOffset}
        sort={table.sortState}
        onSortChange={table.toggleSort}
        page={page}
        pageSize={params.pageSize}
        total={rows.length}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sx={{ flex: { md: 1 } }}
        toolbar={
          <>
            {filtering ? (
              <Button size="small" onClick={table.reset}>
                Xóa lọc
              </Button>
            ) : null}
            <Box sx={{ flex: 1, minWidth: 8 }} />
            <Button variant="contained" onClick={dialog.openCreate}>
              {profile.inboundLabel}
            </Button>
          </>
        }
      />
      <ReceiveFormDialog
        open={dialog.open}
        kind={dialog.kind}
        row={dialog.row}
        saving={save.isPending}
        onClose={dialog.close}
        onSaved={(payload) => save.mutate({ id: dialog.row?.id, payload })}
      />
      <ReceiveStockDialog
        row={receiving}
        saving={receive.isPending}
        onClose={() => setReceiving(null)}
        onConfirm={(qty) => receiving && receive.mutate({ row: receiving, qty })}
      />
    </Stack>
  )
}

function FinishedGoodsOutboundTable() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const profile = stockProfile(THANH_PHAM_WAREHOUSE)
  const table = useTableParams({ pageSize: 8, filters: { issuedBy: '', receivedBy: '' } })
  const { params } = table
  const dialog = useCrudDialog<OutboundMoveRow>()
  const [creating, setCreating] = useState<{ orderCode: string | null } | null>(null)

  const stock = useQuery({
    queryKey: ['finished-goods-stock'],
    queryFn: () => getFinishedGoodsStockApi(),
    staleTime: 60_000,
    enabled: Boolean(creating || dialog.open),
  })
  const shipments = useQuery({
    queryKey: ['finished-goods-shipments', ''],
    queryFn: () => listAllShipmentsApi(),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const lookups = useQuery({
    queryKey: ['finished-goods-lookups'],
    queryFn: getFinishedGoodsLookupsApi,
    staleTime: 5 * 60_000,
  })
  const editing = useQuery({
    queryKey: ['finished-goods-shipment', dialog.row?.shipmentCode],
    queryFn: () => getShipmentApi(dialog.row!.shipmentCode),
    enabled: Boolean(dialog.open && dialog.row && dialog.kind !== 'create'),
  })

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

  const moves = useMemo(
    () => flattenShipments(shipments.data?.items ?? []),
    [shipments.data?.items],
  )
  const issuerOptions = useMemo(() => uniqueFilterOptions(moves.map((row) => row.issuedBy)), [moves])
  const receiverOptions = useMemo(
    () => uniqueFilterOptions(moves.map((row) => row.receivedBy)),
    [moves],
  )

  const rows = useMemo(() => {
    const nameQuery = params.search.trim().toLocaleLowerCase('vi')
    return moves.filter((row) => {
      if (
        nameQuery &&
        ![row.name, row.sku, row.shipmentCode, row.receivedBy].some((field) =>
          field.toLocaleLowerCase('vi').includes(nameQuery),
        )
      ) {
        return false
      }
      if (params.issuedBy && row.issuedBy !== params.issuedBy) return false
      if (params.receivedBy && row.receivedBy !== params.receivedBy) return false
      return true
    })
  }, [moves, params.issuedBy, params.receivedBy, params.search])

  const filtering = Boolean(params.search.trim() || params.issuedBy || params.receivedBy)
  const totals = sumMoveTotals(rows)
  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize

  const invalidate = () =>
    Promise.all(
      [
        ['finished-goods-stock'],
        ['finished-goods-receipts'],
        ['finished-goods-shipments'],
        ['finished-goods-lookups'],
        ['production-orders'],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )

  const save = useMutation({
    mutationFn: (input: { code?: string; payload: ShipmentPayload }) =>
      input.code ? updateShipmentApi(input.code, input.payload) : createShipmentApi(input.payload),
    onSuccess: async (shipment) => {
      toast.success(dialog.kind === 'edit' ? `Đã cập nhật phiếu xuất ${shipment.code}` : `Đã lập phiếu xuất ${shipment.code}`)
      setCreating(null)
      dialog.close()
      await invalidate()
      navigate(`/finished-goods/shipments/${shipment.code}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo(
    () =>
      outboundColumns(totals, {
        search: params.search,
        onSearch: table.setSearch,
        issuedBy: params.issuedBy,
        issuedByOptions: issuerOptions,
        onIssuedBy: (id) => table.setFilter({ issuedBy: id }),
        receivedBy: params.receivedBy,
        receivedByOptions: receiverOptions,
        onReceivedBy: (id) => table.setFilter({ receivedBy: id }),
        onView: (row) => navigate(`/finished-goods/shipments/${row.shipmentCode}`),
        onEdit: dialog.openEdit,
      }),
    [
      dialog.openEdit,
      issuerOptions,
      navigate,
      params.issuedBy,
      params.receivedBy,
      params.search,
      receiverOptions,
      table,
      totals,
    ],
  )

  const formOpen = Boolean(creating) || (dialog.open && dialog.kind === 'edit' && Boolean(editing.data))
  const formShipment = creating ? null : (editing.data ?? null)
  const stockItems = useMemo(() => stock.data?.items ?? [], [stock.data?.items])

  return (
    <Stack spacing={1.25} sx={{ flex: { md: 1 }, minHeight: { md: 0 }, overflow: { xs: 'visible', md: 'hidden' } }}>
        <DataTable
        columns={columns}
        rows={paginate(sortRows(rows, params.sort, params.dir), page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={shipments.isLoading}
        errorText={shipments.error instanceof Error ? shipments.error.message : undefined}
        emptyText={filtering ? 'Không có dòng xuất khớp bộ lọc.' : 'Chưa có dòng xuất kho.'}
          variant="grid"
        minWidth={1480}
          showIndex
        indexOffset={indexOffset}
          sort={table.sortState}
          onSortChange={table.toggleSort}
        page={page}
          pageSize={params.pageSize}
        total={rows.length}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
          sx={{ flex: { md: 1 } }}
        toolbar={
          <>
            {filtering ? (
              <Button size="small" onClick={table.reset}>
                Xóa lọc
              </Button>
            ) : null}
            <Box sx={{ flex: 1, minWidth: 8 }} />
            <Button variant="contained" onClick={() => setCreating({ orderCode: null })}>
              {profile.outboundLabel}
            </Button>
          </>
        }
      />

      <ShipmentFormDialog
        open={formOpen}
        shipment={formShipment}
        stock={stockItems}
        customers={lookups.data?.customers ?? []}
        paymentMethods={lookups.data?.paymentMethods ?? []}
        initialOrderCode={creating?.orderCode}
        saving={save.isPending || (dialog.open && dialog.kind !== 'create' && editing.isFetching)}
        onClose={() => {
          setCreating(null)
          dialog.close()
        }}
        onSave={(payload) =>
          save.mutate({
            code: formShipment?.code,
            payload,
          })
        }
      />
    </Stack>
  )
}

function flattenShipments(items: ShipmentListRow[]): OutboundMoveRow[] {
  return items.flatMap((shipment) =>
    (shipment.lines?.length ? shipment.lines : []).map((line) => ({
      id: line.id,
      shipmentCode: shipment.code,
      shippedAt: shipment.shippedAt,
      sku: line.orderCode,
      name: line.description,
      qty: line.qty,
      unitPrice: line.unitPrice,
      amount: line.amount,
      note: line.note ?? shipment.note,
      issuedBy: shipment.createdByName,
      receivedBy: shipment.customerName,
      autoIssued: Boolean(shipment.autoIssued),
    })),
  )
}

function availabilityColor(code: AvailabilityCode) {
  if (code === 'IN_STOCK') return 'success' as const
  if (code === 'LOW') return 'warning' as const
  return 'error' as const
}

function qtyLabel(value?: string) {
  return value == null ? 'SL' : `SL (${formatQty(value)})`
}

function ttLabel(value?: string) {
  return value == null ? 'TT' : `TT (${formatMoney(value)})`
}

function sumStockTotals(rows: FinishedGoodsStockRow[]): StockTotals {
  const sum = (pick: (row: FinishedGoodsStockRow) => string) =>
    String(rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0))
  return {
    openingQty: sum((row) => row.openingQty),
    openingAmount: sum((row) => row.openingAmount),
    inQty: sum((row) => row.inQty),
    inAmount: sum((row) => row.inAmount),
    outQty: sum((row) => row.outQty),
    outAmount: sum((row) => row.outAmount),
    qty: sum((row) => row.qty),
    amount: sum((row) => row.amount),
  }
}

function sumMoveTotals(rows: Array<{ qty: string; amount: string }>) {
  return {
    qty: String(rows.reduce((acc, row) => acc + (Number(row.qty) || 0), 0)),
    amount: String(rows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0)),
  }
}

function refreshFinishedGoodsQueries(queryClient: QueryClient, { refetch }: { refetch: boolean }) {
  const refetchType = refetch ? 'active' : 'none'
  void Promise.all(
    [
      ['finished-goods-stock'],
      ['finished-goods-receipts'],
      ['finished-goods-order-options'],
      ['finished-product-options'],
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType })),
  )
}

function patchFinishedGoodsCaches(
  queryClient: QueryClient,
  input: { id?: string; payload: UpsertReceiptPayload },
) {
  const stockKey = ['finished-goods-stock']
  const receiptKey = ['finished-goods-receipts']
  void queryClient.cancelQueries({ queryKey: stockKey })
  void queryClient.cancelQueries({ queryKey: receiptKey })
  const prevStock = queryClient.getQueryData<{ totals: StockTotals; items: FinishedGoodsStockRow[] }>(stockKey)
  const prevReceipts = queryClient.getQueryData<{ items: FinishedGoodsReceiptRow[] }>(receiptKey)

  if (input.id) {
    queryClient.setQueryData(stockKey, (current: typeof prevStock) => {
      if (!current) return current
      const items = current.items.map((item) =>
        item.id === input.id ? patchFinishedGoodsStockRow(item, input.payload) : item,
      )
      return { ...current, items, totals: sumStockTotals(items) }
    })
    queryClient.setQueryData(receiptKey, (current: typeof prevReceipts) => {
      if (!current) return current
      return {
        ...current,
        items: current.items.map((item) =>
          item.id === input.id ? patchFinishedGoodsReceiptRow(item, input.payload) : item,
        ),
      }
    })
  } else if (input.payload.orderCode) {
    queryClient.setQueryData(stockKey, (current: typeof prevStock) => {
      if (!current) return current
      const items = current.items.map((item) =>
        item.orderCode === input.payload.orderCode
          ? addFinishedGoodsInboundQty(item, input.payload)
          : item,
      )
      return { ...current, items, totals: sumStockTotals(items) }
    })
  } else {
    queryClient.setQueryData(stockKey, (current: typeof prevStock) => {
      const created = createdFinishedGoodsStockRow(input.payload)
      const items = [created, ...(current?.items ?? [])]
      return {
        totals: sumStockTotals(items),
        items,
      }
    })
  }

  return {
    rollback: () => {
      if (prevStock) queryClient.setQueryData(stockKey, prevStock)
      else queryClient.removeQueries({ queryKey: stockKey })
      if (prevReceipts) queryClient.setQueryData(receiptKey, prevReceipts)
    },
  }
}

function createdFinishedGoodsStockRow(payload: UpsertReceiptPayload): FinishedGoodsStockRow {
  const receivedQty = payload.qty
  const unitCost = Number(payload.stockUnitPrice) || 0
  const amount = String(Math.round(receivedQty * unitCost))
  const av = stockStatusFromQty(String(receivedQty))
  return {
    id: `tmp-${Date.now()}`,
    orderCode: '…',
    description: payload.description ?? '',
    requestType: 'RETAIL',
    qtyUnit: payload.qtyUnit ?? null,
    sizeLabel: payload.sizeLabel ?? null,
    weight: payload.weight ?? null,
    mainMaterial: payload.mainMaterial ?? null,
    platingColor: payload.platingColor || null,
    imageUrl: null,
    bomLines: [],
    isOpening: true,
    openingQty: String(receivedQty),
    openingAmount: amount,
    inQty: '0',
    inAmount: '0',
    outQty: '0',
    outAmount: '0',
    qty: String(receivedQty),
    amount,
    receivedQty,
    shippedQty: 0,
    remainingQty: receivedQty,
    receivedAt: payload.receivedAt,
    receivedByName: '',
    unitCost: String(unitCost),
    stockValue: amount,
    costWarnings: 0,
    availability: av.code,
    availabilityLabel: av.label,
  }
}

function addFinishedGoodsInboundQty(
  row: FinishedGoodsStockRow,
  payload: UpsertReceiptPayload,
): FinishedGoodsStockRow {
  const receivedQty = row.receivedQty + payload.qty
  const remainingQty = receivedQty - row.shippedQty
  const unitCost = Number(row.unitCost) || 0
  const av = stockStatusFromQty(String(remainingQty))
  const inQty = row.isOpening ? row.inQty : String(receivedQty)
  return {
    ...row,
    receivedAt: payload.receivedAt,
    receivedQty,
    remainingQty,
    inQty,
    inAmount: row.isOpening ? row.inAmount : String(Math.round(receivedQty * unitCost)),
    qty: String(remainingQty),
    amount: String(Math.round(remainingQty * unitCost)),
    stockValue: String(Math.round(remainingQty * unitCost)),
    availability: av.code,
    availabilityLabel: av.label,
  }
}

function patchFinishedGoodsStockRow(row: FinishedGoodsStockRow, payload: UpsertReceiptPayload): FinishedGoodsStockRow {
  const receivedQty = payload.qty
  const remainingQty = receivedQty - row.shippedQty
  const av = stockStatusFromQty(String(remainingQty))
  const unitCost = Number(payload.stockUnitPrice ?? row.unitCost) || 0
  return {
    ...row,
    description: payload.description ?? row.description,
    mainMaterial: payload.mainMaterial ?? row.mainMaterial,
    platingColor: payload.platingColor !== undefined ? payload.platingColor || null : row.platingColor,
    sizeLabel: payload.sizeLabel ?? row.sizeLabel,
    weight: payload.weight !== undefined ? payload.weight || null : row.weight,
    qtyUnit: payload.qtyUnit ?? row.qtyUnit,
    receivedAt: payload.receivedAt,
    receivedQty,
    remainingQty,
    openingQty: row.isOpening ? String(receivedQty) : row.openingQty,
    openingAmount: row.isOpening
      ? String(Math.round(receivedQty * unitCost))
      : row.openingAmount,
    inQty: row.isOpening ? '0' : String(receivedQty),
    inAmount: row.isOpening ? '0' : String(Math.round(receivedQty * unitCost)),
    qty: String(remainingQty),
    amount: String(Math.round(remainingQty * unitCost)),
    stockValue: String(Math.round(remainingQty * unitCost)),
    availability: av.code,
    availabilityLabel: av.label,
  }
}

function patchFinishedGoodsReceiptRow(row: FinishedGoodsReceiptRow, payload: UpsertReceiptPayload): FinishedGoodsReceiptRow {
  const qty = String(payload.qty)
  const unitPrice = Number(row.unitPrice) || 0
  // Khớp đúng luật ở BE: phiếu đã vào tồn đủ thì tồn đi theo số mới, phiếu còn dở chỉ bị
  // cắt khi số mới thấp hơn phần đã nhận.
  const stockedQty =
    row.stockedQty === Number(row.qty)
      ? payload.qty
      : Math.min(row.stockedQty, payload.qty)
  const pendingQty = Math.max(0, payload.qty - stockedQty)
  return {
    ...row,
    sizeLabel: payload.sizeLabel ?? row.sizeLabel,
    weight: payload.weight !== undefined ? payload.weight || null : row.weight,
    qtyUnit: payload.qtyUnit ?? row.qtyUnit,
    receivedAt: payload.receivedAt,
    qty,
    stockedQty,
    pendingQty,
    status: pendingQty > 0 ? 'PENDING' : 'RECEIVED',
    remainingQty: stockedQty - row.shippedQty,
    amount: String(Math.round(payload.qty * unitPrice)),
  }
}

type HeaderFilter = {
  valueId: string
  options: Array<{ id: string; name: string }>
  onChange: (id: string) => void
}

function StackedLines({
  values,
  strong,
  align,
}: {
  values: string[]
  strong?: boolean
  align?: 'left' | 'right' | 'center'
}) {
  if (!values.length) return <>—</>
  return (
    <Stack spacing={0.25} sx={{ py: 0.25, alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
      {values.map((value, index) => (
        <Typography
          key={`${value}-${index}`}
          variant="body2"
          sx={{
            fontWeight: strong ? 700 : 400,
            lineHeight: 1.35,
            whiteSpace: 'nowrap',
            fontVariantNumeric: align === 'right' ? 'tabular-nums' : undefined,
          }}
        >
          {value || '—'}
        </Typography>
      ))}
    </Stack>
  )
}

function nvlField(row: FinishedGoodsStockRow, pick: (line: NonNullable<FinishedGoodsStockRow['bomLines']>[number]) => string) {
  return (row.bomLines ?? []).map(pick)
}

function stockColumns(
  totals: StockTotals | undefined,
  filters: { name: ReactNode; unit: HeaderFilter; status: HeaderFilter; flowStatus: HeaderFilter },
  actions: {
    onView: (row: FinishedGoodsStockRow) => void
    onEdit: (row: FinishedGoodsStockRow) => void
  },
): Column<FinishedGoodsStockRow>[] {
  const profile = stockProfile(THANH_PHAM_WAREHOUSE)
  return [
    {
      key: 'sku',
      card: 'meta',
      header: profile.skuLabel,
      cellSx: { fontWeight: 700, whiteSpace: 'nowrap' },
      render: (row) => row.orderCode,
    },
    {
      key: 'name',
      card: 'title',
      header: profile.nameLabel,
      cellSx: { minWidth: 220 },
      filter: filters.name,
      render: (row) => row.description,
    },
    {
      key: 'nvlSku',
      header: 'Mã NVL',
      cellSx: { fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'top' },
      render: (row) => <StackedLines values={(row.bomLines ?? []).map((line) => line.sku ?? '—')} strong />,
    },
    {
      key: 'nvlName',
      header: 'Tên NVL',
      cellSx: { minWidth: 180, verticalAlign: 'top' },
      render: (row) => <StackedLines values={nvlField(row, (line) => line.name)} />,
    },
    {
      key: 'unit',
      header: 'Đơn vị',
      align: 'center',
      filter: <ColumnHeaderFilter {...filters.unit} />,
      render: (row) => row.qtyUnit ?? '—',
    },
    {
      key: 'sizeLabel',
      header: 'Size',
      width: 70,
      align: 'center',
      render: (row) => row.sizeLabel ?? '—',
    },
    {
      key: 'weight',
      header: 'Trọng lượng (g)',
      width: 110,
      align: 'right',
      render: (row) => (row.weight ? formatQty(row.weight) : '—'),
    },
    {
      key: 'openingQty',
      header: qtyLabel(totals?.openingQty),
      group: STOCK_GROUPS.open,
      headSx: groupHead.open,
      align: 'right',
      cellSx: groupBody.open,
      render: (row) => formatQty(row.openingQty),
    },
    {
      key: 'openingAmount',
      header: ttLabel(totals?.openingAmount),
      group: STOCK_GROUPS.open,
      headSx: { bgcolor: groupHead.open.bgcolor },
      align: 'right',
      cellSx: { ...numCell, bgcolor: groupBody.open.bgcolor },
      render: (row) => formatMoney(row.openingAmount),
    },
    {
      key: 'inQty',
      header: qtyLabel(totals?.inQty),
      group: STOCK_GROUPS.in,
      headSx: groupHead.in,
      align: 'right',
      cellSx: groupBody.in,
      render: (row) => formatQty(row.inQty),
    },
    {
      key: 'inAmount',
      header: ttLabel(totals?.inAmount),
      group: STOCK_GROUPS.in,
      headSx: { bgcolor: groupHead.in.bgcolor },
      align: 'right',
      cellSx: { ...numCell, bgcolor: groupBody.in.bgcolor },
      render: (row) => formatMoney(row.inAmount),
    },
    {
      key: 'outQty',
      header: qtyLabel(totals?.outQty),
      group: STOCK_GROUPS.out,
      headSx: groupHead.out,
      align: 'right',
      cellSx: groupBody.out,
      render: (row) => formatQty(row.outQty),
    },
    {
      key: 'outAmount',
      header: ttLabel(totals?.outAmount),
      group: STOCK_GROUPS.out,
      headSx: { bgcolor: groupHead.out.bgcolor },
      align: 'right',
      cellSx: { ...numCell, bgcolor: groupBody.out.bgcolor },
      render: (row) => formatMoney(row.outAmount),
    },
    {
      key: 'qty',
      header: qtyLabel(totals?.qty),
      group: STOCK_GROUPS.stock,
      headSx: groupHead.stock,
      align: 'right',
      cellSx: groupBody.stock,
      render: (row) => formatQty(row.qty),
    },
    {
      key: 'amount',
      header: ttLabel(totals?.amount),
      group: STOCK_GROUPS.stock,
      headSx: { bgcolor: groupHead.stock.bgcolor, color: 'primary.main' },
      align: 'right',
      cellSx: { ...groupBody.stock, borderLeft: '1px solid #cbbda9' },
      render: (row) => formatMoney(row.amount),
    },
    { key: 'mainMaterial', header: 'Chất liệu', render: (row) => row.mainMaterial ?? '—' },
    {
      key: 'flowStatus',
      header: 'Trạng thái kho',
      filter: <ColumnHeaderFilter {...filters.flowStatus} />,
      align: 'center',
      render: (row) => {
        const flow = FG_FLOW_STATUS[fgFlowStatus(row)]
        return (
          <Chip size="small" variant="outlined" color={flow.color} label={flow.label} />
        )
      },
    },
    {
      key: 'availability',
      card: 'meta',
      header: 'Trạng thái thành phẩm',
      filter: <ColumnHeaderFilter {...filters.status} />,
      align: 'center',
      render: (row) => (
        <Chip
          size="small"
          variant="outlined"
          color={availabilityColor(row.availability)}
          label={row.costWarnings > 0 ? `${row.availabilityLabel} ⚠` : row.availabilityLabel}
        />
      ),
    },
    {
      key: 'actions',
      card: 'actions',
      header: 'Hành động',
      align: 'center',
      render: (row) => <RowActions onView={() => actions.onView(row)} onEdit={() => actions.onEdit(row)} />,
    },
  ]
}

function StockCard({
  row,
  index,
  onView,
  onEdit,
}: {
  row: FinishedGoodsStockRow
  index: number
  onView: () => void
  onEdit: () => void
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            #{index}
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
            {row.description}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.25, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {row.orderCode}
            </Typography>
            {row.sizeLabel ? (
              <Typography variant="caption" color="text.secondary">
                Size {row.sizeLabel}
              </Typography>
            ) : null}
            {row.weight ? (
              <Typography variant="caption" color="text.secondary">
                {formatQty(row.weight)}g
              </Typography>
            ) : null}
            <Chip
              size="small"
              variant="outlined"
              color={FG_FLOW_STATUS[fgFlowStatus(row)].color}
              label={FG_FLOW_STATUS[fgFlowStatus(row)].label}
            />
            <Chip
              size="small"
              variant="outlined"
              color={availabilityColor(row.availability)}
              label={row.availabilityLabel}
            />
          </Stack>
          {(row.bomLines ?? []).length ? (
            <Stack spacing={0.15} sx={{ mt: 0.75 }}>
              {(row.bomLines ?? []).map((line) => (
                <Typography key={line.id} variant="caption" color="text.secondary">
                  {line.sku ? `${line.sku} — ${line.name}` : line.name}
                </Typography>
              ))}
            </Stack>
          ) : null}
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <RowActions onView={onView} onEdit={onEdit} />
        </Box>
      </Stack>
      <Box sx={{ mt: 1.25 }}>
        <StockFigureGrid
          values={{
            openingQty: row.openingQty,
            openingAmount: row.openingAmount,
            inQty: row.inQty,
            inAmount: row.inAmount,
            outQty: row.outQty,
            outAmount: row.outAmount,
            qty: row.qty,
            amount: row.amount,
          }}
          orientation="rows"
        />
      </Box>
    </Paper>
  )
}

function inboundColumns(
  totals: { qty: string; amount: string },
  opts: {
    search: string
    onSearch: (value: string) => void
    enteredBy: string
    enteredByOptions: Array<{ id: string; name: string }>
    onEnteredBy: (id: string) => void
    onView: (row: FinishedGoodsReceiptRow) => void
    onEdit: (row: FinishedGoodsReceiptRow) => void
    onReceive: (row: FinishedGoodsReceiptRow) => void
    receivingId: string | null
  },
): Column<FinishedGoodsReceiptRow>[] {
  const profile = stockProfile(THANH_PHAM_WAREHOUSE)
  return [
    {
      key: 'status',
      header: 'Trạng thái',
      width: 112,
      align: 'center',
      render: (row) => (
        <Chip
          size="small"
          variant="outlined"
          color={row.status === 'PENDING' ? 'warning' : 'success'}
          label={row.status === 'PENDING' ? 'Chờ vào tồn' : 'Đã vào tồn'}
        />
      ),
    },
    {
      key: 'receivedAt',
      card: 'meta',
      header: 'Ngày tạo / nhập',
      width: 108,
      sortable: true,
      render: (row) => formatStockedDate(row.receivedAt),
    },
    {
      key: 'sku',
      header: profile.skuLabel,
      width: 110,
      cellSx: { fontWeight: 700, whiteSpace: 'nowrap' },
      render: (row) => (
        <Link component={RouterLink} to={`/orders/${row.orderCode}`} sx={{ fontWeight: 700 }}>
          {row.orderCode}
        </Link>
      ),
    },
    {
      key: 'name',
      card: 'title',
      header: profile.nameLabel,
      ellipsis: true,
      sortable: true,
      filter: <ColumnHeaderSearch value={opts.search} onChange={opts.onSearch} />,
      render: (row) => row.description,
    },
    {
      key: 'qty',
      header: headerTotal('SL hoàn thiện', totals.qty, formatQty),
      width: 120,
      numeric: true,
      sortable: true,
      render: (row) => formatQty(row.qty),
    },
    {
      key: 'pendingQty',
      header: 'Chờ nhập',
      width: 92,
      numeric: true,
      render: (row) => formatQty(String(row.pendingQty)),
    },
    {
      key: 'stockedQty',
      header: 'Đã vào tồn',
      width: 96,
      numeric: true,
      render: (row) => formatQty(String(row.stockedQty)),
    },
    {
      key: 'unitPrice',
      header: 'Đơn giá',
      width: 108,
      numeric: true,
      render: (row) => formatMoney(row.unitPrice),
    },
    {
      key: 'amount',
      header: headerTotal('Thành tiền', totals.amount, formatMoney),
      width: 130,
      numeric: true,
      sortable: true,
      cellSx: { fontWeight: 700 },
      render: (row) => formatMoney(row.amount),
    },
    { key: 'note', header: 'Ghi chú', width: 120, ellipsis: true, render: (row) => row.note ?? '—' },
    {
      key: 'enteredBy',
      header: 'Người tạo / nhập',
      width: 110,
      ellipsis: true,
      sortable: true,
      filter: (
        <ColumnHeaderFilter
          valueId={opts.enteredBy}
          options={opts.enteredByOptions}
          onChange={opts.onEnteredBy}
        />
      ),
      render: (row) => row.receivedByName ?? '—',
    },
    {
      key: 'actions',
      card: 'actions',
      header: 'Hành động',
      width: 210,
      align: 'center',
      render: (row) => (
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center', alignItems: 'center' }}>
          {row.status === 'PENDING' ? (
            <Button
              size="small"
              variant="contained"
              color="success"
              loading={opts.receivingId === row.id}
              onClick={() => opts.onReceive(row)}
            >
              Nhập kho
            </Button>
          ) : null}
          <RowActions
            onView={() => opts.onView(row)}
            onEdit={() => opts.onEdit(row)}
            editDisabled={row.status === 'PENDING'}
            titles={{
              edit: row.status === 'PENDING' ? 'Nhập kho trước khi chỉnh sửa' : 'Chỉnh sửa',
            }}
          />
        </Stack>
      ),
    },
  ]
}

function outboundColumns(
  totals: { qty: string; amount: string },
  opts: {
    search: string
    onSearch: (value: string) => void
    issuedBy: string
    issuedByOptions: Array<{ id: string; name: string }>
    onIssuedBy: (id: string) => void
    receivedBy: string
    receivedByOptions: Array<{ id: string; name: string }>
    onReceivedBy: (id: string) => void
    onView: (row: OutboundMoveRow) => void
    onEdit: (row: OutboundMoveRow) => void
  },
): Column<OutboundMoveRow>[] {
  const profile = stockProfile(THANH_PHAM_WAREHOUSE)
  return [
    {
      key: 'shippedAt',
      card: 'meta',
      header: 'Ngày xuất',
      width: 96,
      sortable: true,
      render: (row) => formatStockedDate(row.shippedAt),
    },
    {
      key: 'sku',
      header: profile.skuLabel,
      width: 110,
      cellSx: { fontWeight: 700, whiteSpace: 'nowrap' },
      render: (row) => (
        <Link component={RouterLink} to={`/orders/${row.sku}`} sx={{ fontWeight: 700 }}>
          {row.sku}
        </Link>
      ),
    },
    {
      key: 'name',
      card: 'title',
      header: profile.nameLabel,
      width: 220,
      sortable: true,
      filter: <ColumnHeaderSearch value={opts.search} onChange={opts.onSearch} />,
      render: (row) => row.name,
    },
    {
      key: 'qty',
      header: headerTotal('Số lượng', totals.qty, formatQty),
      width: 120,
      numeric: true,
      sortable: true,
      render: (row) => formatQty(row.qty),
    },
    {
      key: 'unitPrice',
      header: 'Đơn giá bán',
      width: 120,
      numeric: true,
      render: (row) => formatMoney(row.unitPrice),
    },
    {
      key: 'amount',
      header: headerTotal('Thành tiền', totals.amount, formatMoney),
      width: 130,
      numeric: true,
      sortable: true,
      cellSx: { fontWeight: 700 },
      render: (row) => formatMoney(row.amount),
    },
    {
      key: 'note',
      header: 'Ghi chú',
      width: 108,
      ellipsis: true,
      render: (row) => row.note ?? '—',
    },
    {
      key: 'issuedBy',
      card: 'meta',
      header: 'Người Xuất',
      width: 96,
      ellipsis: true,
      sortable: true,
      filter: (
        <ColumnHeaderFilter
          valueId={opts.issuedBy}
          options={opts.issuedByOptions}
          onChange={opts.onIssuedBy}
        />
      ),
    },
    {
      key: 'receivedBy',
      header: 'Người Nhận',
      width: 120,
      ellipsis: true,
      filter: (
        <ColumnHeaderFilter
          valueId={opts.receivedBy}
          options={opts.receivedByOptions}
          onChange={opts.onReceivedBy}
        />
      ),
    },
    {
      key: 'actions',
      card: 'actions',
      header: 'Hành động',
      width: 120,
      align: 'center',
      render: (row) => (
        <RowActions
          onView={() => opts.onView(row)}
          onEdit={row.autoIssued ? undefined : () => opts.onEdit(row)}
          titles={
            row.autoIssued
              ? { view: 'Xem', edit: 'Phiếu tự tạo khi lên đơn — sửa trên đơn' }
              : undefined
          }
        />
      ),
    },
  ]
}
