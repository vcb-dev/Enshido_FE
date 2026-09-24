import { useEffect, useMemo } from 'react'
import { Box, Button, Dialog, Link, Paper, Stack, Typography } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import { Link as RouterLink } from 'react-router-dom'
import { toast } from 'sonner'
import {
  createWarehouseOutboundApi,
  formatMoney,
  formatPriceOrDash,
  formatQty,
  formatStockedDate,
  getInventoryLookupsApi,
  getWarehouseOutboundsApi,
  getWarehouseStockApi,
  qtyFromApi,
  updateWarehouseOutboundApi,
  type CreateOutboundPayload,
  type DirectoryUser,
  type LookupItem,
  type OutboundResponse,
  type OutboundRow,
  type StockResponse,
  type StockRow,
} from '../api/inventory'
import { listCatalogsApi } from '../api/catalogs'
import { getLocationsApi } from '../api/locations'
import { listOrderOptionsApi } from '../api/productionOrders'
import { STATUS_META } from '../orders/catalog'
import {
  ColumnHeaderFilter,
  ColumnHeaderSearch,
  CrudDialogShell,
  DataTable,
  type Column,
  FormQtyField,
  FormRow,
  FormSearchSelect,
  FormTextField,
  RowActions,
  TextInput,
} from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { isTempId, newTempId, registerTempId, rejectTempId, resolveRowId, resolveTempId } from '../hooks/pendingRowId'
import { useOperatorName } from '../hooks/useOperatorName'
import { paginate, sortRows, useTableParams } from '../hooks/useTableParams'
import { OutboundView } from './MovementView'
import { LineActions } from './LineActions'
import { MaterialField } from './MaterialField'
import { matchStockMaterial, type StockMaterialOption } from './MaterialNameField'
import type { SearchSelectOption } from './SearchSelect'
import { catalogColumnsAfterAmount, catalogColumnsBeforeName } from './catalogMoveColumns'
import { stockProfile } from './catalog'
import {
  CATALOG_FILTER_DEFAULTS,
  hasActiveCatalogFilters,
  headerTotal,
  matchesCatalogFilters,
  replaceMoveId,
  sumMoveTotals,
  uniqueFilterOptions,
  upsertMoveList,
} from './stockFilters'
import { useCatalogFilterOptions } from './useCatalogFilterOptions'

