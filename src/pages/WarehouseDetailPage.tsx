import { useEffect, useMemo } from 'react'
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
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  formatMoney,
  formatQty,
  getInventoryLookupsApi,
  getWarehouseStockApi,
  qtyFromApi,
  updateWarehouseStockApi,
  createWarehouseStockApi,
  type AvailabilityCode,
  type LookupItem,
  type MetalKindCode,
  type StockRow,
  type StockTotals,
  type UpdateStockPayload,
} from '../api/inventory'
import { colorHex, COLOR_CATALOG } from '../warehouses/colorPalette'
import { getLocationsApi } from '../api/locations'
import {
  DataTable,
  Form,
  FormMoneyField,
  FormSearchSelect,
  FormTextField,
  FILTER_FIELD_SX,
  PageHeader,
  PanelToolbar,
  RowActions,
  SelectInput,
  SummaryTile,
  type Column,
  type ColumnGroup,
  type SelectOption,
} from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { paginate, useTableParams } from '../hooks/useTableParams'
import { SearchSelect, type SearchSelectOption } from '../warehouses/SearchSelect'
import { StockFigureGrid } from '../warehouses/StockFigureGrid'
import { BtpWaitingPanel } from '../warehouses/BtpWaitingPanel'
import { StockInboundPanel } from '../warehouses/StockInboundPanel'
import { StockOutboundPanel } from '../warehouses/StockOutboundPanel'
import {
  METAL_KINDS,
  WAREHOUSE_SECTIONS,
  materialTypesFor,
  stockProfile,
  stockWarehouseCode,
  warehouseByCode,
  warehousePath,
  warehouseSectionByCode,
  type StockProfile,
  type WarehouseSectionCode,
} from '../warehouses/catalog'

const LEGACY_BINS = new Set(['bac', 'da'])

