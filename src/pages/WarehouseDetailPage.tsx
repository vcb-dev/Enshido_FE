import { memo, useEffect, useMemo } from 'react'
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom'
import {
  Autocomplete,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Paper,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  formatMoney,
  formatQty,
  formatQtyInput,
  formatStockedDate,
  getInventoryLookupsApi,
  getWarehouseStockApi,
  parseQtyInput,
  qtyFromApi,
  updateWarehouseStockApi,
  type AvailabilityCode,
  type LookupItem,
  type StockRow,
  type StockTotals,
  type UpdateStockPayload,
} from '../api/inventory'
import {
  DataTable,
  Form,
  FormQtyField,
  FormRow,
  FormSelect,
  FormTextField,
  RowActions,
  SearchInput,
  SelectInput,
  TextInput,
  type Column,
  type SelectOption,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { paginate, useTableParams } from '../hooks/useTableParams'
import { colorHex, COLOR_CATALOG } from '../warehouses/colorPalette'
import { StockInboundPanel } from '../warehouses/StockInboundPanel'
import { StockOutboundPanel } from '../warehouses/StockOutboundPanel'
import {
  binSectionByCode,
  materialTypesFor,
  stockProfile,
  stockWarehouseCode,
  warehouseByCode,
  warehousePath,
  type StockProfile,
} from '../warehouses/catalog'

export function WarehouseDetailPage() {
  const { code, bin, section } = useParams<{
    code: string
    bin?: string
    section?: string
  }>()

  if (code === 'ban-thanh-pham') {
    return <Navigate to="/kho/nvl-chinh/bac/btp" replace />
  }

  const warehouse = warehouseByCode(code ?? '')
  const hasBins = Boolean(warehouse?.bins?.length)
  const activeBin = warehouse?.bins?.find((b) => b.code === bin)
  // Kho không có bin (kho tiêu hao) đi thẳng /kho/:code/:section — param `bin` chính là section.
  const sectionCode = hasBins ? section : bin
  const activeSection = binSectionByCode(sectionCode, bin)

  if (!warehouse) {
    return <Navigate to="/kho" replace />
  }

  if (sectionCode === 'gia') {
    return <Navigate to="/cau-hinh-gia" replace />
  }

  if (hasBins && (!bin || !activeBin)) {
    return <Navigate to={warehousePath(warehouse)} replace />
  }

  if (!activeSection) {
    return <Navigate to={warehousePath(warehouse, activeBin?.code, 'ton')} replace />
  }

  const stockKey = stockWarehouseCode(warehouse, activeBin?.code, sectionCode)
  const title = `${activeSection.name} — ${activeBin?.name ?? warehouse.shortName}`
  const subtitle = hasBins
    ? activeSection.code === 'btp'
      ? 'Bán thành phẩm đã gia công, chờ gắn đá — thuộc Kho bạc.'
      : `${activeBin?.name} thuộc ${warehouse.name}.`
    : warehouse.description

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <Breadcrumbs sx={{ flexShrink: 0 }}>
        <Link component={RouterLink} to="/kho" underline="hover" color="inherit">
          Kho
        </Link>
        {activeBin ? (
          <Typography color="text.secondary">{warehouse.shortName}</Typography>
        ) : null}
        {activeBin ? (
          <Typography color="text.secondary">{activeBin.name}</Typography>
        ) : null}
        <Typography color="text.primary">{activeSection.name}</Typography>
      </Breadcrumbs>

      <Stack sx={{ flexShrink: 0 }}>
        <Typography variant="h5">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Stack>

      {activeSection.code === 'nhap' ? (
        <StockInboundPanel key={`${stockKey}-nhap`} warehouseCode={stockKey} />
      ) : activeSection.code === 'xuat' ? (
        <StockOutboundPanel key={`${stockKey}-xuat`} warehouseCode={stockKey} />
      ) : (
        <StockOnHandTable key={`${stockKey}-ton`} warehouseCode={stockKey} />
      )}
    </Stack>
  )
}

