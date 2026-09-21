import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Box, Button, Chip, Link, Paper, Stack, Typography } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  createFinishedGoodsReceiptApi,
  createShipmentApi,
  deleteFinishedGoodsReceiptApi,
  deleteShipmentApi,
  getFinishedGoodsLookupsApi,
  getFinishedGoodsStockApi,
  getShipmentApi,
  listAllShipmentsApi,
  listFinishedGoodsReceiptsApi,
  updateFinishedGoodsReceiptApi,
  updateShipmentApi,
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
import { useDeleteRowDialog } from '../hooks/useDeleteRowDialog'
import { paginate, sortRows, useTableParams } from '../hooks/useTableParams'
import { ShipmentFormDialog } from '../finishedGoods/ShipmentFormDialog'
import { ReceiveFormDialog } from '../finishedGoods/ReceiveFormDialog'
import { FinishedGoodsStockDialog } from '../finishedGoods/StockFormDialog'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'
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
const split = { borderLeft: '2px solid #1b4f72' }
const groupHead = {
  open: { ...split, bgcolor: '#edf1f4', fontWeight: 700 },
  in: { ...split, bgcolor: '#e4f0e8', fontWeight: 700 },
  out: { ...split, bgcolor: '#f3ebe7', fontWeight: 700 },
  stock: { ...split, bgcolor: '#d6e3ee', fontWeight: 700, color: 'primary.main' },
}
const STOCK_GROUPS = {
  open: { key: 'open', label: 'Tồn đầu kỳ', headSx: groupHead.open },
  in: { key: 'in', label: 'Nhập', headSx: groupHead.in },
  out: { key: 'out', label: 'Xuất', headSx: groupHead.out },
  stock: { key: 'stock', label: 'Tồn', headSx: groupHead.stock },
} satisfies Record<string, ColumnGroup>
const groupBody = {
  open: { ...split, ...numCell, bgcolor: '#f7f9fb' },
  in: { ...split, ...numCell, bgcolor: '#f2f8f4' },
  out: { ...split, ...numCell, bgcolor: '#faf6f4' },
  stock: { ...split, ...numCell, bgcolor: '#eaf0f6', fontWeight: 700 },
}

