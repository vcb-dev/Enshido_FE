import { useEffect, useMemo } from 'react'
import { Stack } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createWarehouseInboundApi,
  deleteWarehouseInboundApi,
  formatMoney,
  formatQty,
  formatStockedDate,
  getInventoryLookupsApi,
  getWarehouseInboundsApi,
  getWarehouseStockApi,
  moneyDigitsFromApi,
  qtyFromApi,
  updateWarehouseInboundApi,
  type CreateInboundPayload,
  type InboundRow,
  type LookupItem,
} from '../api/inventory'
import { getLocationsApi } from '../api/locations'
import {
  CrudDialogShell,
  DataTable,
  FormMoneyField,
  FormQtyField,
  FormRow,
  FormSearchSelect,
  FormTextField,
  PanelSummaryCard,
  PanelToolbar,
  RowActions,
  SelectInput,
  TextInput,
  type Column,
  type SelectOption,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { useDeleteRowDialog } from '../hooks/useDeleteRowDialog'
import { useOperatorName } from '../hooks/useOperatorName'
import { paginate, sortRows, useTableParams } from '../hooks/useTableParams'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { MaterialField } from './MaterialField'
import type { StockMaterialOption } from './MaterialNameField'
import type { SearchSelectOption } from './SearchSelect'

export function StockInboundPanel({ warehouseCode }: { warehouseCode: string }) {
  const operatorName = useOperatorName()
  const queryClient = useQueryClient()
  const dialog = useCrudDialog<InboundRow>()
  // Tách sẵn các callback ổn định để useMemo cột không chạy lại mỗi render.
  const { openView, openEdit } = dialog
  const table = useTableParams({ pageSize: 8, filters: { supplierId: '' } })
  const { params } = table

  const inbounds = useQuery({
    queryKey: ['warehouse-inbounds', warehouseCode],
    queryFn: () => getWarehouseInboundsApi(warehouseCode),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  })
  const lookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    staleTime: 30 * 60_000,
  })
  const stock = useQuery({
    queryKey: ['warehouse-stock', warehouseCode],
    queryFn: () => getWarehouseStockApi(warehouseCode),
    staleTime: 20_000,
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
      })),
    [stock.data?.items],
  )

  const items = useMemo(() => inbounds.data?.items ?? [], [inbounds.data?.items])
  const totals = inbounds.data?.totals

  const supplierOptions: SelectOption<string>[] = useMemo(
    () => suppliers.map((item) => ({ value: item.id, label: item.name })),
    [suppliers],
  )

  const rows = useMemo(() => {
    const keyword = params.search.trim().toLowerCase()
    return items.filter((row) => {
      if (params.supplierId && row.supplierId !== params.supplierId) return false
      if (!keyword) return true
      return [row.name, row.note ?? '', row.supplierSku ?? '', row.supplierName ?? ''].some(
        (field) => field.toLowerCase().includes(keyword),
      )
    })
  }, [items, params.search, params.supplierId])

  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize
  const filtering = Boolean(params.search || params.supplierId)

  const invalidateAll = () =>
    Promise.all(
      [
        ['warehouse-inbounds', warehouseCode],
        ['warehouse-stock', warehouseCode],
        ['warehouse-outbounds', warehouseCode],
        ['warehouse-locations', warehouseCode],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )

  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: CreateInboundPayload }) =>
      id
        ? updateWarehouseInboundApi(warehouseCode, id, payload)
        : createWarehouseInboundApi(warehouseCode, payload),
    onSuccess: async (_row, input) => {
      toast.success(input.id ? 'Đã cập nhật NVL nhập kho' : 'Đã thêm NVL')
      dialog.close()
      // Dòng mới nằm cuối danh sách nên nhảy tới trang chứa nó.
      if (!input.id) table.setPage(Math.ceil((rows.length + 1) / params.pageSize))
      await invalidateAll()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const del = useDeleteRowDialog({
    mutationFn: (row: InboundRow) => deleteWarehouseInboundApi(warehouseCode, row.id),
    successMessage: 'Đã xóa phiếu nhập',
    invalidateKeys: [
      ['warehouse-inbounds', warehouseCode],
      ['warehouse-stock', warehouseCode],
      ['warehouse-outbounds', warehouseCode],
    ],
  })

  const columns = useMemo(
    () => inboundColumns({ onView: openView, onEdit: openEdit, onDelete: del.request }),
    [openView, openEdit, del.request],
  )

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {totals && items.length > 0 ? (
        <PanelSummaryCard
          title="Tổng hợp nhập kho"
          stats={[
            { label: 'Số lượng ( SL )', value: formatQty(totals.qty), tone: 'in' },
            { label: 'Thành tiền ( TT )', value: formatMoney(totals.amount), tone: 'in' },
            {
              label: filtering ? 'Số dòng (đang lọc)' : 'Số dòng',
              value: String(filtering ? rows.length : items.length),
              tone: 'in',
            },
          ]}
        />
      ) : null}

      <DataTable
        columns={columns}
        rows={paginate(sortRows(rows, params.sort, params.dir), page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={inbounds.isFetching}
        errorText={inbounds.error instanceof Error ? inbounds.error.message : undefined}
        emptyText={filtering ? 'Không có dòng nhập khớp bộ lọc.' : 'Chưa có dòng nhập kho.'}
        variant="grid"
        fixedLayout
        showIndex
        indexOffset={indexOffset}
        sort={table.sortState}
        onSortChange={table.toggleSort}
        page={page}
        pageSize={params.pageSize}
        total={rows.length}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sx={{ flex: 1 }}
        toolbar={
          <PanelToolbar
            search={params.search}
            onSearchChange={table.setSearch}
            searchPlaceholder="Tìm tên hàng, ghi chú, NCC..."
            filters={
              <SelectInput
                label="NCC"
                options={supplierOptions}
                value={params.supplierId}
                onChange={(value) => table.setFilter({ supplierId: String(value) })}
                placeholder="Tất cả"
                sx={{ width: 180 }}
                fullWidth={false}
              />
            }
            createLabel="Thêm NVL"
            onCreate={dialog.openCreate}
          />
        }
      />

      <InboundDialog
        open={dialog.open}
        kind={dialog.kind}
        row={dialog.row}
        readOnly={dialog.readOnly}
        saving={save.isPending}
        units={units}
        suppliers={suppliers}
        materials={materials}
        warehouseCode={warehouseCode}
        operatorName={operatorName}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) =>
          save.mutate({ id: dialog.kind === 'edit' ? dialog.row?.id : undefined, payload })
        }
      />
      <ConfirmDeleteDialog
        open={Boolean(del.row)}
        title="Xóa phiếu nhập"
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

function inboundColumns({
  onView,
  onEdit,
  onDelete,
}: {
  onView: (row: InboundRow) => void
  onEdit: (row: InboundRow) => void
  onDelete: (row: InboundRow) => void
}): Column<InboundRow>[] {
  return [
    {
      key: 'receivedAt',
      header: 'Ngày nhập',
      width: 108,
      sortable: true,
      render: (row) => formatStockedDate(row.receivedAt),
    },
    { key: 'name', header: 'Tên hàng', ellipsis: true, sortable: true },
    { key: 'unit', header: 'Đơn vị tính', width: 88 },
    {
      key: 'qty',
      header: 'Số lượng',
      width: 104,
      numeric: true,
      sortable: true,
      render: (row) => formatQty(row.qty),
    },
    {
      key: 'unitPrice',
      header: 'Đơn giá',
      width: 108,
      numeric: true,
      sortable: true,
      render: (row) => formatMoney(Number(row.unitPrice) ? row.unitPrice : row.stockUnitPrice),
    },
    {
      key: 'amount',
      header: 'Thành tiền',
      width: 120,
      numeric: true,
      sortable: true,
      cellSx: { fontWeight: 700 },
      render: (row) => formatMoney(row.amount),
    },
    {
      key: 'note',
      header: 'Ghi chú',
      width: 120,
      ellipsis: true,
      render: (row) => row.note ?? '—',
    },
    {
      key: 'enteredBy',
      header: 'Người nhập',
      width: 110,
      ellipsis: true,
      sortable: true,
      render: (row) => row.enteredBy ?? '—',
    },
    {
      key: 'supplierSku',
      header: 'Mã hàng NCC',
      width: 100,
      ellipsis: true,
      render: (row) => row.supplierSku ?? '—',
    },
    {
      key: 'supplierName',
      header: 'NCC',
      width: 92,
      ellipsis: true,
      render: (row) => row.supplierName ?? '—',
    },
    {
      key: 'actions',
      header: 'Hành động',
      width: 120,
      align: 'center',
      cellSx: { overflow: 'visible' },
      render: (row) => (
        <RowActions
          onView={() => onView(row)}
          onEdit={() => onEdit(row)}
          onDelete={() => onDelete(row)}
        />
      ),
    },
  ]
}

type InboundFormValues = {
  receivedAt: string
  name: string
  sku: string
  materialId: string | null
  unitId: string
  locationCode: string
  qty: string
  unitPrice: string
  note: string
  supplierSku: string
  supplierId: string
}

const EMPTY_INBOUND: InboundFormValues = {
  receivedAt: '',
  name: '',
  sku: '',
  materialId: null,
  unitId: '',
  locationCode: '',
  qty: '',
  unitPrice: '',
  note: '',
  supplierSku: '',
  supplierId: '',
}

const INBOUND_TITLES = {
  create: 'Thêm NVL',
  edit: 'Chỉnh sửa NVL',
  view: 'Chi tiết NVL',
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
  warehouseCode: string
  operatorName: string
  onClose: () => void
  onExited: () => void
  onSave: (payload: CreateInboundPayload) => void
}) {
  const form = useForm<InboundFormValues>({ defaultValues: EMPTY_INBOUND })
  const locations = useQuery({
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
            receivedAt: row.receivedAt,
            name: row.name,
            sku: row.sku ?? '',
            materialId: row.materialId,
            unitId:
              row.unitId ?? units.find((item) => item.name === row.unit)?.id ?? units[0]?.id ?? '',
            locationCode:
              materials.find((item) => item.id === row.materialId)?.locationCode ?? '',
            qty: qtyFromApi(row.qty),
            unitPrice: moneyDigitsFromApi(
              Number(row.unitPrice) ? row.unitPrice : row.stockUnitPrice,
            ),
            note: row.note ?? '',
            supplierSku: row.supplierSku ?? '',
            supplierId: row.supplierId ?? '',
          }
        : {
            ...EMPTY_INBOUND,
            receivedAt: new Date().toISOString().slice(0, 10),
            unitId: units[0]?.id ?? '',
          },
    )
  }, [open, row, units, materials, form])

  const qty = form.watch('qty')
  const unitPrice = form.watch('unitPrice')
  const locationCode = form.watch('locationCode')
  const amount = useMemo(() => {
    const q = Number(qty)
    const p = Number(unitPrice)
    if (!Number.isFinite(q) || !Number.isFinite(p)) return ''
    return String(Math.round(q * p))
  }, [qty, unitPrice])

  const unitOptions: SearchSelectOption[] = units.map((unit) => ({
    id: unit.id,
    name: unit.name,
  }))
  const supplierOptions: SearchSelectOption[] = suppliers.map((item) => ({
    id: item.id,
    name: item.name,
  }))

  // Chỉ gợi ý ô kệ còn trống, trừ ô đang gán cho chính NVL này.
  const locationOptions: SearchSelectOption[] = useMemo(() => {
    const slots = locations.data?.items ?? []
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
  }, [locationCode, locations.data?.items])

  function submit(values: InboundFormValues) {
    if (readOnly) return
    onSave({
      receivedAt: values.receivedAt,
      name: values.name.trim(),
      sku: values.sku.trim() || undefined,
      materialId: values.materialId,
      unitId: values.unitId || undefined,
      unitName: units.find((unit) => unit.id === values.unitId)?.name,
      qty: values.qty,
      stockUnitPrice: '0',
      unitPrice: values.unitPrice || '0',
      amount:
        amount || String(Math.round((Number(values.qty) || 0) * (Number(values.unitPrice) || 0))),
      note: values.note.trim() || undefined,
      supplierSku: values.supplierSku.trim() || undefined,
      supplierId: values.supplierId || undefined,
      applyToStock: !row,
      locationCode: values.locationCode || null,
    })
  }

  return (
    <CrudDialogShell<InboundFormValues>
      open={open}
      kind={kind}
      titles={INBOUND_TITLES}
      form={form}
      onSubmit={submit}
      saving={saving}
      onClose={onClose}
      onExited={onExited}
    >
      <FormRow columns={3} sx={{ mt: 1 }}>
        <FormTextField<InboundFormValues>
          name="receivedAt"
          label="Ngày nhập"
          type="date"
          required
          readOnly={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormSearchSelect<InboundFormValues>
          name="unitId"
          label="Đơn vị tính"
          options={unitOptions}
          required
          readOnly={readOnly}
          displayValue={row?.unit}
          placeholder="Tìm đơn vị…"
        />
        <TextInput
          label="Người nhập"
          value={row?.enteredBy || operatorName || '—'}
          required
          readOnly
        />
      </FormRow>

      <MaterialField
        // Control<T> của RHF không gán được giữa các T khác nhau (hạn chế
        // variance của thư viện), nên MaterialField nhận Control<any> và ép kiểu ở đây.
        control={form.control as unknown as Control<any>}
        kind={kind}
        readOnly={readOnly}
        materials={materials}
        onSelect={(material) => {
          if (!material) {
            if (kind !== 'edit') form.setValue('materialId', null)
            return
          }
          form.setValue('materialId', material.id)
          form.setValue('sku', material.sku ?? '')
          if (material.unitId) form.setValue('unitId', material.unitId)
          form.setValue('locationCode', material.locationCode ?? '')
        }}
      />

      <FormSearchSelect<InboundFormValues>
        name="locationCode"
        label="Vị trí"
        options={locationOptions}
        allowClear
        readOnly={readOnly}
        displayValue={locationCode || '—'}
        placeholder="Tìm vị trí trống…"
        noOptionsText="Chưa có vị trí. Cấu hình ở mục Cấu hình → Vị trí."
      />

      <FormRow columns={3}>
        <FormQtyField<InboundFormValues>
          name="qty"
          label="Số lượng"
          required
          readOnly={readOnly}
          rules={{
            validate: (value) => (Number(value) || 0) > 0 || 'Số lượng phải lớn hơn 0',
          }}
        />
        <FormMoneyField<InboundFormValues> name="unitPrice" label="Đơn giá" readOnly={readOnly} />
        <TextInput label="Thành tiền" value={amount ? formatMoney(amount) : ''} readOnly />
      </FormRow>

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
