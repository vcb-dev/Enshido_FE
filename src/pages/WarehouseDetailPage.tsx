import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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
import type { OrderImage } from '../api/productionOrders'
import { cloudinaryThumb } from '../api/uploads'
import { ImageUploadField } from '../orders/ImageUploadField'
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
  PageHeader,
  RowActions,
  type Column,
  type ColumnGroup,
} from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { paginate, useTableParams } from '../hooks/useTableParams'
import { CategorySelect } from '../warehouses/CategorySelect'
import { ColumnHeaderFilter, ColumnHeaderSearch } from '../warehouses/ColumnHeaderFilter'
import type { SearchSelectOption } from '../warehouses/SearchSelect'
import { StockFigureGrid } from '../warehouses/StockFigureGrid'
import { StockInboundPanel } from '../warehouses/StockInboundPanel'
import { StockOutboundPanel } from '../warehouses/StockOutboundPanel'
import {
  CATEGORY_GROUPS,
  CONSUMABLE_CATEGORIES,
  WAREHOUSE_SECTIONS,
  catalogChildren,
  materialTypesFor,
  stockProfile,
  stockWarehouseCode,
  warehouseByCode,
  warehousePath,
  warehouseSectionByCode,
  withFallback,
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
    return <Navigate to="/warehouses/btp-cho-vao-da/stock" replace />
  }

  if (code === 'nvl-chinh' && bin && LEGACY_BINS.has(bin)) {
    const next = section === 'btp' || !section ? 'stock' : section
    return <Navigate to={`/warehouses/nvl-chinh/${next}`} replace />
  }

  const warehouse = warehouseByCode(code ?? '')
  if (!warehouse) {
    return <Navigate to="/warehouses" replace />
  }

  const sectionCode = warehouse.sections
    ? (bin as WarehouseSectionCode | undefined)
    : (section as WarehouseSectionCode | undefined)
  const activeSection = warehouseSectionByCode(sectionCode)

  if (section === 'gia' || bin === 'gia') {
    return <Navigate to="/warehouses/nvl-chinh/stock" replace />
  }

  if (warehouse.sections && !activeSection) {
    return <Navigate to={warehousePath(warehouse, 'stock')} replace />
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
            <Link component={RouterLink} to="/warehouses" underline="hover" color="inherit">
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

      {activeSection?.code === 'inbound' ? (
        <StockInboundPanel warehouseCode={stockKey} />
      ) : activeSection?.code === 'outbound' ? (
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
  stock: { key: 'stock', label: 'Tồn', headSx: groupHead.stock },
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
  })
  const btpCatalogs = useQuery({
    queryKey: ['catalogs', 'OTHER'],
    queryFn: () => listCatalogsApi('OTHER'),
    enabled: profile.showBtpCategory || profile.showBodyMetal || profile.showProductKind,
    staleTime: 5 * 60_000,
  })
  const locationSlots = useQuery({
    queryKey: ['warehouse-locations', warehouseCode],
    queryFn: () => getLocationsApi(warehouseCode),
    staleTime: 60_000,
    enabled: profile.showLocation,
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
    if (profile.typeCodes) return lookups.data?.consumableCategories ?? []
    return [...(lookups.data?.materialTypes ?? []), ...(lookups.data?.otherClasses ?? [])]
  }, [lookups.data, profile.typeCodes])
  const kindFilterOptions = useMemo(() => {
    if (profile.showBtpCategory) {
      return withFallback(
        lookups.data?.btpCategories,
        catalogChildren(btpCatalogs.data, 'danh-muc-btp'),
      )
    }
    return CATEGORY_GROUPS.map((item) => ({ id: item.code, name: item.name }))
  }, [lookups.data?.btpCategories, btpCatalogs.data, profile.showBtpCategory])
  const bodyMetalOptions = useMemo(
    () => withFallback(lookups.data?.bodyMetals, catalogChildren(btpCatalogs.data, 'chat-lieu')),
    [lookups.data?.bodyMetals, btpCatalogs.data],
  )
  const productKindOptions = useMemo(
    () =>
      withFallback(
        lookups.data?.productKinds,
        catalogChildren(btpCatalogs.data, 'phan-loai-san-pham'),
      ),
    [lookups.data?.productKinds, btpCatalogs.data],
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

  const { setFilter, setSearch } = table
  const shapeOptions = lookups.data?.shapes
  const columns = useMemo(
    () =>
      stockColumns(profile, openEdit, totals, {
        name: <ColumnHeaderSearch value={params.search} onChange={setSearch} placeholder="Tìm tên…" />,
        location: profile.showLocation
          ? { valueId: params.location, options: locationOptions, onChange: (id) => setFilter({ location: id }) }
          : undefined,
        shape: profile.showShapeColor
          ? { valueId: params.shape, options: shapeOptions ?? [], onChange: (id) => setFilter({ shape: id }) }
          : undefined,
        color: profile.showShapeColor
          ? { valueId: params.color, options: colorOptions, onChange: (id) => setFilter({ color: id }) }
          : undefined,
        unit: { valueId: params.unit, options: unitOptions, onChange: (id) => setFilter({ unit: id }) },
        kind:
          profile.showNvlCategory || profile.showBtpCategory
            ? { valueId: params.kind, options: kindFilterOptions, onChange: (id) => setFilter({ kind: id }) }
            : undefined,
        type: profile.showType
          ? { valueId: params.stone, options: typeFilterOptions, onChange: (id) => setFilter({ stone: id }) }
          : undefined,
        bodyMetal: profile.showBodyMetal
          ? { valueId: params.bodyMetal, options: bodyMetalOptions, onChange: (id) => setFilter({ bodyMetal: id }) }
          : undefined,
        productKind: profile.showProductKind
          ? {
              valueId: params.productKind,
              options: productKindOptions,
              onChange: (id) => setFilter({ productKind: id }),
            }
          : undefined,
        status: profile.showStatus
          ? {
              valueId: params.status === 'ALL' ? '' : params.status,
              options: statusFilterOptions,
              onChange: (id) => setFilter({ status: id || 'ALL' }),
            }
          : undefined,
      }),
    [
      bodyMetalOptions,
      colorOptions,
      kindFilterOptions,
      locationOptions,
      openEdit,
      params.bodyMetal,
      params.color,
      params.kind,
      params.location,
      params.productKind,
      params.search,
      params.shape,
      params.status,
      params.stone,
      params.unit,
      productKindOptions,
      profile,
      setFilter,
      setSearch,
      shapeOptions,
      statusFilterOptions,
      totals,
      typeFilterOptions,
      unitOptions,
    ],
  )

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
    <Stack spacing={1.25} sx={{ flex: { md: 1 }, minHeight: { md: 0 }, overflow: { xs: 'visible', md: 'hidden' } }}>
      <DataTable
        columns={columns}
        rows={paginate(visible, page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={stock.isLoading}
        errorText={stock.error instanceof Error ? stock.error.message : undefined}
        emptyText={filtered ? profile.emptyFiltered : profile.emptyText}
        variant="grid"
        minWidth={minWidth}
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
            profile={profile}
            onEdit={() => openEdit(row)}
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
  const details = [
    { label: 'Đơn vị', value: row.unit },
    profile.showNvlCategory || profile.showBtpCategory
      ? { label: categoryHeader(profile), value: categoryText(row, profile) }
      : null,
    profile.showType ? { label: profile.typeLabel, value: typeText(row, profile) } : null,
    profile.showBodyMetal ? { label: 'Chất liệu', value: row.bodyMetal ?? '—' } : null,
    profile.showProductKind ? { label: 'Phân loại sản phẩm', value: row.productKind ?? '—' } : null,
    profile.showProductInfo ? { label: 'Màu xi', value: row.platingColor ?? '—' } : null,
    profile.showProductInfo ? { label: 'Màu đá', value: row.color ?? '—' } : null,
    profile.showProductInfo ? { label: 'Size', value: row.sizeLabel ?? '—' } : null,
  ].filter((item): item is { label: string; value: string } => item != null)

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
            {profile.showStatus ? (
              <Chip
                size="small"
                variant="outlined"
                color={availabilityColor(row.availability)}
                label={row.availabilityLabel}
              />
            ) : null}
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
        {details.map((item) => (
          <Typography key={item.label} variant="caption">
            {item.label}: {item.value}
          </Typography>
        ))}
      </Stack>
    </Paper>
  )
}

type StockColumnFilters = {
  name: ReactNode
  location?: HeaderFilter
  shape?: HeaderFilter
  color?: HeaderFilter
  unit: HeaderFilter
  kind?: HeaderFilter
  type?: HeaderFilter
  bodyMetal?: HeaderFilter
  productKind?: HeaderFilter
  status?: HeaderFilter
}

function headerFilter(filter?: HeaderFilter) {
  return filter ? <ColumnHeaderFilter {...filter} /> : undefined
}

function categoryHeader(profile: StockProfile) {
  return profile.showBtpCategory ? 'Danh mục BTP' : 'Danh mục'
}

function categoryText(row: StockRow, profile: StockProfile) {
  return profile.showBtpCategory ? (row.otherClass ?? '—') : (row.metalKindLabel ?? '—')
}

function typeText(row: StockRow, profile: StockProfile) {
  if (profile.typeCodes) {
    return row.otherClass ?? row.otherClassParent ?? row.materialType ?? '—'
  }
  return row.materialType ?? '—'
}

function stockColumns(
  profile: StockProfile,
  onEdit: (row: StockRow) => void,
  totals: StockTotals | undefined,
  filters: StockColumnFilters,
): Column<StockRow>[] {
  const columns: Column<StockRow>[] = []

  if (profile.showLocation) {
    columns.push({
      key: 'locationCode',
      card: 'meta',
      header: 'Vị trí',
      filter: headerFilter(filters.location),
      render: (row) => row.locationCode ?? '—',
    })
  }
  if (profile.showSku) {
    columns.push({
      key: 'sku',
      card: 'meta',
      header: profile.skuLabel,
      cellSx: { fontWeight: 700, whiteSpace: 'nowrap' },
      render: (row) => row.sku ?? '—',
    })
  }
  if (profile.showShapeColor) {
    columns.push(
      {
        key: 'shape',
        card: 'meta',
        header: 'Hình dạng',
        filter: headerFilter(filters.shape),
        render: (row) => row.shape ?? '—',
      },
      {
        key: 'color',
        card: 'meta',
        header: 'Màu sắc',
        filter: headerFilter(filters.color),
        render: (row) => row.color ?? '—',
      },
    )
  }

  columns.push(
    {
      key: 'name',
      card: 'title',
      header: profile.nameLabel,
      cellSx: { minWidth: 220 },
      filter: filters.name,
    },
    { key: 'unit', header: 'Đơn vị', align: 'center', filter: headerFilter(filters.unit) },
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
  )

  if (profile.showNvlCategory || profile.showBtpCategory) {
    columns.push({
      key: 'metalKindLabel',
      header: categoryHeader(profile),
      filter: headerFilter(filters.kind),
      render: (row) => categoryText(row, profile),
    })
  }
  if (profile.showType) {
    columns.push({
      key: 'materialType',
      header: profile.typeLabel,
      filter: headerFilter(filters.type),
      render: (row) => typeText(row, profile),
    })
  }
  if (profile.showBodyMetal) {
    columns.push({
      key: 'bodyMetal',
      header: 'Chất liệu',
      filter: headerFilter(filters.bodyMetal),
      render: (row) => row.bodyMetal ?? '—',
    })
  }
  if (profile.showProductKind) {
    columns.push({
      key: 'productKind',
      header: 'Phân loại sản phẩm',
      filter: headerFilter(filters.productKind),
      render: (row) => row.productKind ?? '—',
    })
  }
  if (profile.showProductInfo) {
    columns.push(
      { key: 'platingColor', header: 'Màu xi', render: (row) => row.platingColor ?? '—' },
      { key: 'color', header: 'Màu đá', render: (row) => row.color ?? '—' },
      { key: 'sizeLabel', header: 'Size', render: (row) => row.sizeLabel ?? '—' },
      {
        key: 'images',
        header: 'Ảnh',
        render: (row) =>
          row.images?.length ? (
            <Box
              component="img"
              src={cloudinaryThumb(row.images[0].url, 64)}
              alt=""
              loading="lazy"
              sx={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 0.5, border: '1px solid #d5dbe0' }}
            />
          ) : (
            '—'
          ),
      },
    )
  }
  if (profile.showStatus) {
    columns.push({
      key: 'availability',
      card: 'meta',
      header: 'Trạng thái',
      filter: headerFilter(filters.status),
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
      card: 'actions',
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
  platingColorId: string
  sizeLabel: string
  images: OrderImage[]
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
  platingColorId: '',
  sizeLabel: '',
  images: [],
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
  const [uploading, setUploading] = useState(false)
  const onUploadingChange = useCallback((busy: boolean) => setUploading(busy), [])
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
            platingColorId: row.platingColorId ?? '',
            sizeLabel: row.sizeLabel ?? '',
            images: (row.images ?? []).map((image) => ({ ...image, kind: 'PRODUCT' as const })),
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
        platingColorId: values.platingColorId || null,
        colorId: values.colorId || null,
        sizeLabel: values.sizeLabel.trim(),
        images: values.images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height })),
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
            {profile.showProductInfo ? (
              <>
                <FormSearchSelect<StockFormValues>
                  name="platingColorId"
                  label="Màu xi"
                  options={withFallback(
                    lookups.data?.platingColors,
                    catalogChildren(btpCatalogs.data, 'mau-xi'),
                  )}
                  allowClear
                  placeholder="Tìm màu xi…"
                />
                <Controller
                  name="colorId"
                  control={form.control}
                  render={({ field }) => (
                    <ColorField
                      label="Màu đá"
                      colors={colors}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
                <FormTextField<StockFormValues> name="sizeLabel" label="Size" placeholder="7, US 10, 16cm…" />
              </>
            ) : null}
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

          {profile.showProductInfo ? (
            <Controller
              control={form.control}
              name="images"
              render={({ field }) => (
                <ImageUploadField
                  label="Ảnh sản phẩm"
                  kind="PRODUCT"
                  value={field.value}
                  onChange={field.onChange}
                  onUploadingChange={onUploadingChange}
                />
              )}
            />
          ) : null}

          <StockFigureGrid
            values={{ openingQty, openingAmount, inQty, inAmount, outQty, outAmount, qty, amount }}
            notes
            editableOpeningQty={{
              value: openingQty,
              onChange: (value) => form.setValue('openingQty', value),
            }}
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
          <Button type="submit" variant="contained" disabled={saving || uploading}>
            {uploading ? 'Đang upload ảnh…' : row ? 'Lưu' : profile.createLabel}
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  )
}

/** Ô chọn màu kèm chấm màu — cần renderOption riêng nên không dùng SearchSelect. */
function ColorField({
  label = 'Màu sắc',
  colors,
  value,
  onChange,
  onBlur,
}: {
  label?: string
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
          label={label}
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

