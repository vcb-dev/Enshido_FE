import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useController, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createWarehouseInboundApi,
  deleteWarehouseInboundApi,
  formatMoney,
  formatQty,
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
import { useAuth } from '../auth/AuthContext'
import {
  DataTable,
  Form,
  FormMoneyField,
  FormQtyField,
  FormRow,
  FormSearchSelect,
  FormTextField,
  RowActions,
  SearchInput,
  SelectInput,
  SummaryStat,
  TextInput,
  type Column,
  type SelectOption,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { paginate, useTableParams } from '../hooks/useTableParams'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { MaterialNameField, type StockMaterialOption } from './MaterialNameField'
import type { SearchSelectOption } from './SearchSelect'

export function StockInboundPanel({ warehouseCode }: { warehouseCode: string }) {
  const { user } = useAuth()
  const operatorName = user?.fullName?.trim() || user?.username || ''
  const queryClient = useQueryClient()
  const dialog = useCrudDialog<InboundRow>()
  // Tách sẵn các callback ổn định để useMemo cột không chạy lại mỗi render.
  const { openView, openEdit } = dialog
  const table = useTableParams({ pageSize: 8, filters: { supplierId: '' } })
  const { params } = table
  const [deletingRow, setDeletingRow] = useState<InboundRow | null>(null)

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
      await queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-locations', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: (row: InboundRow) => deleteWarehouseInboundApi(warehouseCode, row.id),
    onSuccess: async () => {
      toast.success('Đã xóa phiếu nhập')
      setDeletingRow(null)
      await queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns: Column<InboundRow>[] = useMemo(
    () => [
      {
        key: 'receivedAt',
        header: 'Ngày nhập',
        width: 108,
        sortable: true,
        render: (row) => formatInboundDate(row.receivedAt),
      },
      { key: 'name', header: 'Tên hàng', ellipsis: true, sortable: true },
      { key: 'unit', header: 'Đơn vị tính', width: 88 },
      {
        key: 'qty',
        header: 'Số lượng',
        width: 80,
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
            onView={() => openView(row)}
            onEdit={() => openEdit(row)}
            onDelete={() => setDeletingRow(row)}
          />
        ),
      },
    ],
    [openView, openEdit],
  )

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {totals && items.length > 0 ? (
        <Paper sx={{ p: 1.25, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Tổng hợp nhập kho
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <SummaryStat label="Số lượng ( SL )" value={formatQty(totals.qty)} tone="in" />
            <SummaryStat label="Thành tiền ( TT )" value={formatMoney(totals.amount)} tone="in" />
            <SummaryStat
              label={filtering ? 'Số dòng (đang lọc)' : 'Số dòng'}
              value={String(filtering ? rows.length : items.length)}
              tone="in"
            />
          </Stack>
        </Paper>
      ) : null}

      <DataTable
        columns={columns}
        rows={paginate(sortInbounds(rows, params.sort, params.dir), page, params.pageSize)}
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
          <>
            <SearchInput
              value={params.search}
              onChange={table.setSearch}
              placeholder="Tìm tên hàng, ghi chú, NCC..."
            />
            <SelectInput
              label="NCC"
              options={supplierOptions}
              value={params.supplierId}
              onChange={(value) => table.setFilter({ supplierId: String(value) })}
              placeholder="Tất cả"
              sx={{ width: 180 }}
              fullWidth={false}
            />
            <Button variant="contained" sx={{ ml: 'auto' }} onClick={dialog.openCreate}>
              Thêm NVL
            </Button>
          </>
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
        open={Boolean(deletingRow)}
        title="Xóa phiếu nhập"
        description={
          deletingRow
            ? `Xóa dòng ${deletingRow.name} (${formatQty(deletingRow.qty)} ${deletingRow.unit})? Tồn kho sẽ được tính lại.`
            : ''
        }
        deleting={remove.isPending}
        onClose={() => setDeletingRow(null)}
        onConfirm={() => deletingRow && remove.mutate(deletingRow)}
      />
    </Stack>
  )
}

function sortInbounds(rows: InboundRow[], sort: string, dir: 'asc' | 'desc') {
  if (!sort) return rows
  const direction = dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const left = a[sort as keyof InboundRow]
    const right = b[sort as keyof InboundRow]
    const leftNum = Number(left)
    const rightNum = Number(right)
    if (left !== '' && right !== '' && Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
      return (leftNum - rightNum) * direction
    }
    return String(left ?? '').localeCompare(String(right ?? ''), 'vi') * direction
  })
}

function formatInboundDate(value: string) {
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
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

  const title = kind === 'view' ? 'Chi tiết NVL' : kind === 'edit' ? 'Chỉnh sửa NVL' : 'Thêm NVL'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{ transition: { onExited } }}
    >
      <Form form={form} onSubmit={submit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            pt: 1,
            '& .MuiFormLabel-asterisk': { color: 'error.main' },
          }}
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
            kind={kind}
            readOnly={readOnly}
            materials={materials}
            form={form}
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
                validate: (value) =>
                  (Number(value) || 0) > 0 || 'Số lượng phải lớn hơn 0',
              }}
            />
            <FormMoneyField<InboundFormValues>
              name="unitPrice"
              label="Đơn giá"
              readOnly={readOnly}
            />
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
        </DialogContent>
        <DialogActions>
          {kind === 'view' ? (
            <Button onClick={onClose} variant="contained">
              Đóng
            </Button>
          ) : (
            <>
              <Button onClick={onClose} disabled={saving}>
                Hủy
              </Button>
              <Button type="submit" variant="contained" disabled={saving}>
                {kind === 'edit' ? 'Lưu' : 'Thêm'}
              </Button>
            </>
          )}
        </DialogActions>
      </Form>
    </Dialog>
  )
}

/**
 * Tên hàng phải chọn từ danh mục NVL — chọn xong thì điền luôn mã và đơn vị,
 * nên field này cần đọc/ghi nhiều ô cùng lúc thay vì chỉ một giá trị.
 */
function MaterialField({
  kind,
  readOnly,
  materials,
  form,
}: {
  kind: 'create' | 'edit' | 'view'
  readOnly: boolean
  materials: StockMaterialOption[]
  form: ReturnType<typeof useForm<InboundFormValues>>
}) {
  const { field, fieldState } = useController({
    name: 'name',
    control: form.control,
    rules: {
      required: 'Chọn tên hàng từ Kho tồn',
      validate: (value) =>
        kind !== 'create' ||
        Boolean(form.getValues('materialId')) ||
        String(value ?? '').trim().length === 0 ||
        'Chọn tên hàng từ danh sách, không nhập tự do',
    },
  })

  return (
    <MaterialNameField
      value={field.value}
      materials={materials}
      readOnly={readOnly}
      keepMaterialOnType={kind === 'edit'}
      errorText={fieldState.error?.message}
      onBlur={field.onBlur}
      onChange={field.onChange}
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
  )
}