const numCell = { fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const }
const split = { borderLeft: '2px solid #1b4f72' }
const groupHead = {
  open: { ...split, bgcolor: '#edf1f4', fontWeight: 700 },
  in: { ...split, bgcolor: '#e4f0e8', fontWeight: 700 },
  out: { ...split, bgcolor: '#f3ebe7', fontWeight: 700 },
  stock: { ...split, bgcolor: '#d6e3ee', fontWeight: 700, color: 'primary.main' },
  meta: { ...split, bgcolor: '#f4f6f7', fontWeight: 700 },
  count: { ...split, bgcolor: '#f1edf5', fontWeight: 700 },
}
const groupBody = {
  open: { ...split, ...numCell, bgcolor: '#f7f9fb' },
  in: { ...split, ...numCell, bgcolor: '#f2f8f4' },
  out: { ...split, ...numCell, bgcolor: '#faf6f4' },
  stock: { ...split, ...numCell, bgcolor: '#eaf0f6', fontWeight: 700 },
  meta: { ...split },
  count: { ...split, ...numCell, bgcolor: '#f8f5fa' },
}

function availabilityColor(code: AvailabilityCode) {
  if (code === 'IN_STOCK') return 'success' as const
  if (code === 'LOW') return 'warning' as const
  return 'error' as const
}

const STATUS_FILTERS: { value: 'ALL' | AvailabilityCode; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'IN_STOCK', label: 'Còn' },
  { value: 'LOW', label: 'Sắp hết hàng' },
  { value: 'OUT_OF_STOCK', label: 'Hết hàng' },
]

function StockOnHandTable({ warehouseCode }: { warehouseCode: string }) {
  const profile = stockProfile(warehouseCode)
  const queryClient = useQueryClient()
  const table = useTableParams({ pageSize: 8, filters: { status: 'ALL' } })
  const { params } = table
  const dialog = useCrudDialog<StockRow>()

  const stock = useQuery({
    queryKey: ['warehouse-stock', warehouseCode],
    queryFn: () => getWarehouseStockApi(warehouseCode),
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
  useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  })

  const items = useMemo(() => stock.data?.items ?? [], [stock.data?.items])

  const statusCounts = useMemo(() => {
    const counts = { IN_STOCK: 0, LOW: 0, OUT_OF_STOCK: 0 }
    for (const row of items) counts[row.availability] += 1
    return counts
  }, [items])

  const statusOptions: SelectOption<string>[] = useMemo(
    () =>
      STATUS_FILTERS.map((option) => {
        const count = option.value === 'ALL' ? items.length : statusCounts[option.value]
        const label = `${option.label} (${count})`
        return {
          value: option.value,
          label:
            option.value === 'ALL' ? (
              label
            ) : (
              <Chip
                size="small"
                variant="outlined"
                color={availabilityColor(option.value)}
                label={label}
                sx={{ pointerEvents: 'none' }}
              />
            ),
        }
      }),
    [items.length, statusCounts],
  )

  const visible = useMemo(() => {
    const keyword = params.search.trim().toLowerCase()
    return items.filter((row) => {
      if (params.status !== 'ALL' && row.availability !== params.status) return false
      if (!keyword) return true
      return [row.name, row.sku ?? '', row.locationCode ?? '', row.materialType ?? ''].some(
        (field) => field.toLowerCase().includes(keyword),
      )
    })
  }, [items, params.status, params.search])

  const filtered = params.status !== 'ALL' || params.search.trim() !== ''
  const totals = filtered ? sumStockTotals(visible) : stock.data?.totals
  const pageCount = Math.max(1, Math.ceil(visible.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize

  const save = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStockPayload }) =>
      updateWarehouseStockApi(warehouseCode, id, payload),
    onSuccess: async (row) => {
      toast.success('Đã cập nhật NVL')
      dialog.close()
      queryClient.setQueryData(
        ['warehouse-stock', warehouseCode],
        (current: { items: StockRow[]; totals: StockTotals } | undefined) => {
          if (!current) return current
          const next = current.items.map((item) => (item.id === row.id ? row : item))
          return { ...current, items: next, totals: sumStockTotals(next) }
        },
      )
      void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      void queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', warehouseCode] })
      void queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo(
    () => stockColumns(profile, dialog.openEdit),
    [profile, dialog.openEdit],
  )

  const minWidth =
    1480 -
    (profile.showLocation ? 0 : 110) -
    (profile.showSku ? 0 : 130) -
    (profile.showShapeColor ? 0 : 250) +
    (profile.showStockCount ? 240 : 0)

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {totals && visible.length > 0 ? (
        <StockSummaryBar totals={totals} count={visible.length} filtered={filtered} />
      ) : null}

      <DataTable
        columns={columns}
        rows={paginate(visible, page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={stock.isFetching}
        errorText={stock.error instanceof Error ? stock.error.message : undefined}
        emptyText={
          filtered
            ? 'Không có NVL khớp bộ lọc.'
            : 'Chưa có hàng tồn. Thêm tên hàng ở Cấu hình giá sản phẩm.'
        }
        variant="grid"
        minWidth={minWidth}
        showIndex
        indexOffset={indexOffset}
        rowsLabel="NVL"
        page={page}
        pageSize={params.pageSize}
        total={visible.length}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sx={{ flex: 1 }}
        customHeader={<StockTableHeader profile={profile} />}
        toolbar={
          <>
            <SearchInput
              value={params.search}
              onChange={table.setSearch}
              placeholder="Tìm tên NVL, mã, vị trí..."
            />
            <SelectInput
              label="Trạng thái"
              options={statusOptions}
              value={params.status}
              onChange={(value) => table.setFilter({ status: String(value) || 'ALL' })}
              sx={{ width: 220 }}
              fullWidth={false}
            />
          </>
        }
      />

      <StockEditDialog
        open={dialog.open}
        row={dialog.row}
        profile={profile}
        saving={save.isPending}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) => {
          if (!dialog.row) return
          save.mutate({ id: dialog.row.id, payload })
        }}
      />
    </Stack>
  )
}