export function WarehouseDetailPage() {
  const { code, bin, section } = useParams<{
    code: string
    bin?: string
    section?: string
  }>()

  if (code === 'ban-thanh-pham' || (code === 'btp-cho-vao-da' && (bin || section))) {
    return <Navigate to="/kho/btp-cho-vao-da" replace />
  }

  if (code === 'nvl-chinh' && bin && LEGACY_BINS.has(bin)) {
    const next = section === 'btp' || !section ? 'ton' : section
    return <Navigate to={`/kho/nvl-chinh/${next}`} replace />
  }

  const warehouse = warehouseByCode(code ?? '')
  if (!warehouse) {
    return <Navigate to="/kho" replace />
  }

  const sectionCode = warehouse.sections
    ? (bin as WarehouseSectionCode | undefined)
    : (section as WarehouseSectionCode | undefined)
  const activeSection = warehouseSectionByCode(sectionCode)

  if (section === 'gia' || bin === 'gia') {
    return <Navigate to="/kho/nvl-chinh/ton" replace />
  }

  if (warehouse.sections && !activeSection) {
    return <Navigate to={warehousePath(warehouse, 'ton')} replace />
  }

  const stockKey = stockWarehouseCode(warehouse)
  const title = activeSection ? `${activeSection.name} — ${warehouse.shortName}` : warehouse.name
  const subtitle = warehouse.description

  return (
    <Stack
      spacing={1.25}
      sx={{
        flex: { md: 1 },
        minHeight: { md: 0 },
        height: { md: '100%' },
        overflow: { xs: 'visible', md: 'hidden' },
      }}
    >
      <PageHeader
        title={title}
        subtitle={subtitle}
        compactSubtitle
        breadcrumbs={
          <Breadcrumbs>
            <Link component={RouterLink} to="/kho" underline="hover" color="inherit">
              Kho
            </Link>
            {activeSection ? (
              <Typography color="text.secondary">{warehouse.shortName}</Typography>
            ) : null}
            <Typography color="text.primary">
              {activeSection?.name ?? warehouse.shortName}
            </Typography>
          </Breadcrumbs>
        }
      />

      {warehouse.sections && activeSection ? (
        <Tabs
          value={activeSection.code}
          variant="fullWidth"
          sx={{
            display: { md: 'none' },
            flexShrink: 0,
            minHeight: 40,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': { minHeight: 40, py: 0 },
          }}
        >
          {WAREHOUSE_SECTIONS.map((s) => (
            <Tab
              key={s.code}
              value={s.code}
              label={s.name}
              component={RouterLink}
              to={warehousePath(warehouse, s.code)}
            />
          ))}
        </Tabs>
      ) : null}

      {warehouse.code === 'btp-cho-vao-da' ? (
        <BtpWaitingPanel warehouseCode={warehouse.code} />
      ) : activeSection?.code === 'nhap' ? (
        <StockInboundPanel warehouseCode={stockKey} />
      ) : activeSection?.code === 'xuat' ? (
        <StockOutboundPanel warehouseCode={stockKey} />
      ) : (
        <StockOnHandTable warehouseCode={stockKey} />
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
}
/** Bốn nhóm tiêu đề bậc 1 của bảng tồn: mỗi nhóm gộp một cặp SL / TT. */
const STOCK_GROUPS = {
  open: { key: 'open', label: 'Tồn đầu kỳ', headSx: groupHead.open },
  in: { key: 'in', label: 'Nhập', headSx: groupHead.in },
  out: { key: 'out', label: 'Xuất', headSx: groupHead.out },
  stock: { key: 'stock', label: 'Tồn kho', headSx: groupHead.stock },
} satisfies Record<string, ColumnGroup>

const groupBody = {
  open: { ...split, ...numCell, bgcolor: '#f7f9fb' },
  in: { ...split, ...numCell, bgcolor: '#f2f8f4' },
  out: { ...split, ...numCell, bgcolor: '#faf6f4' },
  stock: { ...split, ...numCell, bgcolor: '#eaf0f6', fontWeight: 700 },
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
  const dialog = useCrudDialog<StockRow>()
  // Tách sẵn callback ổn định để useMemo cột không chạy lại mỗi render.
  const { openEdit } = dialog
  const table = useTableParams({
    pageSize: 8,
    filters: { shape: '', location: '', stone: '', kind: '', status: 'ALL' },
  })
  const { params } = table

  const stock = useQuery({
    queryKey: ['warehouse-stock', warehouseCode],
    queryFn: () => getWarehouseStockApi(warehouseCode),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  })
  const lookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  })
  const locationSlots = useQuery({
    queryKey: ['warehouse-locations', warehouseCode],
    queryFn: () => getLocationsApi(warehouseCode),
    staleTime: 20_000,
  })

  const items = useMemo(() => stock.data?.items ?? [], [stock.data?.items])

  const statusCounts = useMemo(() => {
    const counts = { IN_STOCK: 0, LOW: 0, OUT_OF_STOCK: 0 }
    for (const row of items) counts[row.availability] += 1
    return counts
  }, [items])

  // Gộp ô kệ đã cấu hình với vị trí đang gán trên NVL, phòng khi có mã lạ.
  const locationOptions = useMemo(() => {
    const names = new Set<string>()
    for (const slot of locationSlots.data?.items ?? []) names.add(slot.code)
    for (const row of items) {
      const loc = row.locationCode?.trim()
      if (loc) names.add(loc)
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map((name) => ({ id: name, name }))
  }, [items, locationSlots.data?.items])

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
    const q = params.search.trim().toLowerCase()
    return items.filter((row) => {
      if (q && !row.name.toLowerCase().includes(q) && !(row.sku ?? '').toLowerCase().includes(q)) {
        return false
      }
      if (params.shape && row.shapeId !== params.shape && row.shape !== params.shape) return false
      if (params.location && (row.locationCode ?? '') !== params.location) return false
      if (params.stone && row.materialTypeId !== params.stone && row.materialType !== params.stone) {
        return false
      }
      if (params.kind && row.metalKind !== params.kind) return false
      if (params.status !== 'ALL' && row.availability !== params.status) return false
      return true
    })
  }, [items, params.search, params.shape, params.location, params.stone, params.kind, params.status])

  const filtered = table.hasFilters
  const totals = filtered ? sumStockTotals(visible) : stock.data?.totals
  const pageCount = Math.max(1, Math.ceil(visible.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize

  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpdateStockPayload }) =>
      id
        ? updateWarehouseStockApi(warehouseCode, id, payload)
        : createWarehouseStockApi(warehouseCode, payload),
    onSuccess: async (row, input) => {
      toast.success(input.id ? 'Đã cập nhật NVL' : 'Đã thêm NVL')
      dialog.close()
      // Dòng mới nằm cuối danh sách nên nhảy tới trang chứa nó.
      if (!input.id) table.setPage(Math.ceil((visible.length + 1) / params.pageSize))
      queryClient.setQueryData(
        ['warehouse-stock', warehouseCode],
        (current: { items: StockRow[]; totals: StockTotals } | undefined) => {
          if (!current) return current
          const next = input.id
            ? current.items.map((item) => (item.id === row.id ? row : item))
            : [...current.items, row]
          return { ...current, items: next, totals: sumStockTotals(next) }
        },
      )
      void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      void queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', warehouseCode] })
      void queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', warehouseCode] })
      void queryClient.invalidateQueries({ queryKey: ['warehouse-locations', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo(() => stockColumns(profile, openEdit), [profile, openEdit])

  // Bảng hẹp lại khi kho không dùng vị trí / hình dạng / màu.
  const minWidth =
    1480 -
    (profile.showLocation ? 0 : 110) -
    (profile.showSku ? 0 : 130) -
    (profile.showShapeColor ? 0 : 250)

  return (
    <Stack spacing={1.25} sx={{ flex: { md: 1 }, minHeight: { md: 0 }, overflow: { xs: 'visible', md: 'hidden' } }}>
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
          filtered ? 'Không có NVL khớp bộ lọc.' : 'Chưa có hàng tồn. Bấm Thêm NVL để tạo tên hàng.'
        }
        variant="grid"
        minWidth={minWidth}
        cardBreakpoint="md"
        showIndex
        indexOffset={indexOffset}
        rowsLabel="NVL"
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
            profile={profile}
            onEdit={() => openEdit(row)}
          />
        )}
        toolbar={
          <PanelToolbar
            search={params.search}
            onSearchChange={table.setSearch}
            searchPlaceholder="Tìm tên NVL hoặc mã…"
            filterCount={table.filterCount}
            onClearFilters={table.reset}
            createLabel="Thêm NVL"
            onCreate={dialog.openCreate}
            filters={
              <>
                <SearchSelect
                  label="Hình dạng"
                  valueId={params.shape}
                  options={lookups.data?.shapes ?? []}
                  allowClear
                  size="small"
                  disablePortal={false}
                  placeholder="Tìm hình dạng…"
                  sx={FILTER_FIELD_SX}
                  onChange={(id) => table.setFilter({ shape: id })}
                />
                <SearchSelect
                  label="Vị trí"
                  valueId={params.location}
                  options={locationOptions}
                  allowClear
                  size="small"
                  disablePortal={false}
                  placeholder="Tìm vị trí…"
                  sx={FILTER_FIELD_SX}
                  onChange={(id) => table.setFilter({ location: id })}
                />
                <SearchSelect
                  label="Loại đá"
                  valueId={params.stone}
                  options={lookups.data?.materialTypes ?? []}
                  allowClear
                  size="small"
                  disablePortal={false}
                  placeholder="Tìm loại đá…"
                  sx={FILTER_FIELD_SX}
                  onChange={(id) => table.setFilter({ stone: id })}
                />
                <SearchSelect
                  label="Phân loại"
                  valueId={params.kind}
                  options={METAL_KINDS.map((item) => ({ id: item.code, name: item.name }))}
                  allowClear
                  size="small"
                  disablePortal={false}
                  placeholder="Tìm phân loại…"
                  sx={FILTER_FIELD_SX}
                  onChange={(id) => table.setFilter({ kind: id })}
                />
                <SelectInput
                  label="Trạng thái"
                  options={statusOptions}
                  value={params.status}
                  onChange={(value) => table.setFilter({ status: String(value) || 'ALL' })}
                  sx={FILTER_FIELD_SX}
                  fullWidth={false}
                />
              </>
            }
          />
        }
      />

      <StockEditDialog
        open={dialog.open}
        row={dialog.row}
        warehouseCode={warehouseCode}
        profile={profile}
        saving={save.isPending}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) => save.mutate({ id: dialog.row?.id, payload })}
      />
    </Stack>
  )
}

