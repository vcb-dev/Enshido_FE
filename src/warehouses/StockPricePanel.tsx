import { useEffect, useMemo } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tooltip,
} from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createWarehouseStockApi,
  formatPriceOrDash,
  formatQty,
  formatStockAge,
  getInventoryLookupsApi,
  getWarehouseStockApi,
  moneyDigitsFromApi,
  qtyFromApi,
  updateWarehouseStockApi,
  type LookupItem,
  type StockRow,
  type UpdateStockPayload,
} from '../api/inventory'
import {
  DataTable,
  Form,
  FormMoneyField,
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

export function StockPricePanel({ warehouseCode }: { warehouseCode: string }) {
  const queryClient = useQueryClient()
  const dialog = useCrudDialog<StockRow>()
  // Tách sẵn các callback ổn định để useMemo cột không chạy lại mỗi render.
  const { openView, openEdit } = dialog
  const table = useTableParams({ pageSize: 8, filters: { unitId: '' } })
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
  })

  const units = useMemo(() => lookups.data?.units ?? [], [lookups.data?.units])
  const items = useMemo(() => stock.data?.items ?? [], [stock.data?.items])

  const unitOptions: SelectOption<string>[] = useMemo(
    () => units.map((unit) => ({ value: unit.id, label: unit.name })),
    [units],
  )

  const rows = useMemo(() => {
    const keyword = params.search.trim().toLowerCase()
    return items.filter((row) => {
      if (params.unitId && row.unitId !== params.unitId) return false
      if (!keyword) return true
      return [row.name, row.note ?? '', row.unit].some((field) =>
        field.toLowerCase().includes(keyword),
      )
    })
  }, [items, params.search, params.unitId])

  // Giữ trang hợp lệ khi bộ lọc thu hẹp kết quả.
  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize

  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpdateStockPayload }) =>
      id
        ? updateWarehouseStockApi(warehouseCode, id, payload)
        : createWarehouseStockApi(warehouseCode, payload),
    onSuccess: async (_row, input) => {
      toast.success(input.id ? 'Đã cập nhật đơn giá tồn' : 'Đã thêm NVL vào kho đơn giá')
      dialog.close()
      // Dòng mới nằm cuối danh sách nên nhảy tới trang chứa nó.
      if (!input.id) table.setPage(Math.ceil((rows.length + 1) / params.pageSize))
      await queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns: Column<StockRow>[] = useMemo(
    () => [
      { key: 'name', header: 'Tên hàng', width: '24%', ellipsis: true, sortable: true },
      { key: 'unit', header: 'Đơn vị tính', width: '9%' },
      {
        key: 'stockUnitPrice',
        header: 'Đơn giá tồn',
        width: '11%',
        numeric: true,
        sortable: true,
        render: (row) => formatPriceOrDash(row.stockUnitPrice),
      },
      {
        key: 'openingQty',
        header: 'SL đầu kỳ',
        width: '10%',
        numeric: true,
        sortable: true,
        render: (row) => formatQty(row.openingQty),
      },
      {
        key: 'stockedAt',
        header: 'Thời gian tồn',
        width: '12%',
        sortable: true,
        render: (row) => {
          const age = formatStockAge(row.stockedAt)
          return (
            <Tooltip title={age.since ? `Từ ${age.since}` : ''} disableHoverListener={!age.since}>
              <span>{age.label}</span>
            </Tooltip>
          )
        },
      },
      {
        key: 'note',
        header: 'Ghi chú',
        width: '20%',
        ellipsis: true,
        render: (row) => row.note?.trim() || '—',
      },
      {
        key: 'actions',
        header: 'Hành động',
        width: '9%',
        align: 'center',
        cellSx: { overflow: 'visible' },
        render: (row) => (
          <RowActions onView={() => openView(row)} onEdit={() => openEdit(row)} />
        ),
      },
    ],
    [openView, openEdit],
  )

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <DataTable
        columns={columns}
        rows={paginate(sortRows(rows, params.sort, params.dir), page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={stock.isFetching}
        errorText={stock.error instanceof Error ? stock.error.message : undefined}
        emptyText={
          params.search || params.unitId
            ? 'Không có NVL khớp bộ lọc.'
            : 'Chưa có NVL. Bấm Thêm NVL để tạo tên hàng cho kho tồn.'
        }
        variant="grid"
        fixedLayout
        minWidth={920}
        showIndex
        indexOffset={indexOffset}
        rowsLabel="NVL"
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
              placeholder="Tìm tên hàng, ghi chú..."
            />
            <SelectInput
              label="Đơn vị tính"
              options={unitOptions}
              value={params.unitId}
              onChange={(value) => table.setFilter({ unitId: String(value) })}
              placeholder="Tất cả"
              sx={{ width: 180 }}
              fullWidth={false}
            />
            <Button
              variant="contained"
              sx={{ ml: 'auto' }}
              onClick={dialog.openCreate}
            >
              Thêm NVL
            </Button>
          </>
        }
      />

      <PriceDialog
        open={dialog.open}
        kind={dialog.kind}
        row={dialog.row}
        readOnly={dialog.readOnly}
        saving={save.isPending}
        units={units}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) =>
          save.mutate({ id: dialog.kind === 'edit' ? dialog.row?.id : undefined, payload })
        }
      />
    </Stack>
  )
}