export function StockOutboundPanel({ warehouseCode }: { warehouseCode: string }) {
  const profile = stockProfile(warehouseCode)
  const outboundProfile = useMemo(() => {
    const hidden = { showLocation: false }
    if (warehouseCode === 'nvl-chinh') {
      return {
        ...profile,
        ...hidden,
        showShapeColor: false,
        showType: false,
        showNvlCategory: false,
      }
    }
    if (warehouseCode === 'btp-cho-vao-da') {
      return {
        ...profile,
        ...hidden,
        showBtpCategory: false,
        showBodyMetal: false,
        showProductKind: false,
      }
    }
    if (warehouseCode === 'nvl-tieu-hao') {
      return { ...profile, ...hidden, showType: false }
    }
    return { ...profile, ...hidden }
  }, [profile, warehouseCode])
  const showUnit = false
  const operatorName = useOperatorName()
  const queryClient = useQueryClient()
  const dialog = useCrudDialog<OutboundRow>()
  // Tách sẵn các callback ổn định để useMemo cột không chạy lại mỗi render.
  const { openView, openEdit } = dialog
  const table = useTableParams({
    pageSize: 8,
    filters: {
      ...CATALOG_FILTER_DEFAULTS,
      issuedBy: '',
      receivedBy: '',
      unit: '',
      color: '',
      productionOrderCode: '',
    },
  })
  const { params } = table
  const catalogFilterParams = useMemo(() => {
    if (warehouseCode === 'nvl-chinh') {
      return { ...params, shape: '', stone: '', kind: '', color: '', location: '' }
    }
    if (warehouseCode === 'btp-cho-vao-da') {
      return { ...params, location: '', kind: '', bodyMetal: '', productKind: '' }
    }
    if (warehouseCode === 'nvl-tieu-hao') {
      return { ...params, location: '', stone: '' }
    }
    return { ...params, location: '' }
  }, [params, warehouseCode])

  const outbounds = useQuery({
    queryKey: ['warehouse-outbounds', warehouseCode],
    queryFn: () => getWarehouseOutboundsApi(warehouseCode),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const lookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    staleTime: 30 * 60_000,
  })
  const btpCatalogs = useQuery({
    queryKey: ['catalogs', 'OTHER'],
    queryFn: () => listCatalogsApi('OTHER'),
    enabled: profile.showBtpCategory || profile.showBodyMetal || profile.showProductKind,
    staleTime: 5 * 60_000,
  })
  const stock = useQuery({
    queryKey: ['warehouse-stock', warehouseCode, 'layers'],
    queryFn: async () => {
      const data = await getWarehouseStockApi(warehouseCode, { layers: true })
      queryClient.setQueryData(['warehouse-stock', warehouseCode], data)
      return data
    },
    staleTime: 60_000,
    placeholderData: (previous) =>
      previous ?? queryClient.getQueryData<StockResponse>(['warehouse-stock', warehouseCode]),
    enabled: dialog.open,
  })
  const locationSlots = useQuery({
    queryKey: ['warehouse-locations', warehouseCode],
    queryFn: () => getLocationsApi(warehouseCode),
    staleTime: 60_000,
    enabled: profile.showLocation,
  })
  const orderOptionsQuery = useQuery({
    queryKey: ['production-order-options'],
    queryFn: () => listOrderOptionsApi(),
    staleTime: 60_000,
    enabled: dialog.open,
  })
  const orderOptions: SearchSelectOption[] = useMemo(
    () =>
      (orderOptionsQuery.data ?? []).map((order) => ({
        id: order.code,
        name: order.code,
        secondary: `${STATUS_META[order.status].label} · ${order.description}`,
      })),
    [orderOptionsQuery.data],
  )

  const units = useMemo(() => lookups.data?.units ?? [], [lookups.data?.units])
  const users = useMemo(() => lookups.data?.users ?? [], [lookups.data?.users])
  const materials: StockMaterialOption[] = useMemo(
    () =>
      (stock.data?.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        unitId: item.unitId,
        unit: item.unit,
        qty: item.qty,
        priceLayers: item.priceLayers,
      })),
    [stock.data?.items],
  )
  const stockById = useMemo(() => {
    const map = new Map<string, StockRow>()
    for (const item of stock.data?.items ?? []) map.set(item.id, item)
    return map
  }, [stock.data?.items])

  const items = useMemo(() => outbounds.data?.items ?? [], [outbounds.data?.items])
  const apiTotals = outbounds.data?.totals
  const stockItems = useMemo(() => stock.data?.items ?? [], [stock.data?.items])
  const catalogFilters = useCatalogFilterOptions(profile, lookups.data, btpCatalogs.data, stockItems)

  const issuerOptions = useMemo(() => uniqueFilterOptions(items.map((row) => row.issuedBy)), [items])
  const receiverOptions = useMemo(
    () => uniqueFilterOptions(items.map((row) => row.receivedBy)),
    [items],
  )
  const unitOptions = useMemo(() => uniqueFilterOptions(items.map((row) => row.unit)), [items])
  const orderCodeOptions = useMemo(
    () => uniqueFilterOptions(items.map((row) => row.productionOrderCode)),
    [items],
  )
  const locationOptions = useMemo(() => {
    const names = new Set<string>()
    for (const slot of locationSlots.data?.items ?? []) names.add(slot.code)
    for (const row of stock.data?.items ?? []) {
      const loc = row.locationCode?.trim()
      if (loc) names.add(loc)
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map((name) => ({ id: name, name }))
  }, [locationSlots.data?.items, stock.data?.items])

  const lines = useMemo(() => {
    const nameQuery = params.search.trim().toLocaleLowerCase('vi')
    return items.filter((row) => {
      const catalog = row.materialId ? stockById.get(row.materialId) : undefined
      if (nameQuery && !row.name.toLocaleLowerCase('vi').includes(nameQuery)) return false
      if (showUnit && params.unit && row.unit !== params.unit && row.unitId !== params.unit) return false
      if (
        outboundProfile.showShapeColor &&
        params.color &&
        catalog?.colorId !== params.color &&
        catalog?.color !== params.color
      ) {
        return false
      }
      if (!matchesCatalogFilters(catalog, catalogFilterParams, outboundProfile)) return false
      if (params.issuedBy && (row.issuedBy ?? '').trim() !== params.issuedBy) return false
      if (params.receivedBy && (row.receivedBy ?? '').trim() !== params.receivedBy) return false
      if (params.productionOrderCode && row.productionOrderCode !== params.productionOrderCode) {
        return false
      }
      return true
    })
  }, [catalogFilterParams, items, outboundProfile, params, showUnit, stockById])

  const rows = useMemo(() => groupOutboundRows(lines), [lines])
  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize
  const filtering =
    Boolean(
      params.search.trim() ||
        params.issuedBy ||
        params.receivedBy ||
        params.productionOrderCode ||
        (showUnit && params.unit) ||
        (outboundProfile.showShapeColor && params.color),
    ) || hasActiveCatalogFilters(catalogFilterParams)
  const totals = filtering ? sumMoveTotals(lines) : apiTotals

  const outboundKey = ['warehouse-outbounds', warehouseCode] as const

  const save = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: CreateOutboundPayload }) =>
      id
        ? updateWarehouseOutboundApi(warehouseCode, await resolveRowId(id), payload)
        : createWarehouseOutboundApi(warehouseCode, payload),
    onMutate: (input) => {
      dialog.close()
      toast.success(
        input.id ? `Đã cập nhật ${profile.noun} xuất kho` : `Đã ghi phiếu xuất`,
      )
      void queryClient.cancelQueries({ queryKey: outboundKey })
      const previous = queryClient.getQueryData<OutboundResponse>(outboundKey)
      const tempId = input.id ?? newTempId()
      if (!input.id) registerTempId(tempId)
      const optimistic = outboundOptimisticRow(input.payload, {
        id: tempId,
        stt: input.id
          ? (previous?.items.find((item) => item.id === input.id)?.stt ?? 0)
          : (previous?.items.length ?? 0) + 1,
        issuedBy: operatorName,
        unit:
          input.payload.unitName ||
          units.find((unit) => unit.id === input.payload.unitId)?.name ||
          '',
        receivedBy:
          users.find((item) => item.id === input.payload.receivedByUserId)?.fullName ?? null,
      })
      queryClient.setQueryData(outboundKey, (current: OutboundResponse | undefined) =>
        upsertMoveList(current, optimistic, Boolean(input.id)),
      )
      if (!input.id) table.setPage(Math.ceil((lines.length + 1) / params.pageSize))
      return { previous, tempId }
    },
    onSuccess: (row, input, ctx) => {
      if (ctx?.tempId && isTempId(ctx.tempId)) resolveTempId(ctx.tempId, row.id)
      queryClient.setQueryData(outboundKey, (current: OutboundResponse | undefined) =>
        replaceMoveId(current, ctx?.tempId ?? row.id, row),
      )
      void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      const orderCode = input.payload.productionOrderCode?.trim()
      if (orderCode) {
        void queryClient.invalidateQueries({ queryKey: ['production-order-costing', orderCode] })
      }
      const dest = input.payload.destWarehouseCode
      if (dest && dest !== warehouseCode) {
        void queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', dest] })
        void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', dest] })
      }
    },
    onError: (error: Error, _input, ctx) => {
      if (ctx?.tempId && isTempId(ctx.tempId)) rejectTempId(ctx.tempId, error)
      if (ctx?.previous) queryClient.setQueryData(outboundKey, ctx.previous)
      toast.error(error.message)
    },
  })
  const saveMany = useMutation({
    mutationFn: async (payloads: CreateOutboundPayload[]) => {
      const rows: OutboundRow[] = []
      for (const payload of payloads) {
        rows.push(await createWarehouseOutboundApi(warehouseCode, payload))
      }
      return rows
    },
    onSuccess: (rows) => {
      toast.success(`Đã ghi ${rows.length} phiếu xuất`)
      void queryClient.invalidateQueries({ queryKey: outboundKey })
      void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo(() => {
    const stockOf = (row: OutboundGroup | OutboundRow) =>
      row.materialId ? stockById.get(row.materialId) : undefined
    const lineActions = (row: OutboundRow) => (
      <RowActions
        onView={() => openView(row)}
        onEdit={() => openEdit(row)}
        editDisabled={row.autoIssued}
        titles={
          row.autoIssued
            ? { edit: `Phiếu tự tạo khi lên đơn ${row.productionOrderCode ?? ''} — sửa trên đơn` }
            : undefined
        }
      />
    )
    return [
      {
        key: 'productionOrderCode',
        card: 'title' as const,
        header: 'Mã đơn SX',
        width: 120,
        sortable: true,
        filter: (
          <ColumnHeaderFilter
            valueId={params.productionOrderCode}
            options={orderCodeOptions}
            onChange={(id) => table.setFilter({ productionOrderCode: id })}
          />
        ),
        render: (row: OutboundGroup) =>
          row.productionOrderCode ? (
            <Link
              component={RouterLink}
              to={`/orders/${row.productionOrderCode}`}
              sx={{ fontWeight: 600 }}
              onClick={(event) => event.stopPropagation()}
            >
              {row.productionOrderCode}
            </Link>
          ) : (
            '—'
          ),
      },
      {
        key: 'issuedAt',
        card: 'meta' as const,
        header: 'Ngày xuất',
        width: 96,
        sortable: true,
        render: (row: OutboundGroup) =>
          row.lines.length > 1 ? null : formatStockedDate(row.issuedAt),
        renderSub: (line) => formatStockedDate(line.issuedAt),
      },
      ...withLineSub(
        catalogColumnsBeforeName(outboundProfile, stockOf, (row) => row.sku, {
          location: outboundProfile.showLocation
            ? { valueId: params.location, options: locationOptions, onChange: (id) => table.setFilter({ location: id }) }
            : undefined,
          shape: outboundProfile.showShapeColor
            ? { valueId: params.shape, options: catalogFilters.shapeOptions, onChange: (id) => table.setFilter({ shape: id }) }
            : undefined,
          color: outboundProfile.showShapeColor
            ? { valueId: params.color, options: catalogFilters.colorOptions, onChange: (id) => table.setFilter({ color: id }) }
            : undefined,
        }),
      ),
      {
        key: 'name',
        header: profile.nameLabel,
        width: 220,
        sortable: true,
        className: 'name-cell',
        cellSx: { overflow: 'visible', textOverflow: 'clip' },
        filter: <ColumnHeaderSearch value={params.search} onChange={table.setSearch} />,
        render: (row: OutboundGroup) => (row.lines.length > 1 ? null : row.name),
        renderSub: (line) => line.name,
      },
      ...(showUnit
        ? [
            {
              key: 'unit',
              header: 'Đơn vị tính',
              width: 88,
              filter: (
                <ColumnHeaderFilter
                  valueId={params.unit}
                  options={unitOptions}
                  onChange={(id) => table.setFilter({ unit: id })}
                />
              ),
              render: (row: OutboundGroup) => (row.lines.length > 1 ? null : row.unit),
              renderSub: (line: OutboundRow) => line.unit,
            } satisfies Column<OutboundGroup, OutboundRow>,
          ]
        : []),
      {
        key: 'qty',
        header: headerTotal('Số lượng', totals?.qty, formatQty),
        width: 120,
        numeric: true,
        sortable: true,
        render: (row: OutboundGroup) => (row.lines.length > 1 ? null : formatQty(row.qty)),
        renderSub: (line) => formatQty(line.qty),
      },
      {
        key: 'inboundUnitPrice',
        header: 'Đơn giá xuất',
        width: 168,
        align: 'right' as const,
        cellSx: {
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'normal',
          lineHeight: 1.35,
          overflow: 'visible',
          textOverflow: 'clip',
        },
        render: (row: OutboundGroup) =>
          row.lines.length > 1 ? null : (
            <PriceBreakdownView breakdown={row.priceBreakdown} fallback={row.inboundUnitPrice} />
          ),
        renderSub: (line) => (
          <PriceBreakdownView breakdown={line.priceBreakdown} fallback={line.inboundUnitPrice} />
        ),
      },
      {
        key: 'amount',
        header: headerTotal('Thành tiền', totals?.amount, formatMoney),
        width: 130,
        numeric: true,
        sortable: true,
        cellSx: { fontWeight: 700 },
        render: (row: OutboundGroup) => (row.lines.length > 1 ? null : formatMoney(row.amount)),
        renderSub: (line) => formatMoney(line.amount),
      },
      ...withLineSub(
        catalogColumnsAfterAmount(outboundProfile, stockOf, {
          kind:
            outboundProfile.showNvlCategory || outboundProfile.showBtpCategory
              ? { valueId: params.kind, options: catalogFilters.kindFilterOptions, onChange: (id) => table.setFilter({ kind: id }) }
              : undefined,
          type: outboundProfile.showType
            ? { valueId: params.stone, options: catalogFilters.typeFilterOptions, onChange: (id) => table.setFilter({ stone: id }) }
            : undefined,
          bodyMetal: outboundProfile.showBodyMetal
            ? {
                valueId: params.bodyMetal,
                options: catalogFilters.bodyMetalOptions,
                onChange: (id) => table.setFilter({ bodyMetal: id }),
              }
            : undefined,
          productKind: outboundProfile.showProductKind
            ? {
                valueId: params.productKind,
                options: catalogFilters.productKindOptions,
                onChange: (id) => table.setFilter({ productKind: id }),
              }
            : undefined,
        }),
      ),
      {
        key: 'note',
        header: 'Ghi chú',
        width: 108,
        ellipsis: true,
        className: 'note-cell',
        render: (row: OutboundGroup) => (row.lines.length > 1 ? null : (row.note ?? '—')),
        renderSub: (line) => line.note ?? '—',
      },
      {
        key: 'issuedBy',
        card: 'meta' as const,
        header: 'Người Xuất',
        width: 96,
        ellipsis: true,
        sortable: true,
        filter: (
          <ColumnHeaderFilter
            valueId={params.issuedBy}
            options={issuerOptions}
            onChange={(id) => table.setFilter({ issuedBy: id })}
          />
        ),
        render: (row: OutboundGroup) => (row.lines.length > 1 ? null : (row.issuedBy ?? '—')),
        renderSub: (line) => line.issuedBy ?? '—',
      },
      {
        key: 'receivedBy',
        header: 'Người Nhận',
        width: 96,
        ellipsis: true,
        filter: (
          <ColumnHeaderFilter
            valueId={params.receivedBy}
            options={receiverOptions}
            onChange={(id) => table.setFilter({ receivedBy: id })}
          />
        ),
        render: (row: OutboundGroup) => (row.lines.length > 1 ? null : (row.receivedBy ?? '—')),
        renderSub: (line) => line.receivedBy ?? '—',
      },
      {
        key: 'actions',
        card: 'actions' as const,
        header: 'Hành động',
        width: 120,
        align: 'center' as const,
        cellSx: { overflow: 'visible' },
        render: (row: OutboundGroup) =>
          row.lines.length > 1 ? null : lineActions(row.lines[0]),
        renderSub: (line) => lineActions(line),
      },
    ] satisfies Column<OutboundGroup, OutboundRow>[]
  }, [
    catalogFilters,
    issuerOptions,
    locationOptions,
    openEdit,
    openView,
    orderCodeOptions,
    params.bodyMetal,
    params.color,
    params.issuedBy,
    params.kind,
    params.location,
    params.productKind,
    params.productionOrderCode,
    params.receivedBy,
    params.search,
    params.shape,
    params.stone,
    params.unit,
    outboundProfile,
    profile,
    showUnit,
    receiverOptions,
    stockById,
    table.setFilter,
    table.setSearch,
    totals?.amount,
    totals?.qty,
    unitOptions,
  ])

  const pagedRows = useMemo(
    () => paginate(sortRows(rows, params.sort, params.dir), page, params.pageSize),
    [page, params.dir, params.pageSize, params.sort, rows],
  )

  return (
    <Stack spacing={1.25} sx={{ flex: { md: 1 }, minHeight: { md: 0 }, overflow: { xs: 'visible', md: 'hidden' } }}>
      <DataTable
        columns={columns}
        rows={pagedRows}
        rowKey={(row) => row.id}
        subRows={{
          get: (row) => (row.lines.length > 1 ? row.lines : []),
          key: (line) => line.id,
          label: (count) => `${count} dòng NVL`,
        }}
        loading={outbounds.isLoading}
        errorText={outbounds.error instanceof Error ? outbounds.error.message : undefined}
        emptyText={filtering ? 'Không có dòng xuất khớp bộ lọc.' : 'Chưa có dòng xuất kho.'}
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
        tableSx={{ '& .MuiTableCell-root.note-cell': { width: 108, maxWidth: 108 } }}
        toolbar={
          <>
            {filtering ? (
              <Button size="small" onClick={table.reset}>
                Xóa lọc
              </Button>
            ) : null}
            {warehouseCode === 'nvl-tieu-hao' ? (
              <>
                <Box sx={{ flex: 1, minWidth: 8 }} />
                <Button variant="contained" onClick={dialog.openCreate}>
                  {profile.outboundLabel}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <OutboundDialog
        open={dialog.open}
        kind={dialog.kind}
        row={dialog.row}
        readOnly={dialog.readOnly}
        saving={false}
        units={units}
        users={users}
        materials={materials}
        materialsLoading={stock.isFetching}
        orderOptions={orderOptions}
        warehouseCode={warehouseCode}
        operatorName={operatorName}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payloads) => {
          const id = dialog.kind === 'edit' ? dialog.row?.id : undefined
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

type OutboundLineValues = {
  name: string
  sku: string
  materialId: string | null
  unitId: string
  qty: string
}

type OutboundFormValues = {
  issuedAt: string
  note: string
  receivedByUserId: string
  productionOrderCode: string
  lines: OutboundLineValues[]
  editReason?: string
}

const EMPTY_OUTBOUND_LINE: OutboundLineValues = {
  name: '',
  sku: '',
  materialId: null,
  unitId: '',
  qty: '',
}

const EMPTY_OUTBOUND: OutboundFormValues = {
  issuedAt: '',
  note: '',
  receivedByUserId: '',
  productionOrderCode: '',
  lines: [EMPTY_OUTBOUND_LINE],
}

function OutboundDialog({
  open,
  kind,
  row,
  readOnly,
  saving,
  units,
  users,
  materials,
  materialsLoading,
  orderOptions,
  warehouseCode,
  operatorName,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  kind: 'create' | 'edit' | 'view'
  row: OutboundRow | null
  readOnly: boolean
  saving: boolean
  units: LookupItem[]
  users: DirectoryUser[]
  operatorName: string
  warehouseCode: string
  materials: StockMaterialOption[]
  materialsLoading?: boolean
  orderOptions: SearchSelectOption[]
  onClose: () => void
  onExited: () => void
  onSave: (payloads: CreateOutboundPayload[]) => void
}) {
  const profile = stockProfile(warehouseCode)
  const hideIssuedAt = warehouseCode === 'nvl-tieu-hao'
  const form = useForm<OutboundFormValues>({ defaultValues: EMPTY_OUTBOUND })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const watchedLines = useWatch({ control: form.control, name: 'lines' }) ?? []

  useEffect(() => {
    if (!open) return
    form.reset(
      row
        ? {
            issuedAt: row.issuedAt,
            note: row.note ?? '',
            receivedByUserId:
              row.receivedByUserId ??
              users.find(
                (item) => item.fullName === row.receivedBy || item.username === row.receivedBy,
              )?.id ??
              '',
            productionOrderCode: row.productionOrderCode ?? '',
            lines: [
              {
                name: row.name,
                sku: row.sku ?? '',
                materialId: row.materialId,
                unitId:
                  row.unitId ??
                  units.find((item) => item.name === row.unit)?.id ??
                  units[0]?.id ??
                  '',
                qty: qtyFromApi(row.qty),
              },
            ],
          }
        : {
            ...EMPTY_OUTBOUND,
            issuedAt: todayYmd(),
            lines: [{ ...EMPTY_OUTBOUND_LINE, unitId: units[0]?.id ?? '' }],
          },
    )
  }, [open, row, units, users, form])

  const unitOptions: SearchSelectOption[] = units.map((unit) => ({
    id: unit.id,
    name: unit.name,
  }))
  const userOptions: SearchSelectOption[] = users.map((item) => ({
    id: item.id,
    name: item.fullName,
    secondary: item.username,
  }))
  const fullScreen = useIsMobile()

  function submit(values: OutboundFormValues) {
    if (readOnly) return
    const payloads = values.lines
      .filter((line) => line.name.trim())
      .map((line) => ({
        issuedAt: hideIssuedAt && kind === 'create' ? todayYmd() : values.issuedAt,
        name: line.name.trim(),
        sku: line.sku.trim() || matchStockMaterial(materials, line.name)?.sku || undefined,
        materialId: line.materialId ?? matchStockMaterial(materials, line.name)?.id ?? null,
        unitId: line.unitId || undefined,
        unitName: units.find((unit) => unit.id === line.unitId)?.name,
        qty: line.qty,
        stockUnitPrice: '0',
        inboundUnitPrice: '0',
        amount: '0',
        note: values.note.trim() || undefined,
        receivedByUserId: values.receivedByUserId || undefined,
        applyToStock: !row,
        productionOrderCode: values.productionOrderCode || null,
        editReason: values.editReason?.trim() || undefined,
      }))
    if (!payloads.length) return
    onSave(payloads)
  }

  function lineStock(index: number) {
    const line = watchedLines[index]
    const selected = materials.find((item) => item.id === line?.materialId)
    const onHand = Number(qtyFromApi(selected?.qty ?? '0'))
    const reserved = watchedLines.reduce((sum, item, i) => {
      if (i === index || item.materialId !== line?.materialId) return sum
      return sum + (Number(item.qty) || 0)
    }, 0)
    const held =
      kind !== 'create' && row && row.materialId === line?.materialId
        ? Number(qtyFromApi(row.qty))
        : 0
    const available = onHand + held - reserved
    const qty = Number(line?.qty) || 0
    const remaining = available - qty
    const fifo = takeFifoLayers(selected?.priceLayers ?? [], qty)
    const amount =
      kind === 'create' ? fifo.amount : row ? String(Math.round(Number(row.amount) || 0)) : ''
    return { selected, available, remaining, qty, fifo, amount }
  }

  if (readOnly && row) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        fullScreen={fullScreen}
        maxWidth="md"
        slotProps={{ transition: { onExited } }}
      >
        <OutboundView row={row} profile={profile} onClose={onClose} />
      </Dialog>
    )
  }

  return (
    <CrudDialogShell<OutboundFormValues>
      open={open}
      kind={kind}
      titles={{
        create: profile.outboundLabel,
        edit: 'Chỉnh sửa phiếu xuất',
        view: 'Chi tiết phiếu xuất',
      }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitLabel={kind === 'create' ? profile.outboundLabel : undefined}
      onClose={onClose}
      onExited={onExited}
      editLog={row ? { entityType: 'outbound', entityId: row.id } : undefined}
    >
      <FormRow columns={hideIssuedAt ? 1 : 2} sx={{ mt: 1 }}>
        {hideIssuedAt ? null : (
          <FormTextField<OutboundFormValues>
            name="issuedAt"
            label="Ngày xuất"
            type="date"
            required
            readOnly={readOnly}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
        <FormSearchSelect<OutboundFormValues>
          name="productionOrderCode"
          label="Mã đơn SX"
          options={orderOptions}
          allowClear
          readOnly={readOnly}
          displayValue={row?.productionOrderCode ?? undefined}
          placeholder="Chọn đơn dùng NVL…"
          noOptionsText="Không có đơn đang sản xuất"
        />
      </FormRow>

      <Stack spacing={1.25}>
        {lines.fields.map((field, index) => {
          const line = watchedLines[index]
          const stock = lineStock(index)
          const availableText = !line?.materialId
            ? 'Chọn tên hàng'
            : stock.available <= 0
              ? 'Không có đủ số lượng để xuất'
              : `${formatQty(String(stock.available))}${stock.selected?.unit ? ` ${stock.selected.unit}` : ''}`
          const availableHelper = !line?.materialId
            ? 'Tồn hiện tại, trừ dần khi xuất'
            : stock.available <= 0
              ? 'Hàng này đã hết tồn'
              : line.qty
                ? stock.remaining < 0
                  ? 'Vượt quá số lượng sẵn có'
                  : `Còn lại ${formatQty(String(stock.remaining))}${stock.selected?.unit ? ` ${stock.selected.unit}` : ''}`
                : 'Tồn hiện tại, trừ dần khi xuất'
          const availableError = Boolean(
            line?.materialId && (stock.available <= 0 || (line.qty && stock.remaining < 0)),
          )
          return (
            <Paper key={field.id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <FormRow>
                    <MaterialField
                      control={form.control as unknown as Control<any>}
                      name={`lines.${index}.name`}
                      kind={kind}
                      readOnly={readOnly}
                      materials={materials}
                      loading={materialsLoading}
                      noun={profile.noun}
                      nameLabel={profile.nameLabel}
                      createLabel={profile.createLabel}
                      onSelect={(material) => {
                        if (!material) {
                          if (kind !== 'edit') form.setValue(`lines.${index}.materialId`, null)
                          form.setValue(`lines.${index}.sku`, '')
                          return
                        }
                        form.setValue(`lines.${index}.materialId`, material.id)
                        form.setValue(`lines.${index}.sku`, material.sku ?? '')
                        if (material.unitId) form.setValue(`lines.${index}.unitId`, material.unitId)
                        if (Number(qtyFromApi(material.qty ?? '0')) <= 0) {
                          form.setValue(`lines.${index}.qty`, '')
                        }
                      }}
                    />
                    <TextInput label={profile.skuLabel} value={line?.sku || '—'} readOnly />
                  </FormRow>
                  <FormRow columns={3}>
                    <FormSearchSelect<OutboundFormValues>
                      name={`lines.${index}.unitId`}
                      label="Đơn vị tính"
                      options={unitOptions}
                      required
                      readOnly={readOnly}
                      displayValue={index === 0 ? row?.unit : undefined}
                      placeholder="Tìm đơn vị…"
                    />
                    <TextInput
                      label="SL sẵn có"
                      value={availableText}
                      readOnly
                      helperText={availableHelper}
                      errorText={availableError ? availableHelper : undefined}
                    />
                    <FormQtyField<OutboundFormValues>
                      name={`lines.${index}.qty`}
                      label="Số lượng xuất"
                      required
                      readOnly={readOnly}
                      disabled={stock.available <= 0}
                      rules={{
                        validate: (value) => {
                          const next = Number(value) || 0
                          const current = lineStock(index)
                          if (next <= 0) return 'Số lượng xuất phải lớn hơn 0'
                          if (current.available <= 0) return 'Không có đủ số lượng để xuất'
                          if (next > current.available) {
                            return `SL sẵn có ${formatQty(String(current.available))}, không xuất quá số này`
                          }
                          return true
                        },
                      }}
                    />
                  </FormRow>
                  <FormRow>
                    <TextInput
                      label="Đơn giá xuất"
                      value={
                        kind === 'create'
                          ? stock.fifo.label
                          : formatPriceBreakdown(row?.priceBreakdown, row?.inboundUnitPrice)
                      }
                      readOnly
                      multiline
                    />
                    <TextInput
                      label="Thành tiền"
                      value={stock.amount ? formatMoney(stock.amount) : ''}
                      readOnly
                    />
                  </FormRow>
                  <Typography variant="caption" color="text.secondary">
                    Hết số lượng giá cũ (tồn đầu kỳ) rồi mới đến giá nhập mới.
                  </Typography>
                </Box>
                {kind === 'create' ? (
                  <LineActions
                    addLabel={`Thêm ${profile.noun}`}
                    removeLabel={`Xóa ${profile.noun}`}
                    onAdd={() =>
                      lines.insert(
                        index + 1,
                        {
                          ...EMPTY_OUTBOUND_LINE,
                          unitId: form.getValues('lines.0.unitId') || units[0]?.id || '',
                        },
                        { shouldFocus: false },
                      )
                    }
                    onRemove={() => {
                      if (lines.fields.length <= 1) {
                        form.setValue('lines', [
                          { ...EMPTY_OUTBOUND_LINE, unitId: units[0]?.id ?? '' },
                        ])
                        return
                      }
                      lines.remove(index)
                    }}
                    removeDisabled={lines.fields.length <= 1 && !line?.name}
                  />
                ) : null}
              </Stack>
            </Paper>
          )
        })}
      </Stack>

      <FormRow>
        <TextInput
          label="Người Xuất"
          value={row?.issuedBy || operatorName || '—'}
          readOnly
        />
        <FormSearchSelect<OutboundFormValues>
          name="receivedByUserId"
          label="Người Nhận"
          options={userOptions}
          required
          readOnly={readOnly}
          displayValue={row?.receivedBy ?? undefined}
          placeholder="Tìm tài khoản…"
        />
      </FormRow>

      <FormTextField<OutboundFormValues>
        name="note"
        label="Ghi chú"
        readOnly={readOnly}
        multiline
        minRows={2}
        maxRows={6}
        sx={{
          '& textarea': {
            overflowWrap: 'anywhere',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
            overflowX: 'hidden',
          },
        }}
      />
    </CrudDialogShell>
  )
}

function PriceBreakdownView({
  breakdown,
  fallback,
}: {
  breakdown?: { qty: string; unitPrice: string; source: 'opening' | 'inbound' }[]
  fallback: string
}) {
  const lines = formatPriceBreakdownLines(breakdown, fallback)
  if (lines.length === 0) return '—'
  if (lines.length === 1) return lines[0]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25 }}>
      {lines.map((line) => (
        <Box key={line} component="span">
          {line}
        </Box>
      ))}
    </Box>
  )
}

function formatPriceBreakdown(
  breakdown?: { qty: string; unitPrice: string; source?: 'opening' | 'inbound' }[],
  fallback?: string,
) {
  return formatPriceBreakdownLines(breakdown, fallback).join('\n')
}

function formatPriceBreakdownLines(
  breakdown?: { qty: string; unitPrice: string; source?: 'opening' | 'inbound' }[],
  fallback?: string,
) {
  if (breakdown && breakdown.length > 0) {
    return breakdown.map(
      (item) =>
        `${formatQty(item.qty)} × ${formatMoney(item.unitPrice)} (${sourceLabel(item.source)})`,
    )
  }
  if (fallback && Number(fallback) > 0) return [formatPriceOrDash(fallback)]
  return []
}

function sourceLabel(source?: 'opening' | 'inbound') {
  return source === 'opening' ? 'đầu kỳ' : 'nhập'
}

function takeFifoLayers(
  layers: { qty: string; unitPrice: string; source?: 'opening' | 'inbound' }[],
  qty: number,
) {
  let need = qty
  let amount = 0
  const parts: string[] = []
  for (const layer of layers) {
    if (need <= 0) break
    const left = Number(layer.qty)
    const price = Number(layer.unitPrice)
    if (!Number.isFinite(left) || left <= 0) continue
    const take = Math.min(left, need)
    amount += take * (Number.isFinite(price) ? price : 0)
    parts.push(
      `${formatQty(String(take))} × ${formatMoney(String(Math.round(price || 0)))} (${sourceLabel(layer.source)})`,
    )
    need -= take
  }
  return {
    amount: qty > 0 && need <= 0 ? String(Math.round(amount)) : '',
    label: parts.join('\n'),
  }
}

type OutboundGroup = OutboundRow & { lines: OutboundRow[] }

function sameValue(lines: OutboundRow[], pick: (row: OutboundRow) => string) {
  const first = pick(lines[0])
  return lines.every((row) => pick(row) === first)
}

function groupOutboundRows(items: OutboundRow[]): OutboundGroup[] {
  const grouped = new Map<string, OutboundRow[]>()
  const order: Array<{ code: string } | { row: OutboundRow }> = []
  for (const row of items) {
    const code = row.productionOrderCode?.trim()
    if (!code) {
      order.push({ row })
      continue
    }
    const key = code.toUpperCase()
    if (!grouped.has(key)) {
      grouped.set(key, [])
      order.push({ code: key })
    }
    grouped.get(key)!.push(row)
  }
  return order.map((item) =>
    'row' in item ? asOutboundGroup([item.row]) : asOutboundGroup(grouped.get(item.code)!),
  )
}

function asOutboundGroup(lines: OutboundRow[]): OutboundGroup {
  const primary = lines[0]
  const qty = lines.reduce((sum, row) => sum + (Number(row.qty) || 0), 0)
  const amount = lines.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const issuedAt = lines.reduce((latest, row) => (row.issuedAt > latest ? row.issuedAt : latest), primary.issuedAt)
  return {
    ...primary,
    id: lines.length === 1 ? primary.id : `order:${(primary.productionOrderCode ?? '').toUpperCase()}`,
    qty: String(qty),
    amount: String(amount),
    issuedAt,
    sku: lines.length === 1 ? primary.sku : null,
    materialId: lines.length === 1 ? primary.materialId : null,
    inboundUnitPrice: lines.length === 1 ? primary.inboundUnitPrice : '',
    priceBreakdown: lines.length === 1 ? primary.priceBreakdown : undefined,
    name: lines.length === 1 ? primary.name : `${lines.length} NVL`,
    note: lines.length === 1 || sameValue(lines, (row) => row.note ?? '') ? primary.note : null,
    unit: sameValue(lines, (row) => row.unit) ? primary.unit : '',
    issuedBy: sameValue(lines, (row) => row.issuedBy ?? '') ? primary.issuedBy : null,
    receivedBy: sameValue(lines, (row) => row.receivedBy ?? '') ? primary.receivedBy : null,
    autoIssued: lines.every((row) => row.autoIssued),
    lines,
  }
}

function todayYmd() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function withLineSub(columns: Column<OutboundGroup>[]): Column<OutboundGroup, OutboundRow>[] {
  return columns.map((col) => ({
    ...col,
    render: (row, index) => (row.lines.length > 1 ? null : col.render?.(row, index)),
    renderSub: (line) =>
      col.render
        ? col.render(asOutboundGroup([line]), 0)
        : ((line as Record<string, unknown>)[col.key] as string),
  }))
}

function outboundOptimisticRow(
  payload: CreateOutboundPayload,
  extra: {
    id: string
    stt: number
    issuedBy: string
    unit: string
    receivedBy: string | null
  },
): OutboundRow {
  return {
    id: extra.id,
    stt: extra.stt,
    issuedAt: payload.issuedAt,
    name: payload.name,
    sku: payload.sku ?? null,
    unit: extra.unit,
    unitId: payload.unitId ?? null,
    qty: payload.qty,
    stockUnitPrice: payload.stockUnitPrice ?? '0',
    inboundUnitPrice: payload.inboundUnitPrice ?? '0',
    amount: payload.amount ?? '0',
    note: payload.note ?? null,
    issuedBy: extra.issuedBy,
    receivedBy: extra.receivedBy,
    receivedByUserId: payload.receivedByUserId ?? null,
    materialId: payload.materialId ?? null,
    destWarehouseCode: payload.destWarehouseCode ?? null,
    productionOrderCode: payload.productionOrderCode?.trim().toUpperCase() || null,
  }
}