/**
 * Một dòng tồn kho ở dạng thẻ (dưới `md`). Phần số liệu dùng lại
 * [StockFigureGrid](../warehouses/StockFigureGrid.tsx) như hộp thoại sửa NVL,
 * nên 4 nhóm SL / TT giữ nguyên cấu trúc thay vì bị trải phẳng thành 8 dòng.
 */
function StockCard({
  row,
  index,
  profile,
  onEdit,
}: {
  row: StockRow
  index: number
  profile: StockProfile
  onEdit: () => void
}) {
  const meta = [
    profile.showLocation ? row.locationCode : null,
    profile.showSku ? row.sku : null,
    profile.showShapeColor ? row.shape : null,
    profile.showShapeColor ? row.color : null,
  ].filter(Boolean) as string[]

  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            #{index}
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
            {row.name}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.25, alignItems: 'center' }}
          >
            {meta.map((value) => (
              <Typography key={value} variant="caption" color="text.secondary">
                {value}
              </Typography>
            ))}
            <Chip
              size="small"
              variant="outlined"
              color={availabilityColor(row.availability)}
              label={row.availabilityLabel}
            />
          </Stack>
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <RowActions onEdit={onEdit} />
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

      <Stack
        direction="row"
        spacing={2}
        sx={{ flexWrap: 'wrap', gap: 1, mt: 1.25, color: 'text.secondary' }}
      >
        <Typography variant="caption">Đơn vị: {row.unit}</Typography>
        <Typography variant="caption">Phân loại: {row.metalKindLabel ?? '—'}</Typography>
        <Typography variant="caption">
          {profile.typeLabel}: {row.materialType ?? '—'}
        </Typography>
      </Stack>
    </Paper>
  )
}