function sortRows(rows: StockRow[], sort: string, dir: 'asc' | 'desc') {
  if (!sort) return rows
  const direction = dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const left = a[sort as keyof StockRow]
    const right = b[sort as keyof StockRow]
    const leftNum = Number(left)
    const rightNum = Number(right)
    if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
      return (leftNum - rightNum) * direction
    }
    return String(left ?? '').localeCompare(String(right ?? ''), 'vi') * direction
  })
}

type PriceFormValues = {
  name: string
  unitId: string
  stockUnitPrice: string
  openingQty: string
  note: string
}

const EMPTY_PRICE: PriceFormValues = {
  name: '',
  unitId: '',
  stockUnitPrice: '',
  openingQty: '',
  note: '',
}

function PriceDialog({
  open,
  kind,
  row,
  readOnly,
  saving,
  units,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  kind: 'create' | 'edit' | 'view'
  row: StockRow | null
  readOnly: boolean
  saving: boolean
  units: LookupItem[]
  onClose: () => void
  onExited: () => void
  onSave: (payload: UpdateStockPayload) => void
}) {
  const form = useForm<PriceFormValues>({ defaultValues: EMPTY_PRICE })

  useEffect(() => {
    if (!open) return
    form.reset(
      row
        ? {
            name: row.name,
            unitId: row.unitId,
            stockUnitPrice: moneyDigitsFromApi(row.stockUnitPrice),
            openingQty: qtyFromApi(row.openingQty),
            note: row.note ?? '',
          }
        : { ...EMPTY_PRICE, unitId: units[0]?.id ?? '' },
    )
  }, [open, row, units, form])

  const unitOptions: SelectOption<string>[] = units.map((unit) => ({
    value: unit.id,
    label: unit.name,
  }))

  function submit(values: PriceFormValues) {
    if (readOnly) return
    onSave({
      name: values.name.trim(),
      unitId: values.unitId,
      stockUnitPrice: values.stockUnitPrice || '0',
      note: values.note.trim() || null,
      ...(kind === 'create' ? { openingQty: values.openingQty || '0' } : {}),
    })
  }

  const title =
    kind === 'view' ? 'Chi tiết đơn giá' : kind === 'edit' ? 'Sửa đơn giá tồn' : 'Thêm NVL'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
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
          <FormTextField<PriceFormValues>
            name="name"
            label="Tên hàng"
            required
            readOnly={readOnly}
            sx={{ mt: 1 }}
          />
          <FormSelect<PriceFormValues>
            name="unitId"
            label="Đơn vị tính"
            options={unitOptions}
            required
            readOnly={readOnly}
          />
          <FormMoneyField<PriceFormValues>
            name="stockUnitPrice"
            label="Đơn giá tồn"
            required
            readOnly={readOnly}
          />
          <FormRow>
            <FormQtyField<PriceFormValues>
              name="openingQty"
              label="SL đầu kỳ"
              readOnly={readOnly || kind === 'edit'}
              helperText={kind === 'edit' ? 'Sửa số lượng ở Kho tồn' : undefined}
            />
            {kind !== 'create' ? (
              <TextInput label="Thời gian tồn" value={stockAgeLabel(row?.stockedAt)} readOnly />
            ) : null}
          </FormRow>
          <FormTextField<PriceFormValues>
            name="note"
            label="Ghi chú"
            readOnly={readOnly}
            multiline
            minRows={2}
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

function stockAgeLabel(stockedAt?: string | null) {
  const age = formatStockAge(stockedAt)
  if (age.label === '—') return '—'
  return age.since ? `${age.label} (từ ${age.since})` : age.label
}
