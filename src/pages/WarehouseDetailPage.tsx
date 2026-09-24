import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom'
import {
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
  Typography,
} from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import {
  formatMoney,
  formatQty,
  getInventoryLookupsApi,
  getWarehouseStockApi,
  qtyFromApi,
  stockStatusFromQty,
  updateWarehouseStockApi,
  createWarehouseStockApi,
  type AvailabilityCode,
  type InventoryLookups,
  type LookupItem,
  type MetalKindCode,
  type StockResponse,
  type StockRow,
  type StockTotals,
  type UpdateStockPayload,
} from '../api/inventory'
import type { OrderImage } from '../api/productionOrders'
import { ImageUploadField } from '../orders/ImageUploadField'
import { listCatalogsApi, type CatalogItem } from '../api/catalogs'
import { getLocationsApi } from '../api/locations'
import {
  ColumnHeaderFilter,
  ColumnHeaderSearch,
  DataTable,
  EditReasonBlock,
  Form,
  FormMoneyField,
  FormQtyField,
  FormRow,
  FormSearchSelect,
  FormTextField,
  PageHeader,
  RowActions,
  type Column,
  type ColumnGroup,
} from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'
import { useCrudDialog, type CrudDialogKind } from '../hooks/useCrudDialog'
import { isTempId, newTempId, registerTempId, resolveTempId, rejectTempId } from '../hooks/pendingRowId'
import { paginate, useTableParams } from '../hooks/useTableParams'
import { CategorySelect } from '../warehouses/CategorySelect'
import { LineActions } from '../warehouses/LineActions'
import type { SearchSelectOption } from '../warehouses/SearchSelect'
import { StockFigureGrid } from '../warehouses/StockFigureGrid'
import { validateStockName } from '../warehouses/stockName'
import { WarehouseStockView } from '../warehouses/StockView'
import { StockInboundPanel } from '../warehouses/StockInboundPanel'
import { StockOutboundPanel } from '../warehouses/StockOutboundPanel'
import { FinishedGoodsPage } from '../pages/FinishedGoodsPage'
import {
  CATEGORY_GROUPS,
  CONSUMABLE_CATEGORIES,
  METAL_KINDS,
  THANH_PHAM_WAREHOUSE,
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

      {warehouse.code === THANH_PHAM_WAREHOUSE && activeSection ? (
        <FinishedGoodsPage section={activeSection.code} hideHeader />
      ) : activeSection?.code === 'inbound' ? (
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
const split = { borderLeft: '2px solid #6b4513' }
const groupHead = {
  open: { ...split, bgcolor: '#f3eee6', fontWeight: 700 },
  in: { ...split, bgcolor: '#e4f0e8', fontWeight: 700 },
  out: { ...split, bgcolor: '#f3ebe7', fontWeight: 700 },
  stock: { ...split, bgcolor: '#e8d8bd', fontWeight: 700, color: 'primary.main' },
}
/** Bốn nhóm tiêu đề bậc 1 của bảng tồn: mỗi nhóm gộp một cặp SL / TT. */
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
  const { openEdit, openView } = dialog
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

  const stockKey = ['warehouse-stock', warehouseCode] as const
  const save = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: UpdateStockPayload }) =>
      id
        ? updateWarehouseStockApi(warehouseCode, id, payload)
        : createWarehouseStockApi(warehouseCode, payload),
    onMutate: (input) => {
      dialog.close()
      toast.success(input.id ? `Đã cập nhật ${profile.noun}` : `Đã thêm ${profile.noun}`)
      void queryClient.cancelQueries({ queryKey: stockKey })
      const previous = queryClient.getQueryData<StockResponse>(stockKey)
      const tempId = input.id ?? newTempId()
      if (!input.id) registerTempId(tempId)
      queryClient.setQueryData(stockKey, (current: StockResponse | undefined) => {
        if (!current) return current
        const next = input.id
          ? current.items.map((item) =>
              item.id === input.id ? patchStockRow(item, input.payload, lookups.data) : item,
            )
          : [
              ...current.items,
              blankStockRow(tempId, current.items.length + 1, input.payload, lookups.data),
            ]
        return { ...current, items: next, totals: sumStockTotals(next) }
      })
      if (!input.id) table.setPage(Math.ceil((visible.length + 1) / params.pageSize))
      return { previous, tempId }
    },
    onSuccess: (row, _input, ctx) => {
      if (ctx?.tempId && isTempId(ctx.tempId)) resolveTempId(ctx.tempId, row.id)
      queryClient.setQueryData(stockKey, (current: StockResponse | undefined) => {
        if (!current) return current
        const next = current.items.map((item) =>
          item.id === row.id || item.id === ctx?.tempId
            ? { ...item, ...row, priceLayers: row.priceLayers ?? item.priceLayers }
            : item,
        )
        if (!next.some((item) => item.id === row.id)) next.push(row)
        return { ...current, items: next, totals: sumStockTotals(next) }
      })
      void queryClient.invalidateQueries({ queryKey: ['warehouse-locations', warehouseCode] })
    },
    onError: (error: Error, _input, ctx) => {
      if (ctx?.tempId && isTempId(ctx.tempId)) rejectTempId(ctx.tempId, error)
      if (ctx?.previous) queryClient.setQueryData(stockKey, ctx.previous)
      toast.error(error.message)
    },
  })
  const saveMany = useMutation({
    mutationFn: async (payloads: UpdateStockPayload[]) => {
      const rows: StockRow[] = []
      for (const payload of payloads) {
        rows.push(await createWarehouseStockApi(warehouseCode, payload))
      }
      return rows
    },
    onSuccess: (rows) => {
      toast.success(`Đã thêm ${rows.length} ${profile.noun}`)
      void queryClient.invalidateQueries({ queryKey: stockKey })
      void queryClient.invalidateQueries({ queryKey: ['warehouse-locations', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const { setFilter, setSearch } = table
  const columns = useMemo(
    () =>
      stockColumns(profile, { onView: openView, onEdit: openEdit }, totals, {
        name: <ColumnHeaderSearch value={params.search} onChange={setSearch} placeholder="Tìm tên…" />,
        location: profile.showLocation
          ? { valueId: params.location, options: locationOptions, onChange: (id) => setFilter({ location: id }) }
          : undefined,
        shape: profile.showShapeColor
          ? { valueId: params.shape, options: shapeOptions, onChange: (id) => setFilter({ shape: id }) }
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
      openView,
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
    (profile.showSize ? 90 : 0) +
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
            onView={() => openView(row)}
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
        kind={dialog.kind}
        row={dialog.row}
        warehouseCode={warehouseCode}
        profile={profile}
        nameSuggestions={nameSuggestions}
        saving={false}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payloads) => {
          const id = dialog.row?.id
          dialog.close()
          if (id) {
            save.mutate({ id, payload: payloads[0] })
            return
          }
          if (payloads.length === 1) {
            save.mutate({ payload: payloads[0] })
            return
          }
          saveMany.mutate(payloads)
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
  onView,
  onEdit,
}: {
  row: StockRow
  index: number
  profile: StockProfile
  onView: () => void
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
    profile.showSize ? { label: 'Size', value: row.sizeLabel ?? '—' } : null,
    profile.showBodyMetal ? { label: 'Chất liệu', value: row.bodyMetal ?? '—' } : null,
    profile.showProductKind ? { label: 'Phân loại sản phẩm', value: row.productKind ?? '—' } : null,
    profile.showProductInfo ? { label: 'Màu xi', value: row.platingColor ?? '—' } : null,
    profile.showProductInfo ? { label: 'Màu đá', value: row.color ?? '—' } : null,
    profile.showProductInfo ? { label: 'Size', value: row.sizeLabel ?? '—' } : null,
    row.stoneWeight ? { label: 'TL đá (g)', value: row.stoneWeight } : null,
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
  actions: { onView: (row: StockRow) => void; onEdit: (row: StockRow) => void },
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
  )
  if (profile.showSize) {
    columns.push({
      key: 'sizeLabel',
      header: 'Size',
      align: 'center',
      render: (row) => row.sizeLabel ?? '—',
    })
  }
  columns.push(
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
      render: (row) => <RowActions onView={() => actions.onView(row)} onEdit={() => actions.onEdit(row)} />,
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

function lookupName(items: Array<{ id: string; name: string }> | undefined, id: string | null | undefined) {
  if (!id) return null
  return items?.find((item) => item.id === id)?.name ?? null
}

function patchStockRow(row: StockRow, payload: UpdateStockPayload, lookups: InventoryLookups | undefined): StockRow {
  const openingQty = payload.openingQty ?? row.openingQty
  const stockUnitPrice = payload.stockUnitPrice ?? row.stockUnitPrice
  const openingAmount = String(Math.round((Number(openingQty) || 0) * (Number(stockUnitPrice) || 0)))
  const qty = String((Number(openingQty) || 0) + (Number(row.inQty) || 0) - (Number(row.outQty) || 0))
  const amount = String(
    Math.round((Number(openingAmount) || 0) + (Number(row.inAmount) || 0) - (Number(row.outAmount) || 0)),
  )
  const av = stockStatusFromQty(qty)
  const unitId = payload.unitId ?? row.unitId
  const shapeId = payload.shapeId !== undefined ? payload.shapeId : row.shapeId
  const colorId = payload.colorId !== undefined ? payload.colorId : row.colorId
  const colorName = payload.colorName !== undefined ? payload.colorName : undefined
  const materialTypeId = payload.materialTypeId !== undefined ? payload.materialTypeId : row.materialTypeId
  const otherClassId = payload.otherClassId !== undefined ? payload.otherClassId : row.otherClassId
  const bodyMetalId = payload.bodyMetalId !== undefined ? payload.bodyMetalId : row.bodyMetalId
  const productKindId = payload.productKindId !== undefined ? payload.productKindId : row.productKindId
  const platingColorId = payload.platingColorId !== undefined ? payload.platingColorId : row.platingColorId
  const metalKind = payload.metalKind !== undefined ? payload.metalKind : row.metalKind
  const btpCategoryId = payload.btpCategoryId
  return {
    ...row,
    name: payload.name ?? row.name,
    locationCode: payload.locationCode !== undefined ? payload.locationCode || null : row.locationCode,
    unitId,
    unit: lookupName(lookups?.units, unitId) ?? row.unit,
    shapeId: shapeId ?? null,
    shape: shapeId ? lookupName(lookups?.shapes, shapeId) ?? row.shape : null,
    colorId: colorName !== undefined ? row.colorId : colorId ?? null,
    color:
      colorName !== undefined
        ? colorName || null
        : colorId
          ? lookupName(lookups?.colors, colorId) ?? row.color
          : null,
    materialTypeId: materialTypeId ?? null,
    materialType:
      payload.otherClassName ||
      lookupName(lookups?.materialTypes, materialTypeId) ||
      lookupName(lookups?.otherClasses, otherClassId) ||
      row.materialType,
    otherClassId:
      payload.otherClassId !== undefined
        ? payload.otherClassId
        : payload.btpCategoryId !== undefined
          ? payload.btpCategoryId || null
          : row.otherClassId,
    otherClass:
      payload.otherClassName ||
      lookupName(lookups?.btpCategories, btpCategoryId) ||
      lookupName(lookups?.otherClasses, otherClassId) ||
      row.otherClass,
    bodyMetalId: bodyMetalId ?? null,
    bodyMetal: bodyMetalId ? lookupName(lookups?.bodyMetals, bodyMetalId) ?? row.bodyMetal : null,
    productKindId: productKindId ?? null,
    productKind: productKindId ? lookupName(lookups?.productKinds, productKindId) ?? row.productKind : null,
    platingColorId: platingColorId ?? null,
    platingColor: platingColorId ? lookupName(lookups?.platingColors, platingColorId) ?? row.platingColor : null,
    sizeLabel: payload.sizeLabel !== undefined ? payload.sizeLabel || null : row.sizeLabel,
    stoneWeight: payload.stoneWeight !== undefined ? payload.stoneWeight || null : row.stoneWeight,
    images: payload.images ?? row.images,
    metalKind: metalKind ?? null,
    metalKindLabel: metalKind
      ? (METAL_KINDS.find((item) => item.code === metalKind)?.name ?? row.metalKindLabel)
      : payload.otherClassName
        ? 'Phân loại khác'
        : row.metalKindLabel,
    openingQty,
    openingAmount,
    stockUnitPrice,
    qty,
    amount,
    availability: av.code,
    availabilityLabel: av.label,
  }
}

function blankStockRow(
  id: string,
  stt: number,
  payload: UpdateStockPayload,
  lookups: InventoryLookups | undefined,
): StockRow {
  return patchStockRow(
    {
      id,
      stt,
      locationCode: null,
      sku: null,
      shapeId: null,
      shape: null,
      colorId: null,
      color: null,
      name: '',
      unitId: payload.unitId ?? '',
      unit: '',
      openingQty: '0',
      openingAmount: '0',
      stockUnitPrice: '0',
      inQty: '0',
      inAmount: '0',
      outQty: '0',
      outAmount: '0',
      qty: '0',
      amount: '0',
      materialTypeId: null,
      materialType: null,
      otherClassId: null,
      otherClass: null,
      otherClassParentId: null,
      otherClassParent: null,
      bodyMetalId: null,
      bodyMetal: null,
      productKindId: null,
      productKind: null,
      platingColorId: null,
      platingColor: null,
      sizeLabel: null,
      stoneWeight: null,
      images: [],
      classificationCode: 'RAW_MATERIAL',
      classification: 'NVL',
      metalKind: null,
      metalKindLabel: null,
      availability: 'OUT_OF_STOCK',
      availabilityLabel: 'Hết hàng',
    },
    payload,
    lookups,
  )
}

type StockFormValues = {
  locationCode: string
  sku: string
  shapeId: string
  colorId: string
  colorName: string
  name: string
  unitId: string
  materialTypeId: string
  metalKind: string
  bodyMetalId: string
  productKindId: string
  btpCategoryId: string
  platingColorId: string
  sizeLabel: string
  stoneWeight: string
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
  colorName: '',
  name: '',
  unitId: '',
  materialTypeId: '',
  metalKind: '',
  bodyMetalId: '',
  productKindId: '',
  btpCategoryId: '',
  platingColorId: '',
  sizeLabel: '',
  stoneWeight: '',
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
  kind,
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
  kind: CrudDialogKind
  row: StockRow | null
  warehouseCode: string
  profile: StockProfile
  nameSuggestions: string[]
  saving: boolean
  onClose: () => void
  onExited: () => void
  onSave: (payloads: UpdateStockPayload[]) => void
}) {
  const form = useForm<StockDialogValues>({
    defaultValues: { items: [EMPTY_STOCK] },
  })
  const items = useFieldArray({ control: form.control, name: 'items' })
  const [uploading, setUploading] = useState(false)
  const [editReason, setEditReason] = useState('')
  const [reasonError, setReasonError] = useState('')
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
    setEditReason('')
    setReasonError('')
    form.reset({
      items: [
        row
          ? {
              locationCode: row.locationCode ?? '',
              sku: row.sku ?? '',
              shapeId: row.shapeId ?? '',
              colorId: row.colorId ?? '',
              colorName: row.color ?? '',
              name: row.name,
              unitId: row.unitId,
              materialTypeId: row.otherClassId ?? row.materialTypeId ?? '',
              metalKind: row.otherClassId ? 'OTHER' : (row.metalKind ?? ''),
              bodyMetalId: row.bodyMetalId ?? '',
              productKindId: row.productKindId ?? '',
              btpCategoryId: row.otherClassId ?? '',
              platingColorId: row.platingColorId ?? '',
              sizeLabel: row.sizeLabel ?? '',
              stoneWeight: row.stoneWeight ? qtyFromApi(row.stoneWeight) : '',
              images: (row.images ?? []).map((image) => ({ ...image, kind: 'PRODUCT' as const })),
              openingQty: qtyFromApi(row.openingQty),
              stockUnitPrice: moneyDigitsFromApi(row.stockUnitPrice),
              inQty: qtyFromApi(row.inQty),
              inAmount: row.inAmount,
              outQty: qtyFromApi(row.outQty),
              outAmount: row.outAmount,
            }
          : EMPTY_STOCK,
      ],
    })
  }, [open, row, form])

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

  const watchedItems = useWatch({ control: form.control, name: 'items' }) ?? []
  const selectedLocations = watchedItems.map((item) => item.locationCode).filter(Boolean)

  // Chỉ gợi ý ô kệ còn trống, trừ ô đang gán cho các dòng đang nhập.
  const locationOptions: SearchSelectOption[] = useMemo(() => {
    const slots = locationSlots.data?.items ?? []
    const opts = slots
      .filter((slot) => !slot.occupied || selectedLocations.includes(slot.code))
      .map((slot) => ({
        id: slot.code,
        name: slot.code,
        secondary: slot.occupied ? (slot.materialName ?? 'Đang dùng') : 'Trống',
      }))
    for (const code of selectedLocations) {
      if (code && !opts.some((item) => item.id === code)) {
        opts.unshift({ id: code, name: code, secondary: 'Hiện tại' })
      }
    }
    return opts
  }, [selectedLocations, locationSlots.data?.items])

  const shapeOptions: SearchSelectOption[] = lookups.data?.shapes ?? []
  const unitOptions: SearchSelectOption[] = lookups.data?.units ?? []
  const flatTypeOptions: SearchSelectOption[] = typeOptions

  const readOnly = kind === 'view'

  function submit(values: { items: StockFormValues[] }) {
    if (readOnly) return
    if (row && !editReason.trim()) {
      setReasonError('Nhập lý do chỉnh sửa')
      return
    }
    const payloads = values.items
      .filter((item) => item.name.trim())
      .map((item) => ({
        ...stockPayloadFromItem(item, profile, categoryOptions),
        editReason: editReason.trim() || undefined,
      }))
    if (!payloads.length) return
    onSave(payloads)
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
      {readOnly && row ? (
        <WarehouseStockView row={row} profile={profile} onClose={onClose} />
      ) : (
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
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              {items.fields.map((field, index) => (
                <StockItemFields
                  key={field.id}
                  index={index}
                  form={form}
                  profile={profile}
                  row={row}
                  nameSuggestions={nameSuggestions}
                  categoryOptions={categoryOptions}
                  consumableOptions={consumableOptions}
                  nestedTypes={nestedTypes}
                  flatTypeOptions={flatTypeOptions}
                  unitOptions={unitOptions}
                  shapeOptions={shapeOptions}
                  locationOptions={locationOptions}
                  lookups={lookups.data}
                  btpCatalogs={btpCatalogs.data}
                  onUploadingChange={onUploadingChange}
                  showLineActions={!row}
                  onAdd={() => items.insert(index + 1, { ...EMPTY_STOCK }, { shouldFocus: false })}
                  onRemove={() => {
                    if (items.fields.length <= 1) {
                      form.reset({ items: [EMPTY_STOCK] })
                      return
                    }
                    items.remove(index)
                  }}
                  removeDisabled={items.fields.length <= 1 && !watchedItems[index]?.name}
                />
              ))}
            </Stack>
            {row ? (
              <EditReasonBlock
                entityType="stock"
                entityId={row.id}
                reason={editReason}
                onReasonChange={(value) => {
                  setEditReason(value)
                  if (value.trim()) setReasonError('')
                }}
                required
                error={reasonError}
              />
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={saving}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="contained"
              loading={saving || uploading}
              loadingPosition="start"
            >
              {uploading ? 'Đang upload ảnh…' : row ? 'Lưu' : profile.createLabel}
            </Button>
          </DialogActions>
        </Form>
      )}
    </Dialog>
  )
}

type StockDialogValues = { items: StockFormValues[] }

function stockPayloadFromItem(
  values: StockFormValues,
  profile: StockProfile,
  categoryOptions: LookupItem[],
): UpdateStockPayload {
  if (profile.showBtpCategory) {
    return {
      name: values.name.trim(),
      unitId: values.unitId,
      materialTypeId: null,
      metalKind: null,
      otherClassName: null,
      btpCategoryId: values.btpCategoryId || null,
      bodyMetalId: values.bodyMetalId || null,
      productKindId: values.productKindId || null,
      platingColorId: values.platingColorId || null,
      colorName: values.colorName.trim(),
      sizeLabel: values.sizeLabel.trim(),
      images: values.images.map(({ url, publicId, width, height }) => ({
        url,
        publicId,
        width,
        height,
      })),
      openingQty: values.openingQty,
      stockUnitPrice: values.stockUnitPrice || '0',
    }
  }
  const picked = categoryOptions.find((item) => item.id === values.materialTypeId)
  if (profile.typeCodes) {
    return {
      ...(profile.showLocation ? { locationCode: values.locationCode } : {}),
      name: values.name.trim(),
      unitId: values.unitId,
      materialTypeId: null,
      metalKind: null,
      otherClassName: null,
      otherClassId: values.materialTypeId || null,
      openingQty: values.openingQty,
      stockUnitPrice: values.stockUnitPrice || '0',
    }
  }
  const isOther = picked?.metalKind === 'OTHER' || values.metalKind === 'OTHER'
  return {
    ...(profile.showLocation ? { locationCode: values.locationCode } : {}),
    name: values.name.trim(),
    unitId: values.unitId,
    shapeId: profile.showShapeColor && picked?.metalKind === 'STONE' ? values.shapeId || null : null,
    colorName: profile.showShapeColor ? values.colorName.trim() : undefined,
    materialTypeId: isOther ? null : values.materialTypeId || null,
    metalKind: isOther
      ? null
      : picked?.metalKind && picked.metalKind !== 'OTHER'
        ? picked.metalKind
        : values.metalKind
          ? (values.metalKind as MetalKindCode)
          : null,
    otherClassName: isOther ? picked?.name ?? null : null,
    sizeLabel: values.sizeLabel.trim(),
    stoneWeight: picked?.metalKind === 'STONE' || values.metalKind === 'STONE' ? values.stoneWeight || null : null,
    openingQty: values.openingQty,
    stockUnitPrice: values.stockUnitPrice || '0',
  }
}

function StockItemFields({
  index,
  form,
  profile,
  row,
  nameSuggestions,
  categoryOptions,
  consumableOptions,
  nestedTypes,
  flatTypeOptions,
  unitOptions,
  shapeOptions,
  locationOptions,
  lookups,
  btpCatalogs,
  onUploadingChange,
  showLineActions,
  onAdd,
  onRemove,
  removeDisabled,
}: {
  index: number
  form: UseFormReturn<StockDialogValues>
  profile: StockProfile
  row: StockRow | null
  nameSuggestions: string[]
  categoryOptions: LookupItem[]
  consumableOptions: LookupItem[]
  nestedTypes: LookupItem[]
  flatTypeOptions: SearchSelectOption[]
  unitOptions: SearchSelectOption[]
  shapeOptions: SearchSelectOption[]
  locationOptions: SearchSelectOption[]
  lookups: InventoryLookups | undefined
  btpCatalogs: CatalogItem[] | undefined
  onUploadingChange: (busy: boolean) => void
  showLineActions: boolean
  onAdd: () => void
  onRemove: () => void
  removeDisabled?: boolean
}) {
  const metalKind = useWatch({ control: form.control, name: `items.${index}.metalKind` })
  const isStone = metalKind === 'STONE'
  const openingQty = useWatch({ control: form.control, name: `items.${index}.openingQty` }) ?? '0'
  const stockUnitPrice = useWatch({ control: form.control, name: `items.${index}.stockUnitPrice` }) ?? ''
  const inQty = useWatch({ control: form.control, name: `items.${index}.inQty` }) ?? '0'
  const inAmount = useWatch({ control: form.control, name: `items.${index}.inAmount` }) ?? '0'
  const outQty = useWatch({ control: form.control, name: `items.${index}.outQty` }) ?? '0'
  const outAmount = useWatch({ control: form.control, name: `items.${index}.outAmount` }) ?? '0'
  const openingAmount = String(Math.round((Number(openingQty) || 0) * (Number(stockUnitPrice) || 0)))
  const qty = String((Number(openingQty) || 0) + (Number(inQty) || 0) - (Number(outQty) || 0))
  const amount = String(
    Math.round((Number(openingAmount) || 0) + (Number(inAmount) || 0) - (Number(outAmount) || 0)),
  )

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <FormTextField<StockDialogValues>
            name={`items.${index}.name`}
            label={profile.nameLabel}
            required
            autoFocus={index === 0}
            suggestions={nameSuggestions}
            helperText={row ? undefined : 'Gõ phần đầu — Tab hoặc click để nhận gợi ý'}
            onBlur={() => {
              const typed = String(form.getValues(`items.${index}.name`) ?? '').trim()
              if (!typed) return
              const names = form
                .getValues('items')
                .flatMap((item, i) => (String(item.name ?? '').trim() ? ([`items.${i}.name`] as const) : []))
              void form.trigger(names)
            }}
            rules={{
              validate: (value) =>
                validateStockName(value, {
                  existing: nameSuggestions,
                  self: row?.name,
                  siblings: form
                    .getValues('items')
                    .filter((_, i) => i !== index)
                    .map((item) => item.name),
                  label: profile.nameLabel,
                }),
            }}
          />
          <FormRow columns={3}>
            {profile.showBtpCategory ? (
              <FormSearchSelect<StockDialogValues>
                name={`items.${index}.bodyMetalId`}
                label="Chất liệu"
                options={withFallback(lookups?.bodyMetals, catalogChildren(btpCatalogs, 'chat-lieu'))}
                allowClear
                placeholder="Tìm chất liệu…"
              />
            ) : profile.typeCodes ? (
              <FormSearchSelect<StockDialogValues>
                name={`items.${index}.materialTypeId`}
                label="Danh mục"
                options={consumableOptions}
                required
                placeholder="Chọn danh mục…"
                rules={{ required: 'Vui lòng chọn danh mục' }}
              />
            ) : nestedTypes.length ? (
              <Controller
                name={`items.${index}.materialTypeId`}
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
                    onChange={(typeId, nextKind) => {
                      field.onChange(typeId)
                      form.setValue(`items.${index}.metalKind`, nextKind)
                      if (nextKind !== 'STONE') form.setValue(`items.${index}.stoneWeight`, '')
                    }}
                  />
                )}
              />
            ) : (
              <FormSearchSelect<StockDialogValues>
                name={`items.${index}.materialTypeId`}
                label={profile.typeLabel}
                options={flatTypeOptions}
                allowClear
                placeholder="Tìm nhóm…"
              />
            )}
            {profile.showBtpCategory ? (
              <FormSearchSelect<StockDialogValues>
                name={`items.${index}.btpCategoryId`}
                label="Danh mục BTP"
                options={withFallback(
                  lookups?.btpCategories,
                  catalogChildren(btpCatalogs, 'danh-muc-btp'),
                )}
                allowClear
                placeholder="Tìm danh mục BTP…"
              />
            ) : null}
            {profile.showProductKind ? (
              <FormSearchSelect<StockDialogValues>
                name={`items.${index}.productKindId`}
                label="Phân loại sản phẩm"
                options={withFallback(
                  lookups?.productKinds,
                  catalogChildren(btpCatalogs, 'phan-loai-san-pham'),
                )}
                allowClear
                placeholder="Tìm phân loại sản phẩm…"
              />
            ) : null}
            <FormSearchSelect<StockDialogValues>
              name={`items.${index}.unitId`}
              label="Đơn vị"
              options={unitOptions}
              required
              placeholder="Tìm đơn vị…"
            />
            {profile.showProductInfo ? (
              <>
                <FormSearchSelect<StockDialogValues>
                  name={`items.${index}.platingColorId`}
                  label="Màu xi"
                  options={withFallback(
                    lookups?.platingColors,
                    catalogChildren(btpCatalogs, 'mau-xi'),
                  )}
                  allowClear
                  placeholder="Tìm màu xi…"
                />
                <FormTextField<StockDialogValues>
                  name={`items.${index}.colorName`}
                  label="Màu đá"
                  placeholder="Nhập màu đá…"
                  clearable
                />
                <FormTextField<StockDialogValues>
                  name={`items.${index}.sizeLabel`}
                  label="Size"
                  placeholder="7, US 10, 16cm…"
                />
              </>
            ) : null}
            {profile.showShapeColor ? (
              <FormTextField<StockDialogValues>
                name={`items.${index}.colorName`}
                label="Màu sắc"
                placeholder="Nhập màu sắc…"
                clearable
              />
            ) : null}
            {profile.showShapeColor && isStone ? (
              <FormSearchSelect<StockDialogValues>
                name={`items.${index}.shapeId`}
                label="Hình dạng"
                options={shapeOptions}
                allowClear
                placeholder="Tìm hình dạng…"
              />
            ) : null}
            {isStone ? (
              <FormQtyField<StockDialogValues>
                name={`items.${index}.stoneWeight`}
                label="Trọng lượng đá (g)"
                required
                placeholder="Nhập trọng lượng đá…"
                rules={{
                  validate: (value) => {
                    const n = Number(value)
                    return n > 0 || 'Nhập trọng lượng đá'
                  },
                }}
              />
            ) : null}
            {profile.showSize ? (
              <FormTextField<StockDialogValues>
                name={`items.${index}.sizeLabel`}
                label="Size"
                placeholder="7, US 10, 0.8mm…"
              />
            ) : null}
            {profile.showLocation ? (
              <FormSearchSelect<StockDialogValues>
                name={`items.${index}.locationCode`}
                label="Vị trí"
                options={locationOptions}
                allowClear
                placeholder="Tìm vị trí trống…"
                noOptionsText="Chưa có vị trí. Cấu hình ở Cấu hình → Vị trí."
              />
            ) : null}
            <FormMoneyField<StockDialogValues>
              name={`items.${index}.stockUnitPrice`}
              label="Đơn giá tồn"
              slotProps={{
                htmlInput: { inputMode: 'numeric', style: { textAlign: 'right' } },
              }}
            />
          </FormRow>

          {profile.showProductInfo ? (
            <Controller
              control={form.control}
              name={`items.${index}.images`}
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
              onChange: (value) => form.setValue(`items.${index}.openingQty`, value),
            }}
          />
          <Typography variant="body2" sx={{ color: '#1e8449', fontWeight: 600, px: 0.25 }}>
            Tồn = Tồn đầu kỳ + Nhập − Xuất. SL {formatQty(qty)} · TT {formatMoney(amount)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.25, mt: -1 }}>
            TT đầu kỳ = SL × đơn giá tồn. Nhập / xuất / tồn kho lấy từ phiếu, không sửa tay.
          </Typography>
        </Box>
        {showLineActions ? (
          <LineActions
            addLabel={`Thêm ${profile.noun}`}
            removeLabel={`Xóa ${profile.noun}`}
            onAdd={onAdd}
            onRemove={onRemove}
            removeDisabled={removeDisabled}
          />
        ) : null}
      </Stack>
    </Paper>
  )
}

function moneyDigitsFromApi(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return String(Math.round(n))
}