const STATUS_FILTERS: { value: 'ALL' | AvailabilityCode; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'IN_STOCK', label: 'Còn' },
  { value: 'LOW', label: 'Sắp hết hàng' },
  { value: 'OUT_OF_STOCK', label: 'Hết hàng' },
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
  const table = useTableParams({ pageSize: 8, filters: { unit: '', status: 'ALL' } })
  const { params } = table

  const stock = useQuery({
    queryKey: ['finished-goods-stock'],
    queryFn: () => getFinishedGoodsStockApi(),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  })

  const items = useMemo(() => stock.data?.items ?? [], [stock.data?.items])
  const statusCounts = useMemo(() => {
    const counts = { IN_STOCK: 0, LOW: 0, OUT_OF_STOCK: 0 }
    for (const row of items) counts[row.availability] += 1
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

  const visible = useMemo(() => {
    const nameQuery = params.search.trim().toLocaleLowerCase('vi')
    return items.filter((row) => {
      if (
        nameQuery &&
        !row.description.toLocaleLowerCase('vi').includes(nameQuery) &&
        !row.orderCode.toLocaleLowerCase('vi').includes(nameQuery)
      ) {
        return false
      }
      if (params.unit && (row.qtyUnit ?? '') !== params.unit) return false
      if (params.status !== 'ALL' && row.availability !== params.status) return false
      return true
    })
  }, [items, params.search, params.status, params.unit])

  const filtered = Boolean(params.search.trim() || params.unit || params.status !== 'ALL')
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
        },
        {
          onView: dialog.openView,
          onEdit: dialog.openEdit,
        },
      ),
    [dialog.openEdit, dialog.openView, params.search, params.status, params.unit, statusFilterOptions, table, totals, unitOptions],
  )

  const save = useMutation({
    mutationFn: (input: { id?: string; payload: UpsertReceiptPayload }) =>
      input.id
        ? updateFinishedGoodsReceiptApi(input.id, input.payload)
        : createFinishedGoodsReceiptApi(input.payload),
    onMutate: (input) => {
      dialog.close()
      toast.success(input.id ? 'Đã cập nhật thành phẩm' : 'Đã nhập thành phẩm vào kho')
      const previous = patchFinishedGoodsCaches(queryClient, input)
      return { previous }
    },
    onSuccess: () => {
      void Promise.all(
        [
          ['finished-goods-stock'],
          ['finished-goods-receipts'],
          ['finished-goods-order-options'],
          ['finished-product-options'],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
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
        minWidth={1480}
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
    staleTime: 15_000,
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

  const del = useDeleteRowDialog({
    mutationFn: (row: FinishedGoodsReceiptRow) => deleteFinishedGoodsReceiptApi(row.id),
    successMessage: 'Đã xóa phiếu nhập',
    queryKeys: [['finished-goods-receipts']],
    invalidateKeys: [
      ['finished-goods-stock'],
      ['finished-goods-receipts'],
      ['finished-goods-order-options'],
      ['finished-product-options'],
    ],
    onRemoved: (row) => {
      queryClient.setQueryData(
        ['finished-goods-receipts'],
        (current: { items: FinishedGoodsReceiptRow[] } | undefined) => {
          if (!current) return current
          return { ...current, items: current.items.filter((item) => item.id !== row.id) }
        },
      )
    },
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
      onDelete: (row) => del.request(row),
    }),
    [del.request, dialog.openEdit, dialog.openView, enteredByOptions, params.enteredBy, params.search, table, totals],
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
    onSuccess: () => {
      void Promise.all(
        [
          ['finished-goods-stock'],
          ['finished-goods-receipts'],
          ['finished-goods-order-options'],
          ['finished-product-options'],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
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
        minWidth={1280}
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
      <ConfirmDeleteDialog
        open={Boolean(del.row)}
        title="Xóa phiếu nhập"
        description={
          del.row ? `Xóa phiếu nhập ${del.row.orderCode}? Thành phẩm sẽ ra khỏi kho.` : ''
        }
        deleting={false}
        onClose={del.cancel}
        onConfirm={del.confirm}
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

  const stock = useQuery({
    queryKey: ['finished-goods-stock'],
    queryFn: () => getFinishedGoodsStockApi(),
    staleTime: 15_000,
  })
  const shipments = useQuery({
    queryKey: ['finished-goods-shipments', ''],
    queryFn: () => listAllShipmentsApi(),
    staleTime: 15_000,
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

  const [creating, setCreating] = useState<{ orderCode: string | null } | null>(null)
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

  const del = useDeleteRowDialog({
    mutationFn: (row: OutboundMoveRow) => deleteShipmentApi(row.shipmentCode),
    successMessage: 'Đã xóa phiếu xuất',
    queryKeys: [['finished-goods-shipments', '']],
    invalidateKeys: [['finished-goods-stock'], ['finished-goods-receipts'], ['finished-goods-shipments']],
    onRemoved: (row) => {
      queryClient.setQueryData(
        ['finished-goods-shipments', ''],
        (current: { total: number; items: ShipmentListRow[] } | undefined) => {
          if (!current) return current
          const items = current.items.filter((item) => item.code !== row.shipmentCode)
          return { total: items.length, items }
        },
      )
    },
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
        onDelete: del.request,
      }),
    [
      del.request,
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
      <ConfirmDeleteDialog
        open={Boolean(del.row)}
        title="Xóa phiếu xuất"
        description={del.row ? `Xóa phiếu ${del.row.shipmentCode}? Tồn thành phẩm sẽ được cộng lại.` : ''}
        deleting={false}
        onClose={del.cancel}
        onConfirm={del.confirm}
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
  }

  return {
    rollback: () => {
      if (prevStock) queryClient.setQueryData(stockKey, prevStock)
      if (prevReceipts) queryClient.setQueryData(receiptKey, prevReceipts)
    },
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
    sizeLabel: payload.sizeLabel ?? row.sizeLabel,
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
  return {
    ...row,
    sizeLabel: payload.sizeLabel ?? row.sizeLabel,
    qtyUnit: payload.qtyUnit ?? row.qtyUnit,
    receivedAt: payload.receivedAt,
    qty,
    remainingQty: payload.qty - row.shippedQty,
    amount: String(Math.round(payload.qty * unitPrice)),
  }
}

type HeaderFilter = {
  valueId: string
  options: Array<{ id: string; name: string }>
  onChange: (id: string) => void
}

function stockColumns(
  totals: StockTotals | undefined,
  filters: { name: ReactNode; unit: HeaderFilter; status: HeaderFilter },
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
      cellSx: { minWidth: 220 },
      filter: filters.name,
      render: (row) => row.description,
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
      cellSx: { ...groupBody.stock, borderLeft: '1px solid #b7c2cc' },
      render: (row) => formatMoney(row.amount),
    },
    { key: 'mainMaterial', header: 'Chất liệu', render: (row) => row.mainMaterial ?? '—' },
    {
      key: 'availability',
      card: 'meta',
      header: 'Trạng thái',
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
            <Chip
              size="small"
              variant="outlined"
              color={availabilityColor(row.availability)}
              label={row.availabilityLabel}
            />
          </Stack>
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
    onDelete: (row: FinishedGoodsReceiptRow) => void
  },
): Column<FinishedGoodsReceiptRow>[] {
  const profile = stockProfile(THANH_PHAM_WAREHOUSE)
  return [
    {
      key: 'receivedAt',
      card: 'meta',
      header: 'Ngày nhập',
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
      header: headerTotal('Số lượng', totals.qty, formatQty),
      width: 120,
      numeric: true,
      sortable: true,
      render: (row) => formatQty(row.qty),
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
      header: 'Người nhập',
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
      width: 120,
      align: 'center',
      render: (row) => (
        <RowActions
          onView={() => opts.onView(row)}
          onEdit={() => opts.onEdit(row)}
          onDelete={() => opts.onDelete(row)}
          deleteDisabled={row.shippedQty > 0}
          titles={
            row.shippedQty > 0
              ? { delete: `Đã xuất ${row.shippedQty} — không xóa phiếu nhập được` }
              : undefined
          }
        />
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
    onDelete: (row: OutboundMoveRow) => void
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
      header: 'Đơn giá xuất',
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
          onDelete={row.autoIssued ? undefined : () => opts.onDelete(row)}
          titles={
            row.autoIssued
              ? { view: 'Xem', edit: 'Phiếu tự tạo khi lên đơn — sửa trên đơn', delete: 'Phiếu tự tạo khi lên đơn — sửa trên đơn' }
              : undefined
          }
        />
      ),
    },
  ]
}
