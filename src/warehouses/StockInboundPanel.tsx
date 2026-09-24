import { useEffect, useMemo } from 'react'
import { Box, Button, Dialog, Paper, Stack } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createWarehouseInboundApi,
  formatMoney,
  formatQty,
  formatInboundDateTime,
  getInventoryLookupsApi,
  getWarehouseInboundsApi,
  getWarehouseStockApi,
  moneyDigitsFromApi,
  qtyFromApi,
  updateWarehouseInboundApi,
  type CreateInboundPayload,
  type InboundResponse,
  type InboundRow,
  type LookupItem,
  type StockRow,
} from '../api/inventory'
import { listCatalogsApi } from '../api/catalogs'
import { getLocationsApi } from '../api/locations'
import {
  ColumnHeaderFilter,
  ColumnHeaderSearch,
  CrudDialogShell,
  DataTable,
  FormMoneyField,
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
import { InboundView } from './MovementView'
import { LineActions } from './LineActions'
import { MaterialField } from './MaterialField'
import type { StockMaterialOption } from './MaterialNameField'
import type { SearchSelectOption } from './SearchSelect'
import { catalogColumnsAfterAmount, catalogColumnsBeforeName } from './catalogMoveColumns'
import { CONSUMABLE_CATEGORIES, stockProfile, withFallback } from './catalog'
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

export function StockInboundPanel({ warehouseCode }: { warehouseCode: string }) {
  const profile = stockProfile(warehouseCode)
  const inboundProfile = useMemo(() => {
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
  const dialog = useCrudDialog<InboundRow>()
  // Tách sẵn các callback ổn định để useMemo cột không chạy lại mỗi render.
  const { openView, openEdit } = dialog
  const table = useTableParams({
    pageSize: 8,
    filters: { ...CATALOG_FILTER_DEFAULTS, supplierId: '', enteredBy: '', unit: '', color: '' },
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

  const inbounds = useQuery({
    queryKey: ['warehouse-inbounds', warehouseCode],
    queryFn: () => getWarehouseInboundsApi(warehouseCode),
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
    queryKey: ['warehouse-stock', warehouseCode],
    queryFn: () => getWarehouseStockApi(warehouseCode),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    enabled: dialog.open,
  })
  const locationSlots = useQuery({
    queryKey: ['warehouse-locations', warehouseCode],
    queryFn: () => getLocationsApi(warehouseCode),
    staleTime: 60_000,
    enabled: profile.showLocation,
  })

  const units = useMemo(() => lookups.data?.units ?? [], [lookups.data?.units])
  const suppliers = useMemo(() => lookups.data?.suppliers ?? [], [lookups.data?.suppliers])
  const materials: StockMaterialOption[] = useMemo(
    () =>
      (stock.data?.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        unitId: item.unitId,
        unit: item.unit,
        locationCode: item.locationCode,
        otherClassId: item.otherClassId,
      })),
    [stock.data?.items],
  )
  const stockById = useMemo(() => {
    const map = new Map<string, StockRow>()
    for (const item of stock.data?.items ?? []) map.set(item.id, item)
    return map
  }, [stock.data?.items])

  const items = useMemo(() => inbounds.data?.items ?? [], [inbounds.data?.items])
  const apiTotals = inbounds.data?.totals
  const stockItems = useMemo(() => stock.data?.items ?? [], [stock.data?.items])
  const catalogFilters = useCatalogFilterOptions(profile, lookups.data, btpCatalogs.data, stockItems)

  const supplierOptions = useMemo(
    () => suppliers.map((item) => ({ id: item.id, name: item.name })),
    [suppliers],
  )
  const enteredByOptions = useMemo(
    () => uniqueFilterOptions(items.map((row) => row.enteredBy)),
    [items],
  )
  const unitOptions = useMemo(() => uniqueFilterOptions(items.map((row) => row.unit)), [items])
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

  const rows = useMemo(() => {
    const nameQuery = params.search.trim().toLocaleLowerCase('vi')
    return items.filter((row) => {
      const catalog = row.materialId ? stockById.get(row.materialId) : undefined
      if (nameQuery && !row.name.toLocaleLowerCase('vi').includes(nameQuery)) return false
      if (showUnit && params.unit && row.unit !== params.unit && row.unitId !== params.unit) return false
      if (
        inboundProfile.showShapeColor &&
        params.color &&
        catalog?.colorId !== params.color &&
        catalog?.color !== params.color
      ) {
        return false
      }
      if (!matchesCatalogFilters(catalog, catalogFilterParams, inboundProfile)) return false
      if (params.supplierId && row.supplierId !== params.supplierId) return false
      if (params.enteredBy && (row.enteredBy ?? '').trim() !== params.enteredBy) return false
      return true
    })
  }, [catalogFilterParams, items, params, inboundProfile, showUnit, stockById])

  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize
  const filtering =
    Boolean(
      params.search.trim() ||
        params.supplierId ||
        params.enteredBy ||
        (showUnit && params.unit) ||
        (inboundProfile.showShapeColor && params.color),
    ) || hasActiveCatalogFilters(catalogFilterParams)
  const totals = filtering ? sumMoveTotals(rows) : apiTotals

  const inboundKey = ['warehouse-inbounds', warehouseCode] as const

  const save = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: CreateInboundPayload }) =>
      id
        ? updateWarehouseInboundApi(warehouseCode, await resolveRowId(id), payload)
        : createWarehouseInboundApi(warehouseCode, payload),
    onMutate: (input) => {
      dialog.close()
      toast.success(
        input.id ? `Đã cập nhật ${profile.noun} nhập kho` : `Đã thêm ${profile.noun}`,
      )
      void queryClient.cancelQueries({ queryKey: inboundKey })
      const previous = queryClient.getQueryData<InboundResponse>(inboundKey)
      const tempId = input.id ?? newTempId()
      if (!input.id) registerTempId(tempId)
      const optimistic = inboundOptimisticRow(input.payload, {
        id: tempId,
        stt: input.id
          ? (previous?.items.find((item) => item.id === input.id)?.stt ?? 0)
          : (previous?.items.length ?? 0) + 1,
        enteredBy: operatorName,
        unit:
          input.payload.unitName ||
          units.find((unit) => unit.id === input.payload.unitId)?.name ||
          '',
        supplierName:
          suppliers.find((item) => item.id === input.payload.supplierId)?.name ?? null,
      })
      queryClient.setQueryData(inboundKey, (current: InboundResponse | undefined) =>
        upsertMoveList(current, optimistic, Boolean(input.id)),
      )
      if (!input.id) table.setPage(Math.ceil((rows.length + 1) / params.pageSize))
      return { previous, tempId }
    },
    onSuccess: (row, _input, ctx) => {
      if (ctx?.tempId && isTempId(ctx.tempId)) resolveTempId(ctx.tempId, row.id)
      queryClient.setQueryData(inboundKey, (current: InboundResponse | undefined) =>
        replaceMoveId(current, ctx?.tempId ?? row.id, row),
      )
      void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
    },
    onError: (error: Error, _input, ctx) => {
      if (ctx?.tempId && isTempId(ctx.tempId)) rejectTempId(ctx.tempId, error)
      if (ctx?.previous) queryClient.setQueryData(inboundKey, ctx.previous)
      toast.error(error.message)
    },
  })
  const saveMany = useMutation({
    mutationFn: async (payloads: CreateInboundPayload[]) => {
      const rows: InboundRow[] = []
      for (const payload of payloads) {
        rows.push(await createWarehouseInboundApi(warehouseCode, payload))
      }
      return rows
    },
    onSuccess: (rows) => {
      toast.success(`Đã thêm ${rows.length} ${profile.noun}`)
      void queryClient.invalidateQueries({ queryKey: inboundKey })
      void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo(() => {
    const stockOf = (row: InboundRow) =>
      row.materialId ? stockById.get(row.materialId) : undefined
    return [
      {
        key: 'receivedAt',
        card: 'meta' as const,
        header: 'Ngày nhập',
        width: 158,
        sortable: true,
        render: (row: InboundRow) => formatInboundDateTime(row.receivedAt),
      },
      ...catalogColumnsBeforeName(inboundProfile, stockOf, (row) => row.sku ?? stockOf(row)?.sku, {
        location: inboundProfile.showLocation
          ? { valueId: params.location, options: locationOptions, onChange: (id) => table.setFilter({ location: id }) }
          : undefined,
        shape: inboundProfile.showShapeColor
          ? { valueId: params.shape, options: catalogFilters.shapeOptions, onChange: (id) => table.setFilter({ shape: id }) }
          : undefined,
        color: inboundProfile.showShapeColor
          ? { valueId: params.color, options: catalogFilters.colorOptions, onChange: (id) => table.setFilter({ color: id }) }
          : undefined,
      }),
      {
        key: 'name',
        card: 'title' as const,
        header: profile.nameLabel,
        ellipsis: true,
        sortable: true,
        filter: <ColumnHeaderSearch value={params.search} onChange={table.setSearch} />,
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
            },
          ]
        : []),
      {
        key: 'qty',
        header: headerTotal('Số lượng', totals?.qty, formatQty),
        width: 120,
        numeric: true,
        sortable: true,
        render: (row: InboundRow) => formatQty(row.qty),
      },
      {
        key: 'unitPrice',
        header: 'Đơn giá',
        width: 108,
        numeric: true,
        sortable: true,
        render: (row: InboundRow) =>
          formatMoney(Number(row.unitPrice) ? row.unitPrice : row.stockUnitPrice),
      },
      {
        key: 'amount',
        header: headerTotal('Thành tiền', totals?.amount, formatMoney),
        width: 130,
        numeric: true,
        sortable: true,
        cellSx: { fontWeight: 700 },
        render: (row: InboundRow) => formatMoney(row.amount),
      },
      ...catalogColumnsAfterAmount(inboundProfile, stockOf, {
        kind:
          inboundProfile.showNvlCategory || inboundProfile.showBtpCategory
            ? { valueId: params.kind, options: catalogFilters.kindFilterOptions, onChange: (id) => table.setFilter({ kind: id }) }
            : undefined,
        type: inboundProfile.showType
          ? { valueId: params.stone, options: catalogFilters.typeFilterOptions, onChange: (id) => table.setFilter({ stone: id }) }
          : undefined,
        bodyMetal: inboundProfile.showBodyMetal
          ? {
              valueId: params.bodyMetal,
              options: catalogFilters.bodyMetalOptions,
              onChange: (id) => table.setFilter({ bodyMetal: id }),
            }
          : undefined,
        productKind: inboundProfile.showProductKind
          ? {
              valueId: params.productKind,
              options: catalogFilters.productKindOptions,
              onChange: (id) => table.setFilter({ productKind: id }),
            }
          : undefined,
      }),
      {
        key: 'note',
        header: 'Ghi chú',
        width: 120,
        ellipsis: true,
        render: (row: InboundRow) => row.note ?? '—',
      },
      {
        key: 'enteredBy',
        header: 'Người nhập',
        width: 110,
        ellipsis: true,
        sortable: true,
        filter: (
          <ColumnHeaderFilter
            valueId={params.enteredBy}
            options={enteredByOptions}
            onChange={(id) => table.setFilter({ enteredBy: id })}
          />
        ),
        render: (row: InboundRow) => row.enteredBy ?? '—',
      },
      {
        key: 'supplierSku',
        header: 'Mã hàng NCC',
        width: 100,
        ellipsis: true,
        render: (row: InboundRow) => row.supplierSku ?? '—',
      },
      {
        key: 'supplierName',
        card: 'meta' as const,
        header: 'NCC',
        width: 92,
        ellipsis: true,
        filter: (
          <ColumnHeaderFilter
            valueId={params.supplierId}
            options={supplierOptions}
            onChange={(id) => table.setFilter({ supplierId: id })}
          />
        ),
        render: (row: InboundRow) => row.supplierName ?? '—',
      },
      {
        key: 'actions',
        card: 'actions' as const,
        header: 'Hành động',
        width: 120,
        align: 'center' as const,
        cellSx: { overflow: 'visible' },
        render: (row: InboundRow) => (
          <RowActions
            onView={() => openView(row)}
            onEdit={() => openEdit(row)}
            editDisabled={Boolean(row.sourceWarehouseCode)}
            titles={
              row.sourceWarehouseCode
                ? { edit: 'Phiếu chuyển kho — không sửa tại đây' }
                : undefined
            }
          />
        ),
      },
    ]
  }, [
    catalogFilters,
    enteredByOptions,
    locationOptions,
    openEdit,
    openView,
    params.bodyMetal,
    params.color,
    params.enteredBy,
    params.kind,
    params.location,
    params.productKind,
    params.search,
    params.shape,
    params.stone,
    params.supplierId,
    params.unit,
    inboundProfile,
    profile,
    showUnit,
    stockById,
    supplierOptions,
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
        loading={inbounds.isLoading}
        errorText={inbounds.error instanceof Error ? inbounds.error.message : undefined}
        emptyText={filtering ? 'Không có dòng nhập khớp bộ lọc.' : 'Chưa có dòng nhập kho.'}
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
            <Button variant="contained" onClick={dialog.openCreate}>
              {profile.inboundLabel}
            </Button>
          </>
        }
      />

      <InboundDialog
        open={dialog.open}
        kind={dialog.kind}
        row={dialog.row}
        readOnly={dialog.readOnly}
        saving={false}
        units={units}
        suppliers={suppliers}
        materials={materials}
        materialsLoading={stock.isFetching}
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

type InboundLineValues = {
  name: string
  sku: string
  materialId: string | null
  unitId: string
  otherClassId: string
  qty: string
  unitPrice: string
}

type InboundFormValues = {
  receivedAt: string
  note: string
  supplierSku: string
  supplierId: string
  lines: InboundLineValues[]
  editReason?: string
}

const EMPTY_INBOUND_LINE: InboundLineValues = {
  name: '',
  sku: '',
  materialId: null,
  unitId: '',
  otherClassId: '',
  qty: '',
  unitPrice: '',
}

const EMPTY_INBOUND: InboundFormValues = {
  receivedAt: '',
  note: '',
  supplierSku: '',
  supplierId: '',
  lines: [EMPTY_INBOUND_LINE],
}

function InboundDialog({
  open,
  kind,
  row,
  readOnly,
  saving,
  units,
  suppliers,
  materials,
  warehouseCode,
  operatorName,
  materialsLoading,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  kind: 'create' | 'edit' | 'view'
  row: InboundRow | null
  readOnly: boolean
  saving: boolean
  units: LookupItem[]
  suppliers: LookupItem[]
  materials: StockMaterialOption[]
  materialsLoading?: boolean
  warehouseCode: string
  operatorName: string
  onClose: () => void
  onExited: () => void
  onSave: (payloads: CreateInboundPayload[]) => void
}) {
  const form = useForm<InboundFormValues>({ defaultValues: EMPTY_INBOUND })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const watchedLines = useWatch({ control: form.control, name: 'lines' }) ?? []
  const profile = stockProfile(warehouseCode)
  const nvlCatalogs = useQuery({
    queryKey: ['catalogs', 'CATALOG'],
    queryFn: () => listCatalogsApi('CATALOG'),
    enabled: open && Boolean(profile.typeCodes),
    staleTime: 5 * 60_000,
  })
  const lookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    enabled: open && Boolean(profile.typeCodes),
    staleTime: 30 * 60_000,
  })

  useEffect(() => {
    if (!open) return
    form.reset(
      row
        ? {
            receivedAt: row.receivedAt.slice(0, 10),
            note: row.note ?? '',
            supplierSku: row.supplierSku ?? '',
            supplierId: row.supplierId ?? '',
            lines: [
              {
                name: row.name,
                sku:
                  row.sku ??
                  materials.find((item) => item.id === row.materialId)?.sku ??
                  '',
                materialId: row.materialId,
                unitId:
                  row.unitId ??
                  units.find((item) => item.name === row.unit)?.id ??
                  units[0]?.id ??
                  '',
                otherClassId:
                  materials.find((item) => item.id === row.materialId)?.otherClassId ?? '',
                qty: qtyFromApi(row.qty),
                unitPrice: moneyDigitsFromApi(
                  Number(row.unitPrice) ? row.unitPrice : row.stockUnitPrice,
                ),
              },
            ],
          }
        : {
            ...EMPTY_INBOUND,
            receivedAt: new Date().toISOString().slice(0, 10),
            lines: [{ ...EMPTY_INBOUND_LINE, unitId: units[0]?.id ?? '' }],
          },
    )
  }, [open, row, units, materials, form])

  const unitOptions: SearchSelectOption[] = units.map((unit) => ({
    id: unit.id,
    name: unit.name,
  }))
  const supplierOptions: SearchSelectOption[] = suppliers.map((item) => ({
    id: item.id,
    name: item.name,
  }))

  const consumableOptions = withFallback(
    lookups.data?.consumableCategories,
    CONSUMABLE_CATEGORIES.flatMap((item) => {
      const hit = nvlCatalogs.data?.find((row) => row.code === item.code && !row.parentId)
      return hit ? [{ id: hit.id, code: hit.code, name: hit.name }] : []
    }),
  )

  const fullScreen = useIsMobile()

  function submit(values: InboundFormValues) {
    if (readOnly) return
    const payloads = values.lines
      .filter((line) => line.name.trim())
      .map((line) => ({
        receivedAt: values.receivedAt,
        name: line.name.trim(),
        sku: line.sku.trim() || undefined,
        materialId: line.materialId,
        unitId: line.unitId || undefined,
        unitName: units.find((unit) => unit.id === line.unitId)?.name,
        qty: line.qty,
        stockUnitPrice: '0',
        unitPrice: line.unitPrice || '0',
        amount: String(Math.round((Number(line.qty) || 0) * (Number(line.unitPrice) || 0))),
        note: values.note.trim() || undefined,
        supplierSku: values.supplierSku.trim() || undefined,
        supplierId: values.supplierId || undefined,
        applyToStock: !row,
        otherClassId: line.otherClassId || null,
        editReason: values.editReason?.trim() || undefined,
      }))
    if (!payloads.length) return
    onSave(payloads)
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
        <InboundView row={row} profile={profile} onClose={onClose} />
      </Dialog>
    )
  }

  return (
    <CrudDialogShell<InboundFormValues>
      open={open}
      kind={kind}
      titles={{
        create: profile.inboundLabel,
        edit: `Chỉnh sửa ${profile.noun}`,
        view: `Chi tiết ${profile.noun}`,
      }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitLabel={kind === 'create' ? profile.inboundLabel : undefined}
      onClose={onClose}
      onExited={onExited}
      editLog={row ? { entityType: 'inbound', entityId: row.id } : undefined}
    >
      <FormRow columns={2} sx={{ mt: 1 }}>
        <FormTextField<InboundFormValues>
          name="receivedAt"
          label="Ngày nhập"
          type="date"
          required
          readOnly={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextInput
          label="Người nhập"
          value={row?.enteredBy || operatorName || '—'}
          readOnly
        />
      </FormRow>

      <Stack spacing={1.25}>
        {lines.fields.map((field, index) => {
          const line = watchedLines[index]
          const lineAmount = String(
            Math.round((Number(line?.qty) || 0) * (Number(line?.unitPrice) || 0)),
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
                      allowCreate={Boolean(profile.typeCodes)}
                      onSelect={(material) => {
                        if (!material) {
                          if (kind !== 'edit') form.setValue(`lines.${index}.materialId`, null)
                          form.setValue(`lines.${index}.sku`, '')
                          return
                        }
                        form.setValue(`lines.${index}.materialId`, material.id)
                        form.setValue(`lines.${index}.sku`, material.sku ?? '')
                        if (material.unitId) form.setValue(`lines.${index}.unitId`, material.unitId)
                        form.setValue(`lines.${index}.otherClassId`, material.otherClassId ?? '')
                      }}
                    />
                    <TextInput label={profile.skuLabel} value={line?.sku || '—'} readOnly />
                  </FormRow>
                  {profile.typeCodes ? (
                    <FormSearchSelect<InboundFormValues>
                      name={`lines.${index}.otherClassId`}
                      label="Danh mục"
                      options={consumableOptions}
                      required={!line?.materialId}
                      readOnly={readOnly || Boolean(line?.materialId)}
                      placeholder="Chọn danh mục…"
                      rules={{
                        validate: (value) =>
                          Boolean(form.getValues(`lines.${index}.materialId`) || value) ||
                          'Vui lòng chọn danh mục',
                      }}
                    />
                  ) : null}
                  <FormRow columns={4}>
                    <FormSearchSelect<InboundFormValues>
                      name={`lines.${index}.unitId`}
                      label="Đơn vị tính"
                      options={unitOptions}
                      required
                      readOnly={readOnly}
                      displayValue={index === 0 ? row?.unit : undefined}
                      placeholder="Tìm đơn vị…"
                    />
                    <FormQtyField<InboundFormValues>
                      name={`lines.${index}.qty`}
                      label="Số lượng"
                      required
                      readOnly={readOnly}
                      rules={{
                        validate: (value) => (Number(value) || 0) > 0 || 'Số lượng phải lớn hơn 0',
                      }}
                    />
                    <FormMoneyField<InboundFormValues>
                      name={`lines.${index}.unitPrice`}
                      label="Đơn giá"
                      readOnly={readOnly}
                    />
                    <TextInput
                      label="Thành tiền"
                      value={Number(lineAmount) ? formatMoney(lineAmount) : ''}
                      readOnly
                    />
                  </FormRow>
                </Box>
                {kind === 'create' ? (
                  <LineActions
                    addLabel={`Thêm ${profile.noun}`}
                    removeLabel={`Xóa ${profile.noun}`}
                    onAdd={() =>
                      lines.insert(
                        index + 1,
                        {
                          ...EMPTY_INBOUND_LINE,
                          unitId: form.getValues('lines.0.unitId') || units[0]?.id || '',
                        },
                        { shouldFocus: false },
                      )
                    }
                    onRemove={() => {
                      if (lines.fields.length <= 1) {
                        form.setValue('lines', [
                          { ...EMPTY_INBOUND_LINE, unitId: units[0]?.id ?? '' },
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
        <FormSearchSelect<InboundFormValues>
          name="supplierId"
          label="NCC"
          options={supplierOptions}
          allowClear
          readOnly={readOnly}
          displayValue={row?.supplierName ?? undefined}
          placeholder="Tìm NCC…"
        />
        <FormTextField<InboundFormValues>
          name="supplierSku"
          label="Mã hàng NCC"
          readOnly={readOnly}
        />
      </FormRow>

      <FormTextField<InboundFormValues>
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

function inboundOptimisticAt(ymd: string) {
  const day = ymd.slice(0, 10)
  const now = new Date()
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${day}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function inboundOptimisticRow(
  payload: CreateInboundPayload,
  extra: {
    id: string
    stt: number
    enteredBy: string
    unit: string
    supplierName: string | null
  },
): InboundRow {
  return {
    id: extra.id,
    stt: extra.stt,
    receivedAt: payload.receivedAt.includes('T')
      ? payload.receivedAt
      : inboundOptimisticAt(payload.receivedAt),
    name: payload.name,
    sku: payload.sku ?? null,
    unit: extra.unit,
    unitId: payload.unitId ?? null,
    qty: payload.qty,
    stockUnitPrice: payload.stockUnitPrice ?? '0',
    unitPrice: payload.unitPrice ?? '0',
    amount: payload.amount ?? '0',
    note: payload.note ?? null,
    enteredBy: extra.enteredBy,
    supplierSku: payload.supplierSku ?? null,
    supplierId: payload.supplierId ?? null,
    supplierName: extra.supplierName,
    materialId: payload.materialId ?? null,
  }
}