const StockTableHeader = memo(function StockTableHeader({ profile }: { profile: StockProfile }) {
  return (
    <>
      <TableRow>
        <TableCell rowSpan={2} align="center" sx={{ width: 48 }}>
          STT
        </TableCell>
        {profile.showLocation ? <TableCell rowSpan={2}>Vị trí</TableCell> : null}
        {profile.showSku ? <TableCell rowSpan={2}>Mã NVL</TableCell> : null}
        {profile.showShapeColor ? (
          <>
            <TableCell rowSpan={2}>Hình dạng</TableCell>
            <TableCell rowSpan={2}>Màu sắc</TableCell>
          </>
        ) : null}
        <TableCell rowSpan={2}>Tên NVL</TableCell>
        <TableCell rowSpan={2} align="center">
          Đơn vị
        </TableCell>
        <TableCell align="center" colSpan={2} sx={groupHead.open}>
          Tồn đầu kỳ
        </TableCell>
        <TableCell align="center" colSpan={2} sx={groupHead.in}>
          Nhập
        </TableCell>
        <TableCell align="center" colSpan={2} sx={groupHead.out}>
          Xuất
        </TableCell>
        <TableCell align="center" colSpan={2} sx={groupHead.stock}>
          Tồn kho
        </TableCell>
        {profile.showStockCount ? (
          <TableCell align="center" colSpan={2} sx={groupHead.count}>
            Kiểm kê
          </TableCell>
        ) : null}
        <TableCell rowSpan={2} sx={groupHead.meta}>
          {profile.typeLabel}
        </TableCell>
        <TableCell rowSpan={2} align="center">
          Trạng thái
        </TableCell>
        <TableCell rowSpan={2} align="center">
          Hành động
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell align="right" sx={groupHead.open}>
          SL
        </TableCell>
        <TableCell align="right" sx={{ bgcolor: groupHead.open.bgcolor }}>
          TT
        </TableCell>
        <TableCell align="right" sx={groupHead.in}>
          SL
        </TableCell>
        <TableCell align="right" sx={{ bgcolor: groupHead.in.bgcolor }}>
          TT
        </TableCell>
        <TableCell align="right" sx={groupHead.out}>
          SL
        </TableCell>
        <TableCell align="right" sx={{ bgcolor: groupHead.out.bgcolor }}>
          TT
        </TableCell>
        <TableCell align="right" sx={groupHead.stock}>
          SL
        </TableCell>
        <TableCell
          align="right"
          sx={{ bgcolor: groupHead.stock.bgcolor, color: 'primary.main' }}
        >
          TT
        </TableCell>
        {profile.showStockCount ? (
          <>
            <TableCell align="right" sx={groupHead.count}>
              Tồn thực tế
            </TableCell>
            <TableCell align="right" sx={{ bgcolor: groupHead.count.bgcolor }}>
              Chênh lệch
            </TableCell>
          </>
        ) : null}
      </TableRow>
    </>
  )
})