function stockColumns(
  profile: StockProfile,
  onEdit: (row: StockRow) => void,
): Column<StockRow>[] {
  const columns: Column<StockRow>[] = []

  if (profile.showLocation) {
    columns.push({ key: 'locationCode', card: 'meta', header: 'Vị trí', render: (row) => row.locationCode ?? '—' })
  }
  if (profile.showSku) {
    columns.push({
      key: 'sku',
      card: 'meta',
      header: 'Mã NVL',
      cellSx: { fontWeight: 700, whiteSpace: 'nowrap' },
      render: (row) => row.sku ?? '—',
    })
  }
  if (profile.showShapeColor) {
    columns.push(
      { key: 'shape', card: 'meta', header: 'Hình dạng', render: (row) => row.shape ?? '—' },
      { key: 'color', card: 'meta', header: 'Màu sắc', render: (row) => row.color ?? '—' },
    )
  }

  columns.push(
    { key: 'name', card: 'title', header: 'Tên NVL', cellSx: { minWidth: 220 } },
    { key: 'unit', header: 'Đơn vị', align: 'center' },
    {
      key: 'openingQty',
      header: 'SL',
      group: STOCK_GROUPS.open,
      headSx: groupHead.open,
      align: 'right',
      cellSx: groupBody.open,
      render: (row) => formatQty(row.openingQty),
    },
    {
      key: 'openingAmount',
      header: 'TT',
      group: STOCK_GROUPS.open,
      headSx: { bgcolor: groupHead.open.bgcolor },
      align: 'right',
      cellSx: { ...numCell, bgcolor: groupBody.open.bgcolor },
      render: (row) => formatMoney(row.openingAmount),
    },
    {
      key: 'inQty',
      header: 'SL',
      group: STOCK_GROUPS.in,
      headSx: groupHead.in,
      align: 'right',
      cellSx: groupBody.in,
      render: (row) => formatQty(row.inQty),
    },
    {
      key: 'inAmount',
      header: 'TT',
      group: STOCK_GROUPS.in,
      headSx: { bgcolor: groupHead.in.bgcolor },
      align: 'right',
      cellSx: { ...numCell, bgcolor: groupBody.in.bgcolor },
      render: (row) => formatMoney(row.inAmount),
    },
    {
      key: 'outQty',
      header: 'SL',
      group: STOCK_GROUPS.out,
      headSx: groupHead.out,
      align: 'right',
      cellSx: groupBody.out,
      render: (row) => formatQty(row.outQty),
    },
    {
      key: 'outAmount',
      header: 'TT',
      group: STOCK_GROUPS.out,
      headSx: { bgcolor: groupHead.out.bgcolor },
      align: 'right',
      cellSx: { ...numCell, bgcolor: groupBody.out.bgcolor },
      render: (row) => formatMoney(row.outAmount),
    },
    {
      key: 'qty',
      header: 'SL',
      group: STOCK_GROUPS.stock,
      headSx: groupHead.stock,
      align: 'right',
      cellSx: groupBody.stock,
      render: (row) => formatQty(row.qty),
    },
    {
      key: 'amount',
      header: 'TT',
      group: STOCK_GROUPS.stock,
      headSx: { bgcolor: groupHead.stock.bgcolor, color: 'primary.main' },
      align: 'right',
      cellSx: { ...groupBody.stock, borderLeft: '1px solid #b7c2cc' },
      render: (row) => formatMoney(row.amount),
    },
  )

  columns.push(
    { key: 'metalKindLabel', header: 'Phân loại', render: (row) => row.metalKindLabel ?? '—' },
    { key: 'materialType', header: profile.typeLabel, render: (row) => row.materialType ?? '—' },
    {
      key: 'availability',
      card: 'meta',
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
      card: 'actions',
      header: 'Hành động',
      align: 'center',
      render: (row) => <RowActions onEdit={() => onEdit(row)} />,
    },
  )

  return columns
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
        <SummaryTile title="Tồn đầu kỳ" tone="open" rows={statRows(totals.openingQty, totals.openingAmount)} />
        <SummaryTile title="Nhập" tone="in" rows={statRows(totals.inQty, totals.inAmount)} />
        <SummaryTile title="Xuất" tone="out" rows={statRows(totals.outQty, totals.outAmount)} />
        <SummaryTile title="Tồn kho" tone="stock" rows={statRows(totals.qty, totals.amount)} />
      </Box>
    </Paper>
  )
}

