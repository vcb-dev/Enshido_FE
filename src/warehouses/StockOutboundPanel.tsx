import { useEffect, useMemo } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createWarehouseOutboundApi,
  deleteWarehouseOutboundApi,
  formatMoney,
  formatPriceOrDash,
  formatQty,
  formatStockedDate,
  getInventoryLookupsApi,
  getWarehouseOutboundsApi,
  getWarehouseStockApi,
  moneyDigitsFromApi,
  qtyFromApi,
  updateWarehouseOutboundApi,
  type CreateOutboundPayload,
  type DirectoryUser,
  type LookupItem,
  type OutboundResponse,
  type OutboundRow,
  type StockRow,
} from '../api/inventory'
import { listCatalogsApi } from '../api/catalogs'
import { getLocationsApi } from '../api/locations'
import {
  CrudDialogShell,
  DataTable,
  FormQtyField,
  FormRow,
  FormSearchSelect,
  FormTextField,
  RowActions,
  TextInput,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { useDeleteRowDialog } from '../hooks/useDeleteRowDialog'
import { deleteWhenReady, isTempId, newTempId, registerTempId, rejectTempId, resolveRowId, resolveTempId } from '../hooks/pendingRowId'
import { useOperatorName } from '../hooks/useOperatorName'
import { paginate, sortRows, useTableParams } from '../hooks/useTableParams'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { MaterialField } from './MaterialField'
import type { StockMaterialOption } from './MaterialNameField'
import type { SearchSelectOption } from './SearchSelect'
import { catalogColumnsAfterAmount, catalogColumnsBeforeName } from './catalogMoveColumns'
import { ColumnHeaderFilter, ColumnHeaderSearch } from './ColumnHeaderFilter'
import { stockProfile } from './catalog'
import {
  CATALOG_FILTER_DEFAULTS,
  hasActiveCatalogFilters,
  headerTotal,
  matchesCatalogFilters,
  removeMoveList,
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
    filters: { ...CATALOG_FILTER_DEFAULTS, issuedBy: '', receivedBy: '', unit: '', color: '' },
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
    queryFn: () => getWarehouseStockApi(warehouseCode, { layers: true }),
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
      return true
    })
  }, [catalogFilterParams, items, outboundProfile, params, showUnit, stockById])

  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize
  const filtering =
    Boolean(
      params.search.trim() ||
        params.issuedBy ||
        params.receivedBy ||
        (showUnit && params.unit) ||
        (outboundProfile.showShapeColor && params.color),
    ) || hasActiveCatalogFilters(catalogFilterParams)
  const totals = filtering ? sumMoveTotals(rows) : apiTotals

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
      if (!input.id) table.setPage(Math.ceil((rows.length + 1) / params.pageSize))
      return { previous, tempId }
    },
    onSuccess: (row, input, ctx) => {
      if (ctx?.tempId && isTempId(ctx.tempId)) resolveTempId(ctx.tempId, row.id)
      queryClient.setQueryData(outboundKey, (current: OutboundResponse | undefined) =>
        replaceMoveId(current, ctx?.tempId ?? row.id, row),
      )
      void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
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

  const del = useDeleteRowDialog({
    mutationFn: (row: OutboundRow) =>
      deleteWhenReady(row.id, (id) => deleteWarehouseOutboundApi(warehouseCode, id)),
    successMessage: 'Đã xóa phiếu xuất',
    queryKeys: [['warehouse-outbounds', warehouseCode]],
    invalidateKeys: [['warehouse-stock', warehouseCode]],
    onRemoved: (row) => {
      queryClient.setQueryData(
        ['warehouse-outbounds', warehouseCode],
        (current: OutboundResponse | undefined) => removeMoveList(current, row.id),
      )
    },
  })

  const columns = useMemo(() => {
    const stockOf = (row: OutboundRow) =>
      row.materialId ? stockById.get(row.materialId) : undefined
    return [
      {
        key: 'issuedAt',
        card: 'meta' as const,
        header: 'Ngày xuất',
        width: 96,
        sortable: true,
        render: (row: OutboundRow) => formatStockedDate(row.issuedAt),
      },
      ...catalogColumnsBeforeName(outboundProfile, stockOf, (row) => row.sku, {
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
      {
        key: 'name',
        card: 'title' as const,
        header: profile.nameLabel,
        width: 220,
        sortable: true,
        className: 'name-cell',
        cellSx: { overflow: 'visible', textOverflow: 'clip' },
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
        render: (row: OutboundRow) => formatQty(row.qty),
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
        render: (row: OutboundRow) => (
          <PriceBreakdownView breakdown={row.priceBreakdown} fallback={row.inboundUnitPrice} />
        ),
      },
      {
        key: 'amount',
        header: headerTotal('Thành tiền', totals?.amount, formatMoney),
        width: 130,
        numeric: true,
        sortable: true,
        cellSx: { fontWeight: 700 },
        render: (row: OutboundRow) => formatMoney(row.amount),
      },
      ...catalogColumnsAfterAmount(outboundProfile, stockOf, {
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
      {
        key: 'note',
        header: 'Ghi chú',
        width: 108,
        ellipsis: true,
        className: 'note-cell',
        render: (row: OutboundRow) => row.note ?? '—',
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
        render: (row: OutboundRow) => row.issuedBy ?? '—',
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
        render: (row: OutboundRow) => row.receivedBy ?? '—',
      },
      {
        key: 'actions',
        card: 'actions' as const,
        header: 'Hành động',
        width: 120,
        align: 'center' as const,
        cellSx: { overflow: 'visible' },
        render: (row: OutboundRow) => (
          <RowActions
            onView={() => openView(row)}
            onEdit={() => openEdit(row)}
            onDelete={() => del.request(row)}
          />
        ),
      },
    ]
  }, [
    catalogFilters,
    del.request,
    issuerOptions,
    locationOptions,
    openEdit,
    openView,
    params.bodyMetal,
    params.color,
    params.issuedBy,
    params.kind,
    params.location,
    params.productKind,
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
        loading={outbounds.isLoading}
        errorText={outbounds.error instanceof Error ? outbounds.error.message : undefined}
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
        tableSx={{ '& .MuiTableCell-root.note-cell': { width: 108, maxWidth: 108 } }}
        toolbar={
          <>
            {filtering ? (
              <Button size="small" onClick={table.reset}>
                Xóa lọc
              </Button>
            ) : null}
            <Box sx={{ flex: 1, minWidth: 8 }} />
            <Button variant="contained" onClick={dialog.openCreate}>
              {profile.outboundLabel}
            </Button>
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
        warehouseCode={warehouseCode}
        operatorName={operatorName}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) => {
          const id = dialog.kind === 'edit' ? dialog.row?.id : undefined
          dialog.close()
          save.mutate({ id, payload })
        }}
      />
      <ConfirmDeleteDialog
        open={Boolean(del.row)}
        title="Xóa phiếu xuất"
        description={
          del.row
            ? `Xóa dòng ${del.row.name} (${formatQty(del.row.qty)} ${del.row.unit})? Tồn kho sẽ được tính lại.`
            : ''
        }
        deleting={del.deleting}
        onClose={del.cancel}
        onConfirm={del.confirm}
      />
    </Stack>
  )
}

type OutboundFormValues = {
  issuedAt: string
  name: string
  sku: string
  materialId: string | null
  unitId: string
  qty: string
  inboundUnitPrice: string
  note: string
  receivedByUserId: string
}

const EMPTY_OUTBOUND: OutboundFormValues = {
  issuedAt: '',
  name: '',
  sku: '',
  materialId: null,
  unitId: '',
  qty: '',
  inboundUnitPrice: '',
  note: '',
  receivedByUserId: '',
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
  onClose: () => void
  onExited: () => void
  onSave: (payload: CreateOutboundPayload) => void
}) {
  const profile = stockProfile(warehouseCode)
  const form = useForm<OutboundFormValues>({ defaultValues: EMPTY_OUTBOUND })

  useEffect(() => {
    if (!open) return
    form.reset(
      row
        ? {
            issuedAt: row.issuedAt,
            name: row.name,
            sku: row.sku ?? '',
            materialId: row.materialId,
            unitId:
              row.unitId ?? units.find((item) => item.name === row.unit)?.id ?? units[0]?.id ?? '',
            qty: qtyFromApi(row.qty),
            inboundUnitPrice: moneyDigitsFromApi(row.inboundUnitPrice),
            note: row.note ?? '',
            receivedByUserId:
              row.receivedByUserId ??
              users.find(
                (item) => item.fullName === row.receivedBy || item.username === row.receivedBy,
              )?.id ??
              '',
          }
        : {
            ...EMPTY_OUTBOUND,
            issuedAt: new Date().toISOString().slice(0, 10),
            unitId: units[0]?.id ?? '',
          },
    )
  }, [open, row, units, users, form])

  const materialId = form.watch('materialId')
  const qty = form.watch('qty')
  const sku = form.watch('sku')
  const inboundUnitPrice = form.watch('inboundUnitPrice')

  const selected = materials.find((item) => item.id === materialId)
  const available = useMemo(() => {
    const onHand = Number(qtyFromApi(selected?.qty ?? '0'))
    // Khi sửa, số đã xuất của chính dòng này được cộng lại vào tồn khả dụng.
    if (kind !== 'create' && row && row.materialId === materialId) {
      return onHand + Number(qtyFromApi(row.qty))
    }
    return onHand
  }, [kind, materialId, row, selected?.qty])
  const remaining = available - (Number(qty) || 0)
  const fifo = useMemo(
    () => takeFifoLayers(selected?.priceLayers ?? [], Number(qty) || 0),
    [qty, selected?.priceLayers],
  )
  const amount =
    kind === 'create' ? fifo.amount : row ? String(Math.round(Number(row.amount) || 0)) : ''

  const unitOptions: SearchSelectOption[] = units.map((unit) => ({
    id: unit.id,
    name: unit.name,
  }))
  const userOptions: SearchSelectOption[] = users.map((item) => ({
    id: item.id,
    name: item.fullName,
    secondary: item.username,
  }))
  function submit(values: OutboundFormValues) {
    if (readOnly) return
    onSave({
      issuedAt: values.issuedAt,
      name: values.name.trim(),
      sku: values.sku.trim() || undefined,
      materialId: values.materialId,
      unitId: values.unitId || undefined,
      unitName: units.find((unit) => unit.id === values.unitId)?.name,
      qty: values.qty,
      stockUnitPrice: '0',
      inboundUnitPrice: '0',
      amount: '0',
      note: values.note.trim() || undefined,
      receivedByUserId: values.receivedByUserId || undefined,
      applyToStock: !row,
    })
  }

  const availableText = !materialId
    ? 'Chọn tên hàng'
    : available <= 0
      ? 'Không có đủ số lượng để xuất'
      : `${formatQty(String(available))}${selected?.unit ? ` ${selected.unit}` : ''}`

  const availableHelper = !materialId
    ? 'Tồn hiện tại, trừ dần khi xuất'
    : available <= 0
      ? 'Hàng này đã hết tồn'
      : qty
        ? remaining < 0
          ? 'Vượt quá số lượng sẵn có'
          : `Còn lại ${formatQty(String(remaining))}${selected?.unit ? ` ${selected.unit}` : ''}`
        : 'Tồn hiện tại, trừ dần khi xuất'

  const availableError = Boolean(materialId && (available <= 0 || (qty && remaining < 0)))

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
      submitDisabled={kind === 'create' && available <= 0}
      onClose={onClose}
      onExited={onExited}
    >
      <FormRow sx={{ mt: 1 }}>
        <FormTextField<OutboundFormValues>
          name="issuedAt"
          label="Ngày xuất"
          type="date"
          required
          readOnly={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormSearchSelect<OutboundFormValues>
          name="unitId"
          label="Đơn vị tính"
          options={unitOptions}
          required
          readOnly={readOnly}
          displayValue={row?.unit}
          placeholder="Tìm đơn vị…"
        />
      </FormRow>

      <FormRow>
        <MaterialField
          // Control<T> của RHF không gán được giữa các T khác nhau (hạn chế
          // variance của thư viện), nên MaterialField nhận Control<any> và ép kiểu ở đây.
          control={form.control as unknown as Control<any>}
          kind={kind}
          readOnly={readOnly}
          materials={materials}
          loading={materialsLoading}
          noun={profile.noun}
          nameLabel={profile.nameLabel}
          createLabel={profile.createLabel}
          onSelect={(material) => {
            if (!material) {
              if (kind !== 'edit') form.setValue('materialId', null)
              form.setValue('sku', '')
              return
            }
            form.setValue('materialId', material.id)
            form.setValue('sku', material.sku ?? '')
            if (material.unitId) form.setValue('unitId', material.unitId)
            if (Number(qtyFromApi(material.qty ?? '0')) <= 0) form.setValue('qty', '')
          }}
        />
        <TextInput label={profile.skuLabel} value={sku || '—'} readOnly />
      </FormRow>

      <FormRow>
        <TextInput
          label="SL sẵn có"
          value={availableText}
          readOnly
          helperText={availableHelper}
          errorText={availableError ? availableHelper : undefined}
        />
        <FormQtyField<OutboundFormValues>
          name="qty"
          label="Số lượng xuất"
          required
          readOnly={readOnly}
          disabled={available <= 0}
          rules={{
            validate: (value) => {
              const next = Number(value) || 0
              if (next <= 0) return 'Số lượng xuất phải lớn hơn 0'
              if (available <= 0) return 'Không có đủ số lượng để xuất'
              if (next > available) {
                return `SL sẵn có ${formatQty(String(available))}, không xuất quá số này`
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
              ? fifo.label
              : formatPriceBreakdown(row?.priceBreakdown, inboundUnitPrice)
          }
          readOnly
          multiline
        />
        <TextInput label="Thành tiền" value={amount ? formatMoney(amount) : ''} readOnly />
      </FormRow>
      <Typography variant="caption" color="text.secondary">
        Hết số lượng giá cũ (tồn đầu kỳ) rồi mới đến giá nhập mới.
      </Typography>

      <FormRow>
        <TextInput
          label="Người Xuất"
          value={row?.issuedBy || operatorName || '—'}
          required
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
  }
}