function stockColumns(
  profile: StockProfile,
  onEdit: (row: StockRow) => void,
): Column<StockRow>[] {
  const columns: Column<StockRow>[] = []

  if (profile.showLocation) {
    columns.push({
      key: 'locationCode',
      header: 'Vị trí',
      render: (row) => row.locationCode ?? '—',
    })
  }
  if (profile.showSku) {
    columns.push({
      key: 'sku',
      header: 'Mã NVL',
      cellSx: { fontWeight: 700, whiteSpace: 'nowrap' },
      render: (row) => row.sku ?? '—',
    })
  }
  if (profile.showShapeColor) {
    columns.push(
      { key: 'shape', header: 'Hình dạng', render: (row) => row.shape ?? '—' },
      { key: 'color', header: 'Màu sắc', render: (row) => row.color ?? '—' },
    )
  }

  columns.push(
    { key: 'name', header: 'Tên NVL', cellSx: { minWidth: 220 } },
    { key: 'unit', header: 'Đơn vị', align: 'center' },
    {
      key: 'openingQty',
      header: 'SL',
      align: 'right',
      cellSx: groupBody.open,
      render: (row) => formatQty(row.openingQty),
    },
    {
      key: 'openingAmount',
      header: 'TT',
      align: 'right',
      cellSx: { ...numCell, bgcolor: groupBody.open.bgcolor },
      render: (row) => formatMoney(row.openingAmount),
    },
    {
      key: 'inQty',
      header: 'SL',
      align: 'right',
      cellSx: groupBody.in,
      render: (row) => formatQty(row.inQty),
    },
    {
      key: 'inAmount',
      header: 'TT',
      align: 'right',
      cellSx: { ...numCell, bgcolor: groupBody.in.bgcolor },
      render: (row) => formatMoney(row.inAmount),
    },
    {
      key: 'outQty',
      header: 'SL',
      align: 'right',
      cellSx: groupBody.out,
      render: (row) => formatQty(row.outQty),
    },
    {
      key: 'outAmount',
      header: 'TT',
      align: 'right',
      cellSx: { ...numCell, bgcolor: groupBody.out.bgcolor },
      render: (row) => formatMoney(row.outAmount),
    },
    {
      key: 'qty',
      header: 'SL',
      align: 'right',
      cellSx: groupBody.stock,
      render: (row) => formatQty(row.qty),
    },
    {
      key: 'amount',
      header: 'TT',
      align: 'right',
      cellSx: { ...groupBody.stock, borderLeft: '1px solid #b7c2cc' },
      render: (row) => formatMoney(row.amount),
    },
  )

  if (profile.showStockCount) {
    columns.push(
      {
        key: 'countedQty',
        header: 'Tồn thực tế',
        align: 'right',
        cellSx: groupBody.count,
        render: (row) =>
          row.countedQty == null ? (
            '—'
          ) : (
            <>
              {formatQty(row.countedQty)}
              {row.countedAt ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {formatStockedDate(row.countedAt)}
                </Typography>
              ) : null}
            </>
          ),
      },
      {
        key: 'countedVariance',
        header: 'Chênh lệch',
        align: 'right',
        cellSx: { ...numCell, bgcolor: groupBody.count.bgcolor, fontWeight: 700 },
        render: (row) => <VarianceCell row={row} />,
      },
    )
  }

  columns.push(
    {
      key: 'materialType',
      header: profile.typeLabel,
      cellSx: groupBody.meta,
      render: (row) => row.materialType ?? '—',
    },
    {
      key: 'availability',
      header: 'Trạng thái',
      align: 'center',
      render: (row) => (
        <Chip
          size="small"
          variant="outlined"
          color={availabilityColor(row.availability)}
          label={row.availabilityLabel}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      align: 'center',
      render: (row) => <RowActions onEdit={() => onEdit(row)} />,
    },
  )

  return columns
}

