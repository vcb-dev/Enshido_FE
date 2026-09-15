import { memo, useEffect, useMemo, useState, type FormEvent } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
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
  getInventoryLookupsApi,
  getWarehouseStockApi,
  parseQtyInput,
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
import { listCatalogsApi } from '../api/catalogs'
import { getLocationsApi } from '../api/locations'
import {
  DataTable,
  Form,
  FormMoneyField,
  FormRow,
  FormSearchSelect,
  FormTextField,
  RowActions,
  type Column,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { paginate, useTableParams } from '../hooks/useTableParams'
import { CategorySelect } from '../warehouses/CategorySelect'
import { ColumnHeaderFilter, ColumnHeaderSearch } from '../warehouses/ColumnHeaderFilter'
import { SearchSelect, type SearchSelectOption } from '../warehouses/SearchSelect'
import { StockInboundPanel } from '../warehouses/StockInboundPanel'
import { StockOutboundPanel } from '../warehouses/StockOutboundPanel'
import {
  MOCK_IN,
  MOCK_OUT,
  MOCK_STOCK,
  CATEGORY_GROUPS,
  CONSUMABLE_CATEGORIES,
  catalogChildren,
  materialTypesFor,
  stockProfile,
  stockWarehouseCode,
  warehouseByCode,
  warehousePath,
  warehouseSectionByCode,
  withFallback,
  type StockMove,
  type StockProfile,
  type WarehouseSectionCode,
} from '../warehouses/catalog'
import {
  CATALOG_FILTER_DEFAULTS,
  hasActiveCatalogFilters,
  matchesCatalogFilters,
  uniqueFilterOptions,
} from '../warehouses/stockFilters'

const LEGACY_BINS = new Set(['bac', 'da'])

export function WarehouseDetailPage() {
  const { code, bin, section } = useParams<{
    code: string
    bin?: string
    section?: string
  }>()

  if (code === 'ban-thanh-pham') {
    return <Navigate to="/kho/btp-cho-vao-da/ton" replace />
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
  const items = MOCK_STOCK[stockKey] ?? []
  const title = activeSection ? `${activeSection.name} — ${warehouse.shortName}` : warehouse.name
  const subtitle = warehouse.description
  const useLiveMoves = Boolean(warehouse.sections)

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <Breadcrumbs sx={{ flexShrink: 0 }}>
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

      <Stack sx={{ flexShrink: 0 }}>
        <Typography variant="h5">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Stack>

      {activeSection?.code === 'nhap' ? (
        useLiveMoves ? (
          <StockInboundPanel warehouseCode={stockKey} />
        ) : (
          <MoveTable key={`${stockKey}-nhap`} kind="nhap" binCode={stockKey} items={items} />
        )
      ) : activeSection?.code === 'xuat' ? (
        useLiveMoves ? (
          <StockOutboundPanel warehouseCode={stockKey} />
        ) : (
          <MoveTable key={`${stockKey}-xuat`} kind="xuat" binCode={stockKey} items={items} />
        )
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
    filters: { ...CATALOG_FILTER_DEFAULTS, unit: '', color: '', status: 'ALL' },
  })
  const { params } = table

  const stock = useQuery({
    queryKey: ['warehouse-stock', warehouseCode],
    queryFn: () => getWarehouseStockApi(warehouseCode),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const lookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    enabled: stock.isSuccess,
  })

  const items = useMemo(() => stock.data?.items ?? [], [stock.data?.items])
  const nameSuggestions = useMemo(
    () => [...new Set(items.map((row) => row.name.trim()).filter(Boolean))],
    [items],
  )

  const statusCounts = useMemo(() => {
    const counts = { IN_STOCK: 0, LOW: 0, OUT_OF_STOCK: 0 }
    for (const row of items) counts[row.availability] += 1
    return counts
  }, [items])

  const locationOptions = useMemo(
    () => uniqueFilterOptions(items.map((row) => row.locationCode)),
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

  const unitOptions = useMemo(
    () => uniqueFilterOptions(items.map((row) => row.unit)),
    [items],
  )
  const colorOptions = useMemo(() => {
    const fromLookups = (lookups.data?.colors ?? []).map((item) => ({ id: item.id, name: item.name }))
    const extra = uniqueFilterOptions(items.map((row) => row.color)).filter(
      (item) => !fromLookups.some((row) => row.id === item.id || row.name === item.name),
    )
    return [...fromLookups, ...extra]
  }, [items, lookups.data?.colors])
  const typeFilterOptions = useMemo(() => {
    if (profile.typeCodes) {
      return lookups.data?.consumableCategories?.length
        ? lookups.data.consumableCategories
        : uniqueFilterOptions(items.map((row) => row.materialType ?? row.otherClass))
    }
    const fromLookups = [...(lookups.data?.materialTypes ?? []), ...(lookups.data?.otherClasses ?? [])]
    if (fromLookups.length) return fromLookups
    return uniqueFilterOptions(items.map((row) => row.materialType ?? row.otherClass))
  }, [lookups.data, profile.typeCodes, items])
  const kindFilterOptions = useMemo(() => {
    if (profile.showBtpCategory) {
      return withFallback(
        lookups.data?.btpCategories,
        uniqueFilterOptions(items.map((row) => row.otherClass)),
      )
    }
    return CATEGORY_GROUPS.map((item) => ({ id: item.code, name: item.name }))
  }, [lookups.data?.btpCategories, items, profile.showBtpCategory])
  const shapeOptions = useMemo(() => {
    const fromLookups = (lookups.data?.shapes ?? []).map((item) => ({ id: item.id, name: item.name }))
    const extra = uniqueFilterOptions(items.map((row) => row.shape)).filter(
      (item) => !fromLookups.some((row) => row.id === item.id || row.name === item.name),
    )
    return [...fromLookups, ...extra]
  }, [items, lookups.data?.shapes])
  const bodyMetalOptions = useMemo(
    () => withFallback(lookups.data?.bodyMetals, uniqueFilterOptions(items.map((row) => row.bodyMetal))),
    [items, lookups.data?.bodyMetals],
  )
  const productKindOptions = useMemo(
    () =>
      withFallback(lookups.data?.productKinds, uniqueFilterOptions(items.map((row) => row.productKind))),
    [items, lookups.data?.productKinds],
  )

  const visible = useMemo(() => {
    const nameQuery = params.search.trim().toLocaleLowerCase('vi')
    return items.filter((row) => {
      if (nameQuery && !row.name.toLocaleLowerCase('vi').includes(nameQuery)) return false
      if (params.unit && row.unit !== params.unit && row.unitId !== params.unit) return false
      if (params.color && row.colorId !== params.color && row.color !== params.color) return false
      if (!matchesCatalogFilters(row, params, profile)) return false
      if (
        profile.showStatus &&
        params.status !== 'ALL' &&
        row.availability !== params.status
      ) {
        return false
      }
      return true
    })
  }, [items, params.search, params.unit, params.color, params.shape, params.location, params.stone, params.kind, params.bodyMetal, params.productKind, params.status, profile])

  const filtered =
    Boolean(params.search.trim() || params.unit || params.color) ||
    hasActiveCatalogFilters(params) ||
    (profile.showStatus && params.status !== 'ALL')
  const totals = filtered ? sumStockTotals(visible) : stock.data?.totals
  const pageCount = Math.max(1, Math.ceil(visible.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize

  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpdateStockPayload }) =>
      id
        ? updateWarehouseStockApi(warehouseCode, id, payload)
        : createWarehouseStockApi(warehouseCode, payload),
    onMutate: (input) => {
      dialog.close()
      toast.success(input.id ? `Đã cập nhật ${profile.noun}` : `Đã thêm ${profile.noun}`)
      if (!input.id) table.setPage(Math.ceil((visible.length + 1) / params.pageSize))
    },
    onSuccess: (row, input) => {
      queryClient.setQueryData(
        ['warehouse-stock', warehouseCode],
        (current: { items: StockRow[]; totals: StockTotals } | undefined) => {
          if (!current) return current
          const next = input.id
            ? current.items.map((item) =>
                item.id === row.id ? { ...item, ...row, priceLayers: row.priceLayers ?? item.priceLayers } : item,
              )
            : [...current.items, row]
          return { ...current, items: next, totals: sumStockTotals(next) }
        },
      )
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
    (profile.showShapeColor ? 0 : 250) +
    (profile.showBodyMetal ? 140 : 0) +
    (profile.showProductKind ? 160 : 0) -
    (profile.showStatus ? 0 : 110)

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <DataTable
        columns={columns}
        rows={paginate(visible, page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={stock.isLoading}
        errorText={stock.error instanceof Error ? stock.error.message : undefined}
        emptyText={filtered ? profile.emptyFiltered : profile.emptyText}
        variant="grid"
        minWidth={minWidth}
        showIndex
        indexOffset={indexOffset}
        rowsLabel={profile.noun}
        page={page}
        pageSize={params.pageSize}
        total={visible.length}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sx={{ flex: 1 }}
        customHeader={
          <StockTableHeader
            profile={profile}
            totals={totals}
            nameSearch={params.search}
            onNameSearch={table.setSearch}
            location={
              profile.showLocation
                ? { valueId: params.location, options: locationOptions, onChange: (id) => table.setFilter({ location: id }) }
                : undefined
            }
            shape={
              profile.showShapeColor
                ? {
                    valueId: params.shape,
                    options: shapeOptions,
                    onChange: (id) => table.setFilter({ shape: id }),
                  }
                : undefined
            }
            color={
              profile.showShapeColor
                ? { valueId: params.color, options: colorOptions, onChange: (id) => table.setFilter({ color: id }) }
                : undefined
            }
            unit={{ valueId: params.unit, options: unitOptions, onChange: (id) => table.setFilter({ unit: id }) }}
            kind={
              profile.showNvlCategory || profile.showBtpCategory
                ? {
                    valueId: params.kind,
                    options: kindFilterOptions,
                    onChange: (id) => table.setFilter({ kind: id }),
                  }
                : undefined
            }
            type={
              profile.showType
                ? {
                    valueId: params.stone,
                    options: typeFilterOptions,
                    onChange: (id) => table.setFilter({ stone: id }),
                  }
                : undefined
            }
            bodyMetal={
              profile.showBodyMetal
                ? {
                    valueId: params.bodyMetal,
                    options: bodyMetalOptions,
                    onChange: (id) => table.setFilter({ bodyMetal: id }),
                  }
                : undefined
            }
            productKind={
              profile.showProductKind
                ? {
                    valueId: params.productKind,
                    options: productKindOptions,
                    onChange: (id) => table.setFilter({ productKind: id }),
                  }
                : undefined
            }
            status={
              profile.showStatus
                ? {
                    valueId: params.status === 'ALL' ? '' : params.status,
                    options: statusFilterOptions,
                    onChange: (id) => table.setFilter({ status: id || 'ALL' }),
                  }
                : undefined
            }
          />
        }
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

      <StockEditDialog
        open={dialog.open}
        row={dialog.row}
        warehouseCode={warehouseCode}
        profile={profile}
        nameSuggestions={nameSuggestions}
        saving={false}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) => {
          const id = dialog.row?.id
          dialog.close()
          save.mutate({ id, payload })
        }}
      />
    </Stack>
  )
}

type HeaderFilter = {
  valueId: string
  options: Array<{ id: string; name: string }>
  onChange: (id: string) => void
}

const FILTER_CELL_SX = {
  border: '0 !important',
  bgcolor: '#fff !important',
  backgroundColor: '#fff !important',
  py: '4px !important',
  px: '4px !important',
  whiteSpace: 'normal',
  overflow: 'visible',
  boxShadow: 'none',
} as const

const StockTableHeader = memo(function StockTableHeader({
  profile,
  totals,
  nameSearch,
  onNameSearch,
  location,
  shape,
  color,
  unit,
  kind,
  type,
  bodyMetal,
  productKind,
  status,
}: {
  profile: StockProfile
  totals?: StockTotals
  nameSearch: string
  onNameSearch: (value: string) => void
  location?: HeaderFilter
  shape?: HeaderFilter
  color?: HeaderFilter
  unit: HeaderFilter
  kind?: HeaderFilter
  type?: HeaderFilter
  bodyMetal?: HeaderFilter
  productKind?: HeaderFilter
  status?: HeaderFilter
}) {
  const showKind = profile.showNvlCategory || profile.showBtpCategory
  return (
    <>
      <TableRow className="col-filter-row" sx={{ bgcolor: '#fff' }}>
        <TableCell sx={FILTER_CELL_SX} />
        {profile.showLocation ? (
          <TableCell sx={FILTER_CELL_SX}>
            {location ? <ColumnHeaderFilter {...location} /> : null}
          </TableCell>
        ) : null}
        {profile.showSku ? <TableCell sx={FILTER_CELL_SX} /> : null}
        {profile.showShapeColor ? (
          <>
            <TableCell sx={FILTER_CELL_SX}>
              {shape ? <ColumnHeaderFilter {...shape} /> : null}
            </TableCell>
            <TableCell sx={FILTER_CELL_SX}>
              {color ? <ColumnHeaderFilter {...color} /> : null}
            </TableCell>
          </>
        ) : null}
        <TableCell sx={FILTER_CELL_SX}>
          <ColumnHeaderSearch
            value={nameSearch}
            onChange={onNameSearch}
            placeholder="Tìm tên…"
          />
        </TableCell>
        <TableCell sx={FILTER_CELL_SX}>
          <ColumnHeaderFilter {...unit} />
        </TableCell>
        <TableCell colSpan={2} sx={FILTER_CELL_SX} />
        <TableCell colSpan={2} sx={FILTER_CELL_SX} />
        <TableCell colSpan={2} sx={FILTER_CELL_SX} />
        <TableCell colSpan={2} sx={FILTER_CELL_SX} />
        {kind ? (
          <TableCell sx={FILTER_CELL_SX}>
            <ColumnHeaderFilter {...kind} />
          </TableCell>
        ) : null}
        {type ? (
          <TableCell sx={FILTER_CELL_SX}>
            <ColumnHeaderFilter {...type} />
          </TableCell>
        ) : null}
        {bodyMetal ? (
          <TableCell sx={FILTER_CELL_SX}>
            <ColumnHeaderFilter {...bodyMetal} />
          </TableCell>
        ) : null}
        {productKind ? (
          <TableCell sx={FILTER_CELL_SX}>
            <ColumnHeaderFilter {...productKind} />
          </TableCell>
        ) : null}
        {status ? (
          <TableCell sx={FILTER_CELL_SX}>
            <ColumnHeaderFilter {...status} />
          </TableCell>
        ) : null}
        <TableCell sx={FILTER_CELL_SX} />
      </TableRow>
      <TableRow>
        <TableCell rowSpan={2} align="center">
          STT
        </TableCell>
        {profile.showLocation ? <TableCell rowSpan={2}>Vị trí</TableCell> : null}
        {profile.showSku ? <TableCell rowSpan={2}>{profile.skuLabel}</TableCell> : null}
        {profile.showShapeColor ? (
          <>
            <TableCell rowSpan={2}>Hình dạng</TableCell>
            <TableCell rowSpan={2}>Màu sắc</TableCell>
          </>
        ) : null}
        <TableCell rowSpan={2}>{profile.nameLabel}</TableCell>
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
          Tồn
        </TableCell>
        {showKind ? (
          <TableCell rowSpan={2}>{profile.showBtpCategory ? 'Danh mục BTP' : 'Danh mục'}</TableCell>
        ) : null}
        {profile.showType ? <TableCell rowSpan={2}>{profile.typeLabel}</TableCell> : null}
        {profile.showBodyMetal ? <TableCell rowSpan={2}>Chất liệu</TableCell> : null}
        {profile.showProductKind ? <TableCell rowSpan={2}>Phân loại sản phẩm</TableCell> : null}
        {profile.showStatus ? (
          <TableCell rowSpan={2} align="center">
            Trạng thái
          </TableCell>
        ) : null}
        <TableCell rowSpan={2} align="center">
          Hành động
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell align="right" sx={groupHead.open}>
          {qtyLabel(totals?.openingQty)}
        </TableCell>
        <TableCell align="right" sx={{ bgcolor: groupHead.open.bgcolor }}>
          {ttLabel(totals?.openingAmount)}
        </TableCell>
        <TableCell align="right" sx={groupHead.in}>
          {qtyLabel(totals?.inQty)}
        </TableCell>
        <TableCell align="right" sx={{ bgcolor: groupHead.in.bgcolor }}>
          {ttLabel(totals?.inAmount)}
        </TableCell>
        <TableCell align="right" sx={groupHead.out}>
          {qtyLabel(totals?.outQty)}
        </TableCell>
        <TableCell align="right" sx={{ bgcolor: groupHead.out.bgcolor }}>
          {ttLabel(totals?.outAmount)}
        </TableCell>
        <TableCell align="right" sx={groupHead.stock}>
          {qtyLabel(totals?.qty)}
        </TableCell>
        <TableCell align="right" sx={{ bgcolor: groupHead.stock.bgcolor, color: 'primary.main' }}>
          {ttLabel(totals?.amount)}
        </TableCell>
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
    columns.push({ key: 'locationCode', header: 'Vị trí', render: (row) => row.locationCode ?? '—' })
  }
  if (profile.showSku) {
    columns.push({
      key: 'sku',
      header: profile.skuLabel,
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
    { key: 'name', header: profile.nameLabel, cellSx: { minWidth: 220 } },
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

  if (profile.showNvlCategory || profile.showBtpCategory) {
    columns.push({
      key: 'metalKindLabel',
      header: profile.showBtpCategory ? 'Danh mục BTP' : 'Danh mục',
      render: (row) =>
        profile.showBtpCategory ? (row.otherClass ?? '—') : (row.metalKindLabel ?? '—'),
    })
  }
  if (profile.showType) {
    columns.push({
      key: 'materialType',
      header: profile.typeLabel,
      render: (row) => {
        if (profile.typeCodes) {
          return row.otherClass ?? row.otherClassParent ?? row.materialType ?? '—'
        }
        return row.materialType ?? '—'
      },
    })
  }
  if (profile.showBodyMetal) {
    columns.push({
      key: 'bodyMetal',
      header: 'Chất liệu',
      render: (row) => row.bodyMetal ?? '—',
    })
  }
  if (profile.showProductKind) {
    columns.push({
      key: 'productKind',
      header: 'Phân loại sản phẩm',
      render: (row) => row.productKind ?? '—',
    })
  }
  if (profile.showStatus) {
    columns.push({
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
    })
  }
  columns.push(
    {
      key: 'actions',
      header: 'Hành động',
      align: 'center',
      render: (row) => <RowActions onEdit={() => onEdit(row)} />,
    },
  )

  return columns
}

function qtyLabel(value?: string) {
  return value == null ? 'SL' : `SL (${formatQty(value)})`
}

function ttLabel(value?: string) {
  return value == null ? 'TT' : `TT (${formatMoney(value)})`
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

function MoveTable({
  kind,
  binCode,
  items,
}: {
  kind: 'nhap' | 'xuat'
  binCode: string
  items: typeof MOCK_STOCK[string]
}) {
  const seed = kind === 'nhap' ? MOCK_IN[binCode] ?? [] : MOCK_OUT[binCode] ?? []
  const [rows, setRows] = useState<StockMove[]>(seed)
  const [open, setOpen] = useState(false)

  const label = kind === 'nhap' ? 'phiếu nhập' : 'phiếu xuất'

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => setOpen(true)}>
          {kind === 'nhap' ? 'Nhập NVL' : 'Xuất NVL'}
        </Button>
      </Stack>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Số phiếu</TableCell>
              <TableCell>Ngày</TableCell>
              <TableCell>Mã</TableCell>
              <TableCell>Tên hàng</TableCell>
              <TableCell align="right">Số lượng</TableCell>
              <TableCell>Đơn vị</TableCell>
              <TableCell>Ghi chú</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.docNo} hover>
                <TableCell>{row.docNo}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.sku}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell align="right">{row.qty}</TableCell>
                <TableCell>{row.unit}</TableCell>
                <TableCell>{row.note ?? '—'}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>Chưa có {label}.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

      <MoveDialog
        open={open}
        kind={kind}
        items={items}
        onClose={() => setOpen(false)}
        onSave={(move) => {
          setRows((prev) => [move, ...prev])
          setOpen(false)
          toast.success(`Đã tạo ${label}`)
        }}
      />
    </Stack>
  )
}

function MoveDialog({
  open,
  kind,
  items,
  onClose,
  onSave,
}: {
  open: boolean
  kind: 'nhap' | 'xuat'
  items: typeof MOCK_STOCK[string]
  onClose: () => void
  onSave: (move: StockMove) => void
}) {
  const [sku, setSku] = useState(items[0]?.sku ?? '')
  const [qty, setQty] = useState('0')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setSku(items[0]?.sku ?? '')
    setQty('0')
    setNote('')
  }, [open, items])

  const selected = useMemo(() => items.find((i) => i.sku === sku), [items, sku])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const amount = Number(qty)
    if (!selected || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Số lượng không hợp lệ')
      return
    }
    const prefix = kind === 'nhap' ? 'PN' : 'PX'
    onSave({
      docNo: `${prefix}-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().slice(0, 10),
      sku: selected.sku,
      name: selected.name,
      qty: amount,
      unit: selected.unit,
      note: note.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={onSubmit}>
        <DialogTitle>{kind === 'nhap' ? 'Nhập NVL' : 'Xuất NVL'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <SearchSelect
            label="Hàng"
            valueId={sku}
            options={items.map((item) => ({
              id: item.sku,
              name: `${item.sku} — ${item.name}`,
            }))}
            required
            placeholder="Tìm hàng…"
            sx={{ mt: 1 }}
            onChange={setSku}
          />
          <TextField
            label="Số lượng"
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
            slotProps={{ htmlInput: { min: 0.01, step: 'any' } }}
          />
          <TextField
            label="Ghi chú"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="contained">
            Lưu
          </Button>
        </DialogActions>
      </form>
    </Dialog>
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
  metalKind: string
  bodyMetalId: string
  productKindId: string
  btpCategoryId: string
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
  metalKind: '',
  bodyMetalId: '',
  productKindId: '',
  btpCategoryId: '',
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
  nameSuggestions,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  row: StockRow | null
  warehouseCode: string
  profile: StockProfile
  nameSuggestions: string[]
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
  const btpCatalogs = useQuery({
    queryKey: ['catalogs', 'OTHER'],
    queryFn: () => listCatalogsApi('OTHER'),
    enabled: open && (profile.showBtpCategory || profile.showBodyMetal || profile.showProductKind),
    staleTime: 5 * 60_000,
  })
  const nvlCatalogs = useQuery({
    queryKey: ['catalogs', 'CATALOG'],
    queryFn: () => listCatalogsApi('CATALOG'),
    enabled: open && Boolean(profile.typeCodes),
    staleTime: 5 * 60_000,
  })
  const locationSlots = useQuery({
    queryKey: ['warehouse-locations', warehouseCode],
    queryFn: () => getLocationsApi(warehouseCode),
    enabled: open,
    staleTime: 60_000,
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
            materialTypeId: row.otherClassId ?? row.materialTypeId ?? '',
            metalKind: row.otherClassId ? 'OTHER' : (row.metalKind ?? ''),
            bodyMetalId: row.bodyMetalId ?? '',
            productKindId: row.productKindId ?? '',
            btpCategoryId: row.otherClassId ?? '',
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

  const locationCode = form.watch('locationCode')
  const metalKind = form.watch('metalKind')
  const isStone = metalKind === 'STONE'
  const typeOptions: LookupItem[] = materialTypesFor(
    profile,
    lookups.data?.materialTypes ?? [],
  )
  const otherOptions: LookupItem[] = (lookups.data?.otherClasses ?? []).map((item) => ({
    ...item,
    metalKind: 'OTHER',
  }))
  const nestedTypes = typeOptions.filter((item) => item.metalKind)
  const categoryOptions = [...nestedTypes, ...otherOptions]
  const consumableOptions: LookupItem[] = withFallback(
    lookups.data?.consumableCategories,
    CONSUMABLE_CATEGORIES.flatMap((item) => {
      const hit = nvlCatalogs.data?.find((row) => row.code === item.code && !row.parentId)
      return hit ? [{ id: hit.id, code: hit.code, name: hit.name }] : []
    }),
  )

  useEffect(() => {
    if (!open || isStone) return
    form.setValue('shapeId', '')
  }, [open, isStone, form])

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
  const flatTypeOptions: SearchSelectOption[] = typeOptions

  function submit(values: StockFormValues) {
    if (profile.showBtpCategory) {
      onSave({
        name: values.name.trim(),
        unitId: values.unitId,
        materialTypeId: null,
        metalKind: null,
        otherClassName: null,
        btpCategoryId: values.btpCategoryId || null,
        bodyMetalId: values.bodyMetalId || null,
        productKindId: values.productKindId || null,
        openingQty: values.openingQty,
        stockUnitPrice: values.stockUnitPrice || '0',
      })
      return
    }
    const picked = categoryOptions.find((item) => item.id === values.materialTypeId)
    if (profile.typeCodes) {
      onSave({
        ...(profile.showLocation ? { locationCode: values.locationCode } : {}),
        name: values.name.trim(),
        unitId: values.unitId,
        materialTypeId: null,
        metalKind: null,
        otherClassName: null,
        otherClassId: values.materialTypeId || null,
        openingQty: values.openingQty,
        stockUnitPrice: values.stockUnitPrice || '0',
      })
      return
    }
    const isOther = picked?.metalKind === 'OTHER' || values.metalKind === 'OTHER'
    onSave({
      ...(profile.showLocation ? { locationCode: values.locationCode } : {}),
      name: values.name.trim(),
      unitId: values.unitId,
      shapeId: profile.showShapeColor && picked?.metalKind === 'STONE' ? values.shapeId || null : null,
      colorId: profile.showShapeColor ? values.colorId || null : null,
      materialTypeId: isOther ? null : values.materialTypeId || null,
      metalKind: isOther
        ? null
        : picked?.metalKind && picked.metalKind !== 'OTHER'
          ? picked.metalKind
          : values.metalKind
            ? (values.metalKind as MetalKindCode)
            : null,
      otherClassName: isOther ? picked?.name ?? null : null,
      openingQty: values.openingQty,
      stockUnitPrice: values.stockUnitPrice || '0',
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{ transition: { onExited } }}
    >
      <Form form={form} onSubmit={submit}>
        <DialogTitle sx={{ pb: 0.5, fontWeight: 700 }}>
          {row ? `Chỉnh sửa ${row.name || profile.noun}` : profile.createLabel}
        </DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 1,
            overflowX: 'hidden',
            '& .MuiFormLabel-asterisk': { color: 'error.main' },
          }}
        >
          <FormTextField<StockFormValues>
            name="name"
            label={profile.nameLabel}
            required
            autoFocus
            suggestions={nameSuggestions}
            helperText={row ? undefined : 'Gõ phần đầu — Tab hoặc click để nhận gợi ý'}
            sx={{ mt: 1.5 }}
          />
          <FormRow columns={3}>
            {profile.showBtpCategory ? (
              <FormSearchSelect<StockFormValues>
                name="bodyMetalId"
                label="Chất liệu"
                options={withFallback(
                  lookups.data?.bodyMetals,
                  catalogChildren(btpCatalogs.data, 'chat-lieu'),
                )}
                allowClear
                placeholder="Tìm chất liệu…"
              />
            ) : profile.typeCodes ? (
              <FormSearchSelect<StockFormValues>
                name="materialTypeId"
                label="Danh mục"
                options={consumableOptions}
                required
                placeholder="Chọn danh mục…"
                rules={{ required: 'Vui lòng chọn danh mục' }}
              />
            ) : nestedTypes.length ? (
              <Controller
                name="materialTypeId"
                control={form.control}
                rules={{ required: `Vui lòng chọn ${profile.categoryLabel}` }}
                render={({ field, fieldState }) => (
                  <CategorySelect
                    label={profile.categoryLabel}
                    valueId={field.value}
                    options={categoryOptions}
                    required
                    errorText={fieldState.error?.message}
                    onBlur={field.onBlur}
                    onChange={(typeId, kind) => {
                      field.onChange(typeId)
                      form.setValue('metalKind', kind)
                    }}
                  />
                )}
              />
            ) : (
              <FormSearchSelect<StockFormValues>
                name="materialTypeId"
                label={profile.typeLabel}
                options={flatTypeOptions}
                allowClear
                placeholder="Tìm nhóm…"
              />
            )}
            {profile.showBtpCategory ? (
              <FormSearchSelect<StockFormValues>
                name="btpCategoryId"
                label="Danh mục BTP"
                options={withFallback(
                  lookups.data?.btpCategories,
                  catalogChildren(btpCatalogs.data, 'danh-muc-btp'),
                )}
                allowClear
                placeholder="Tìm danh mục BTP…"
              />
            ) : null}
            {profile.showProductKind ? (
              <FormSearchSelect<StockFormValues>
                name="productKindId"
                label="Phân loại sản phẩm"
                options={withFallback(
                  lookups.data?.productKinds,
                  catalogChildren(btpCatalogs.data, 'phan-loai-san-pham'),
                )}
                allowClear
                placeholder="Tìm phân loại sản phẩm…"
              />
            ) : null}
            <FormSearchSelect<StockFormValues>
              name="unitId"
              label="Đơn vị"
              options={unitOptions}
              required
              placeholder="Tìm đơn vị…"
            />
            {profile.showShapeColor ? (
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
            ) : null}
            {profile.showShapeColor && isStone ? (
              <FormSearchSelect<StockFormValues>
                name="shapeId"
                label="Hình dạng"
                options={shapeOptions}
                allowClear
                placeholder="Tìm hình dạng…"
              />
            ) : null}
            {profile.showLocation ? (
              <FormSearchSelect<StockFormValues>
                name="locationCode"
                label="Vị trí"
                options={locationOptions}
                allowClear
                placeholder="Tìm vị trí trống…"
                noOptionsText="Chưa có vị trí. Cấu hình ở Cấu hình → Vị trí."
              />
            ) : null}
            <FormMoneyField<StockFormValues>
              name="stockUnitPrice"
              label="Đơn giá tồn"
              slotProps={{
                htmlInput: { inputMode: 'numeric', style: { textAlign: 'right' } },
              }}
            />
          </FormRow>

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
            Tồn = Tồn đầu kỳ + Nhập − Xuất. SL {formatQty(qty)} · TT {formatMoney(amount)}
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
            {row ? 'Lưu' : profile.createLabel}
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
      sx={{ width: '100%', minWidth: 0 }}
      options={colors}
      value={selected}
      onChange={(_, next) => onChange(next?.id ?? '')}
      onBlur={onBlur}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, next) => option.id === next.id}
      filterOptions={(options, state) => {
        const q = state.inputValue.trim().toLowerCase()
        const matched = !q
          ? options
          : options.filter(
              (item) =>
                item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q),
            )
        return matched.slice(0, 50)
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
    { key: 'stock', label: 'Tồn', bg: '#d6e3ee', note: 'Công thức cố định' },
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

        <Box sx={{ bgcolor: '#f4f6f7', fontSize: 12, fontWeight: 700, color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
          SL
        </Box>
        <NxtCell value={formatQtyInput(openingQty)} editable onChange={(v) => onOpeningQty(parseQtyInput(v))} />
        <NxtCell value={formatQty(inQty)} />
        <NxtCell value={formatQty(outQty)} />
        <NxtCell value={formatQty(qty)} />

        <Box sx={{ bgcolor: '#f4f6f7', fontSize: 12, fontWeight: 700, color: 'text.secondary', display: 'flex', alignItems: 'center', borderBottom: 'none' }}>
          TT
        </Box>
        <NxtCell
          value={formatMoney(openingAmount || '0')}
        />
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

function moneyDigitsFromApi(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return String(Math.round(n))
}