/** Hai dòng SL / TT của một ô tổng hợp. */
function statRows(sl: string, tt: string) {
  return [
    { label: 'Số lượng (SL):', value: formatQty(sl) },
    { label: 'Thành tiền (TT):', value: formatMoney(tt) },
  ]
}

type StockFormValues = {
  locationCode: string
  sku: string
  shapeId: string
  colorId: string
  name: string
  unitId: string
  materialTypeId: string
  metalKind: string
  openingQty: string
  stockUnitPrice: string
  inQty: string
  inAmount: string
  outQty: string
  outAmount: string
}

const EMPTY_STOCK: StockFormValues = {
  locationCode: '',
  sku: '',
  shapeId: '',
  colorId: '',
  name: '',
  unitId: '',
  materialTypeId: '',
  metalKind: 'SILVER',
  openingQty: '0',
  stockUnitPrice: '',
  inQty: '0',
  inAmount: '0',
  outQty: '0',
  outAmount: '0',
}

function StockEditDialog({
  open,
  row,
  warehouseCode,
  profile,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  row: StockRow | null
  warehouseCode: string
  profile: StockProfile
  saving: boolean
  onClose: () => void
  onExited: () => void
  onSave: (payload: UpdateStockPayload) => void
}) {
  const form = useForm<StockFormValues>({ defaultValues: EMPTY_STOCK })
  const lookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    enabled: open,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  })
  const locationSlots = useQuery({
    queryKey: ['warehouse-locations', warehouseCode],
    queryFn: () => getLocationsApi(warehouseCode),
    enabled: open,
    staleTime: 20_000,
  })

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
            metalKind: row.metalKind ?? '',
            openingQty: qtyFromApi(row.openingQty),
            stockUnitPrice: moneyDigitsFromApi(row.stockUnitPrice),
            inQty: qtyFromApi(row.inQty),
            inAmount: row.inAmount,
            outQty: qtyFromApi(row.outQty),
            outAmount: row.outAmount,
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

  const locationCode = form.watch('locationCode')
  const openingQty = form.watch('openingQty')
  const stockUnitPrice = form.watch('stockUnitPrice')
  const inQty = form.watch('inQty')
  const inAmount = form.watch('inAmount')
  const outQty = form.watch('outQty')
  const outAmount = form.watch('outAmount')
  const openingAmount = String(Math.round((Number(openingQty) || 0) * (Number(stockUnitPrice) || 0)))
  const qty = String((Number(openingQty) || 0) + (Number(inQty) || 0) - (Number(outQty) || 0))
  const amount = String(
    Math.round((Number(openingAmount) || 0) + (Number(inAmount) || 0) - (Number(outAmount) || 0)),
  )

  // Chỉ gợi ý ô kệ còn trống, trừ ô đang gán cho chính NVL này.
  const locationOptions: SearchSelectOption[] = useMemo(() => {
    const slots = locationSlots.data?.items ?? []
    const opts = slots
      .filter((slot) => !slot.occupied || slot.code === locationCode)
      .map((slot) => ({
        id: slot.code,
        name: slot.code,
        secondary: slot.occupied ? (slot.materialName ?? 'Đang dùng') : 'Trống',
      }))
    if (locationCode && !opts.some((item) => item.id === locationCode)) {
      opts.unshift({ id: locationCode, name: locationCode, secondary: 'Hiện tại' })
    }
    return opts
  }, [locationCode, locationSlots.data?.items])

  const shapeOptions: SearchSelectOption[] = lookups.data?.shapes ?? []
  const unitOptions: SearchSelectOption[] = lookups.data?.units ?? []
  const typeOptions: SearchSelectOption[] = materialTypesFor(
    profile,
    lookups.data?.materialTypes ?? [],
  )
  const kindOptions: SearchSelectOption[] = METAL_KINDS.map((item) => ({
    id: item.code,
    name: item.name,
  }))

  function submit(values: StockFormValues) {
    onSave({
      ...(profile.showSku ? { sku: values.sku } : {}),
      ...(profile.showLocation ? { locationCode: values.locationCode } : {}),
      name: values.name.trim(),
      unitId: values.unitId,
      shapeId: profile.showShapeColor ? values.shapeId || null : null,
      colorId: profile.showShapeColor ? values.colorId || null : null,
      materialTypeId: values.materialTypeId || null,
      metalKind: values.metalKind ? (values.metalKind as MetalKindCode) : null,
      openingQty: values.openingQty,
      stockUnitPrice: values.stockUnitPrice || '0',
    })
  }

  const fullScreen = useIsMobile()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={fullScreen}
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
              sx={{ flex: 2, minWidth: 0 }}
            />
            {profile.showLocation ? (
              <FormSearchSelect<StockFormValues>
                name="locationCode"
                label="Vị trí"
                options={locationOptions}
                allowClear
                placeholder="Tìm vị trí trống…"
                noOptionsText="Chưa có vị trí. Cấu hình ở Cấu hình → Vị trí."
                sx={{ flex: 1, minWidth: 0 }}
              />
            ) : null}
            {profile.showSku ? (
              <FormTextField<StockFormValues>
                name="sku"
                label="Mã NVL"
                sx={{ flex: 1, minWidth: 0 }}
              />
            ) : null}
            <FormMoneyField<StockFormValues>
              name="stockUnitPrice"
              label="Đơn giá tồn"
              sx={{ flex: 1, minWidth: 0, maxWidth: { sm: 180 } }}
              slotProps={{
                htmlInput: { inputMode: 'numeric', style: { textAlign: 'right' } },
              }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {profile.showShapeColor ? (
              <>
                <FormSearchSelect<StockFormValues>
                  name="shapeId"
                  label="Hình dạng"
                  options={shapeOptions}
                  allowClear
                  placeholder="Tìm hình dạng…"
                  sx={{ flex: 1, minWidth: 0 }}
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
            <FormSearchSelect<StockFormValues>
              name="unitId"
              label="Đơn vị"
              options={unitOptions}
              required
              placeholder="Tìm đơn vị…"
              sx={{ flex: 1, minWidth: 0 }}
            />
            <FormSearchSelect<StockFormValues>
              name="metalKind"
              label="Phân loại"
              options={kindOptions}
              allowClear
              placeholder="Tìm phân loại…"
              sx={{ flex: 1, minWidth: 0 }}
            />
            <FormSearchSelect<StockFormValues>
              name="materialTypeId"
              label={profile.typeLabel}
              options={typeOptions}
              allowClear
              placeholder="Tìm loại đá…"
              sx={{ flex: 1, minWidth: 0 }}
            />
          </Stack>

          <StockFigureGrid
            values={{ openingQty, openingAmount, inQty, inAmount, outQty, outAmount, qty, amount }}
            notes
            editableOpeningQty={{
              value: openingQty,
              onChange: (value) => form.setValue('openingQty', value),
            }}
          />
          <Typography variant="body2" sx={{ color: '#1e8449', fontWeight: 600, px: 0.25 }}>
            Tồn kho = Tồn đầu kỳ + Nhập − Xuất. SL {formatQty(qty)} · TT {formatMoney(amount)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.25, mt: -1 }}>
            TT đầu kỳ = SL × đơn giá tồn. Nhập / xuất / tồn kho lấy từ phiếu, không sửa tay.
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

/** Ô chọn màu kèm chấm màu — cần renderOption riêng nên không dùng SearchSelect. */
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

function moneyDigitsFromApi(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return String(Math.round(n))
}