function VarianceCell({ row }: { row: StockRow }) {
  if (row.countedQty == null) return <>—</>
  const variance = Number(row.countedVariance ?? '0')
  const tone = variance === 0 ? 'text.secondary' : variance > 0 ? '#1e8449' : '#c0392b'
  const sign = variance > 0 ? '+' : ''
  return (
    <Box component="span" sx={{ color: tone }}>
      {sign}
      {formatQty(row.countedVariance ?? '0')}
    </Box>
  )
}

function sumStockTotals(rows: StockRow[]): StockTotals {
  const sum = (pick: (row: StockRow) => string) =>
    String(rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0))
  return {
    openingQty: sum((r) => r.openingQty),
    openingAmount: sum((r) => r.openingAmount),
    inQty: sum((r) => r.inQty),
    inAmount: sum((r) => r.inAmount),
    outQty: sum((r) => r.outQty),
    outAmount: sum((r) => r.outAmount),
    qty: sum((r) => r.qty),
    amount: sum((r) => r.amount),
  }
}

function StockSummaryBar({
  totals,
  count,
  filtered,
}: {
  totals: StockTotals
  count: number
  filtered: boolean
}) {
  return (
    <Paper sx={{ p: 1.25, flexShrink: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mb: 1, alignItems: { sm: 'baseline' }, justifyContent: 'space-between' }}
      >
        <Typography variant="subtitle2">Tổng hợp nhập-xuất-tồn</Typography>
        <Typography variant="caption" color="text.secondary">
          {filtered ? `Đang lọc · ${count} NVL` : `Toàn kho · ${count} NVL`}
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
        }}
      >
        <SummaryCard title="Tồn đầu kỳ" tone="open" sl={totals.openingQty} tt={totals.openingAmount} />
        <SummaryCard title="Nhập" tone="in" sl={totals.inQty} tt={totals.inAmount} />
        <SummaryCard title="Xuất" tone="out" sl={totals.outQty} tt={totals.outAmount} />
        <SummaryCard title="Tồn kho" tone="stock" sl={totals.qty} tt={totals.amount} />
      </Box>
    </Paper>
  )
}

function SummaryCard({
  title,
  tone,
  sl,
  tt,
}: {
  title: string
  tone: 'open' | 'in' | 'out' | 'stock'
  sl: string
  tt: string
}) {
  const colors = {
    open: { bg: '#f7f9fb', bar: '#5d6d7e' },
    in: { bg: '#f2f8f4', bar: '#1e8449' },
    out: { bg: '#faf6f4', bar: '#b9770e' },
    stock: { bg: '#eaf0f6', bar: '#1b4f72' },
  }[tone]

  return (
    <Box
      sx={{
        bgcolor: colors.bg,
        border: '1px solid #b7c2cc',
        borderLeft: `4px solid ${colors.bar}`,
        borderRadius: 1,
        px: 1.25,
        py: 1,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 0.75, color: colors.bar }}>
        {title}
      </Typography>
      <Stack spacing={0.35}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
          <Typography variant="caption" color="text.secondary">
            Số lượng (SL):
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: colors.bar, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatQty(sl)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
          <Typography variant="caption" color="text.secondary">
            Thành tiền (TT):
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: colors.bar, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMoney(tt)}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  )
}

type StockFormValues = {
  locationCode: string
  sku: string
  shapeId: string
  colorId: string
  name: string
  unitId: string
  materialTypeId: string
  openingQty: string
  stockUnitPrice: string
  inQty: string
  inAmount: string
  outQty: string
  outAmount: string
  countedQty: string
  countedAt: string
}

const EMPTY_STOCK: StockFormValues = {
  locationCode: '',
  sku: '',
  shapeId: '',
  colorId: '',
  name: '',
  unitId: '',
  materialTypeId: '',
  openingQty: '0',
  stockUnitPrice: '0',
  inQty: '0',
  inAmount: '0',
  outQty: '0',
  outAmount: '0',
  countedQty: '',
  countedAt: '',
}

function StockEditDialog({
  open,
  row,
  profile,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  row: StockRow | null
  profile: StockProfile
  saving: boolean
  onClose: () => void
  onExited: () => void
  onSave: (payload: UpdateStockPayload) => void
}) {
  const lookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    enabled: open,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  })
  const form = useForm<StockFormValues>({ defaultValues: EMPTY_STOCK })

  useEffect(() => {
    if (!open) return
    form.reset(
      row
        ? {
            locationCode: row.locationCode ?? '',
            sku: row.sku ?? '',
            shapeId: row.shapeId ?? '',
            colorId: row.colorId ?? '',
            name: row.name,
            unitId: row.unitId,
            materialTypeId: row.materialTypeId ?? '',
            openingQty: qtyFromApi(row.openingQty),
            stockUnitPrice: row.stockUnitPrice,
            inQty: qtyFromApi(row.inQty),
            inAmount: row.inAmount,
            outQty: qtyFromApi(row.outQty),
            outAmount: row.outAmount,
            countedQty: row.countedQty == null ? '' : qtyFromApi(row.countedQty),
            countedAt: row.countedAt ?? '',
          }
        : EMPTY_STOCK,
    )
  }, [open, row, form])

  const colors = useMemo(() => {
    const api = lookups.data?.colors ?? []
    const byCode = new Map(api.map((item) => [item.code, item]))
    const ordered: LookupItem[] = []
    for (const pal of COLOR_CATALOG) {
      const hit = byCode.get(pal.code)
      if (hit) {
        ordered.push(hit)
        byCode.delete(pal.code)
      }
    }
    ordered.push(...byCode.values())
    return ordered
  }, [lookups.data?.colors])

  const openingQty = form.watch('openingQty')
  const stockUnitPrice = form.watch('stockUnitPrice')
  const inQty = form.watch('inQty')
  const inAmount = form.watch('inAmount')
  const outQty = form.watch('outQty')
  const outAmount = form.watch('outAmount')
  const countedQty = form.watch('countedQty')
  const countedAt = form.watch('countedAt')

  // Nhập số kiểm kê mà chưa có ngày thì mặc định hôm nay.
  useEffect(() => {
    if (countedQty.trim() !== '' && !countedAt) form.setValue('countedAt', today())
  }, [countedQty, countedAt, form])

  const openingAmount = String(Math.round((Number(openingQty) || 0) * (Number(stockUnitPrice) || 0)))
  const qty = String((Number(openingQty) || 0) + (Number(inQty) || 0) - (Number(outQty) || 0))
  const amount = String(
    Math.round((Number(openingAmount) || 0) + (Number(inAmount) || 0) - (Number(outAmount) || 0)),
  )

  const unitOptions: SelectOption<string>[] = (lookups.data?.units ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }))
  const shapeOptions: SelectOption<string>[] = (lookups.data?.shapes ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }))
  const typeOptions: SelectOption<string>[] = materialTypesFor(
    profile,
    lookups.data?.materialTypes ?? [],
  ).map((item) => ({ value: item.id, label: item.name }))

  function submit(values: StockFormValues) {
    onSave({
      ...(profile.showSku ? { sku: values.sku } : {}),
      ...(profile.showLocation ? { locationCode: values.locationCode } : {}),
      name: values.name.trim(),
      unitId: values.unitId,
      shapeId: profile.showShapeColor ? values.shapeId || null : null,
      colorId: profile.showShapeColor ? values.colorId || null : null,
      materialTypeId: values.materialTypeId || null,
      openingQty: values.openingQty,
      ...(profile.showStockCount
        ? {
            countedQty: values.countedQty.trim() === '' ? null : values.countedQty,
            countedAt: values.countedQty.trim() === '' ? null : values.countedAt || today(),
          }
        : {}),
    })
  }

  const countedDiff = Number(countedQty || '0') - Number(qty)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{ transition: { onExited } }}
    >
      <Form form={form} onSubmit={submit}>
        <DialogTitle sx={{ pb: 0.5 }}>
          {row ? `Chỉnh sửa ${row.name || 'NVL'}` : 'Thêm NVL'}
        </DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            pt: 1,
            '& .MuiFormLabel-asterisk': { color: 'error.main' },
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
            <FormTextField<StockFormValues>
              name="name"
              label="Tên NVL"
              required
              autoFocus
              sx={{ flex: 2 }}
            />
            {profile.showLocation ? (
              <FormTextField<StockFormValues> name="locationCode" label="Vị trí" sx={{ flex: 1 }} />
            ) : null}
            {profile.showSku ? (
              <FormTextField<StockFormValues> name="sku" label="Mã NVL" sx={{ flex: 1 }} />
            ) : null}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {profile.showShapeColor ? (
              <>
                <FormSelect<StockFormValues>
                  name="shapeId"
                  label="Hình dạng"
                  options={shapeOptions}
                  clearable
                  placeholder="—"
                  sx={{ flex: 1 }}
                />
                <Controller
                  name="colorId"
                  control={form.control}
                  render={({ field }) => (
                    <ColorField
                      colors={colors}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </>
            ) : null}
            <FormSelect<StockFormValues>
              name="unitId"
              label="Đơn vị"
              options={unitOptions}
              required
              clearable={!row}
              placeholder={!row ? 'Chọn đơn vị' : undefined}
              sx={{ flex: 1 }}
            />
            <FormSelect<StockFormValues>
              name="materialTypeId"
              label={profile.typeLabel}
              options={typeOptions}
              clearable
              placeholder="—"
              sx={{ flex: 1 }}
            />
          </Stack>

          <TextInput
            label="Đơn giá tồn"
            value={formatMoney(stockUnitPrice || '0')}
            readOnly
            helperText="Cấu hình tại mục Cấu hình giá sản phẩm. TT đầu kỳ = SL đầu kỳ × đơn giá tồn."
          />

          {profile.showStockCount ? (
            <FormRow sx={{ alignItems: 'flex-start' }}>
              <FormQtyField<StockFormValues>
                name="countedQty"
                label="Tồn thực tế (kiểm kê)"
                placeholder="Bỏ trống nếu chưa kiểm kê"
                helperText={
                  countedQty.trim() === ''
                    ? 'Bỏ trống = xoá kết quả kiểm kê.'
                    : `Chênh lệch so với tồn sổ sách (${formatQty(qty)}): ${
                        countedDiff > 0 ? '+' : ''
                      }${countedDiff}`
                }
              />
              <FormTextField<StockFormValues>
                name="countedAt"
                label="Ngày kiểm kê"
                type="date"
                disabled={countedQty.trim() === ''}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </FormRow>
          ) : null}

          <NxtGrid
            openingQty={openingQty}
            openingAmount={openingAmount}
            inQty={inQty}
            inAmount={inAmount}
            outQty={outQty}
            outAmount={outAmount}
            qty={qty}
            amount={amount}
            onOpeningQty={(value) => form.setValue('openingQty', value)}
          />
          <Typography variant="body2" sx={{ color: '#1e8449', fontWeight: 600, px: 0.25 }}>
            Tồn kho = Tồn đầu kỳ + Nhập − Xuất (cố định). SL {formatQty(qty)} · TT{' '}
            {formatMoney(amount)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {row ? 'Lưu' : 'Thêm'}
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  )
}

/** Ô chọn màu kèm chấm màu — cần renderOption riêng nên không dùng AutocompleteInput. */
function ColorField({
  colors,
  value,
  onChange,
  onBlur,
}: {
  colors: LookupItem[]
  value: string
  onChange: (value: string) => void
  onBlur: () => void
}) {
  const selected = colors.find((item) => item.id === value) ?? null
  return (
    <Autocomplete
      sx={{ flex: 1, minWidth: 0 }}
      options={colors}
      value={selected}
      onChange={(_, next) => onChange(next?.id ?? '')}
      onBlur={onBlur}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, next) => option.id === next.id}
      filterOptions={(options, state) => {
        const q = state.inputValue.trim().toLowerCase()
        if (!q) return options
        return options.filter(
          (item) =>
            item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q),
        )
      }}
      disablePortal
      autoHighlight
      openOnFocus
      size="small"
      noOptionsText="Không có màu khớp"
      renderOption={(props, option) => {
        const { key, ...rest } = props
        return (
          <Box component="li" key={key} {...rest} sx={{ gap: 1 }}>
            <ColorSwatch code={option.code} name={option.name} />
            {option.name}
          </Box>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Màu sắc"
          placeholder="Tìm màu…"
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <>
                  {selected ? (
                    <Box sx={{ display: 'flex', ml: 0.5, mr: 0.75 }}>
                      <ColorSwatch code={selected.code} name={selected.name} />
                    </Box>
                  ) : null}
                  {params.slotProps.input.startAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  )
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function ColorSwatch({ code, name }: { code?: string | null; name?: string | null }) {
  return (
    <Box
      component="span"
      sx={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        bgcolor: colorHex(code, name),
        border: '1px solid rgba(0,0,0,0.28)',
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  )
}

function NxtGrid({
  openingQty,
  openingAmount,
  inQty,
  inAmount,
  outQty,
  outAmount,
  qty,
  amount,
  onOpeningQty,
}: {
  openingQty: string
  openingAmount: string
  inQty: string
  inAmount: string
  outQty: string
  outAmount: string
  qty: string
  amount: string
  onOpeningQty: (value: string) => void
}) {
  const cols = [
    { key: 'open', label: 'Tồn đầu kỳ', bg: '#edf1f4', note: 'TT = SL × đơn giá tồn' },
    { key: 'in', label: 'Nhập', bg: '#e4f0e8', note: 'Tổng phiếu nhập (Σ SL × đơn giá)' },
    { key: 'out', label: 'Xuất', bg: '#f3ebe7', note: 'Tổng phiếu xuất theo ngày' },
    { key: 'stock', label: 'Tồn kho', bg: '#d6e3ee', note: 'Công thức cố định' },
  ] as const

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '72px repeat(4, minmax(0, 1fr))',
          border: '1px solid #b7c2cc',
          borderRadius: 1,
          overflow: 'hidden',
          '& > *': {
            borderRight: '1px solid #b7c2cc',
            borderBottom: '1px solid #b7c2cc',
            px: 1,
            py: 0.85,
            minWidth: 0,
          },
          '& > *:nth-of-type(5n)': { borderRight: 'none' },
          '& > *:nth-last-of-type(-n + 5)': { borderBottom: 'none' },
        }}
      >
        <Box sx={{ bgcolor: '#f4f6f7', fontWeight: 700, fontSize: 12, color: 'text.secondary' }} />
        {cols.map((col) => (
          <Box
            key={col.key}
            sx={{
              bgcolor: col.bg,
              fontWeight: 700,
              fontSize: 13,
              textAlign: 'center',
              color: col.key === 'stock' ? 'primary.main' : 'text.primary',
              lineHeight: 1.25,
            }}
          >
            {col.label}
            {col.note ? (
              <Box
                component="span"
                sx={{
                  display: 'block',
                  fontWeight: 500,
                  fontSize: 11,
                  color: 'text.secondary',
                  fontStyle: 'italic',
                  mt: 0.25,
                }}
              >
                {col.note}
              </Box>
            ) : null}
          </Box>
        ))}

        <Box
          sx={{
            bgcolor: '#f4f6f7',
            fontSize: 12,
            fontWeight: 700,
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          SL
        </Box>
        <NxtCell
          value={formatQtyInput(openingQty)}
          editable
          onChange={(v) => onOpeningQty(parseQtyInput(v))}
        />
        <NxtCell value={formatQty(inQty)} />
        <NxtCell value={formatQty(outQty)} />
        <NxtCell value={formatQty(qty)} />

        <Box
          sx={{
            bgcolor: '#f4f6f7',
            fontSize: 12,
            fontWeight: 700,
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            borderBottom: 'none',
          }}
        >
          TT
        </Box>
        <NxtCell value={formatMoney(openingAmount || '0')} />
        <NxtCell value={formatMoney(inAmount)} />
        <NxtCell value={formatMoney(outAmount)} />
        <NxtCell value={formatMoney(amount || '0')} />
      </Box>
    </Box>
  )
}

function NxtCell({
  value,
  editable,
  onChange,
}: {
  value: string
  editable?: boolean
  onChange?: (value: string) => void
}) {
  if (!editable) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          fontVariantNumeric: 'tabular-nums',
          color: 'text.secondary',
          bgcolor: '#fbfcfd',
        }}
      >
        {value}
      </Box>
    )
  }
  return (
    <Box sx={{ p: '4px 6px !important', bgcolor: '#fff' }}>
      <TextField
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        size="small"
        fullWidth
        hiddenLabel
        slotProps={{
          htmlInput: {
            inputMode: 'decimal',
            style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '6px 8px' },
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root': { bgcolor: '#fff' },
          '& fieldset': { borderColor: '#d5dbe0' },
        }}
      />
    </Box>
  )
}
