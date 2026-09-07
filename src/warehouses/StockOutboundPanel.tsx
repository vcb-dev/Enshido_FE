import { useEffect, useMemo, useState } from 'react'
import {
  Box,
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
  createWarehouseOutboundApi,
  deleteWarehouseOutboundApi,
  formatMoney,
  formatPriceOrDash,
  formatQty,
  getInventoryLookupsApi,
  getWarehouseOutboundsApi,
  getWarehouseStockApi,
  moneyDigitsFromApi,
  qtyFromApi,
  updateWarehouseOutboundApi,
  type CreateOutboundPayload,
  type LookupItem,
  type OutboundRow,
} from '../api/inventory'
import {
  DataTable,
  Form,
  FormQtyField,
  FormRow,
  FormSelect,
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

export function StockOutboundPanel({ warehouseCode }: { warehouseCode: string }) {
  const queryClient = useQueryClient()
  const dialog = useCrudDialog<OutboundRow>()
  // Tách sẵn các callback ổn định để useMemo cột không chạy lại mỗi render.
  const { openView, openEdit } = dialog
  const table = useTableParams({ pageSize: 8, filters: { issuedBy: '' } })
  const { params } = table
  const [deletingRow, setDeletingRow] = useState<OutboundRow | null>(null)

  const outbounds = useQuery({
    queryKey: ['warehouse-outbounds', warehouseCode],
    queryFn: () => getWarehouseOutboundsApi(warehouseCode),
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

  const items = useMemo(() => outbounds.data?.items ?? [], [outbounds.data?.items])
  const totals = outbounds.data?.totals

  // Người xuất là text tự do nên danh sách lọc lấy từ chính dữ liệu đang có.
  const issuerOptions: SelectOption<string>[] = useMemo(() => {
    const names = new Set<string>()
    for (const row of items) if (row.issuedBy?.trim()) names.add(row.issuedBy.trim())
    return [...names].sort((a, b) => a.localeCompare(b, 'vi')).map((name) => ({
      value: name,
      label: name,
    }))
  }, [items])

  const rows = useMemo(() => {
    const keyword = params.search.trim().toLowerCase()
    return items.filter((row) => {
      if (params.issuedBy && (row.issuedBy ?? '').trim() !== params.issuedBy) return false
      if (!keyword) return true
      return [row.name, row.note ?? '', row.issuedBy ?? '', row.receivedBy ?? ''].some((field) =>
        field.toLowerCase().includes(keyword),
      )
    })
  }, [items, params.search, params.issuedBy])

  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize
  const filtering = Boolean(params.search || params.issuedBy)

  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: CreateOutboundPayload }) =>
      id
        ? updateWarehouseOutboundApi(warehouseCode, id, payload)
        : createWarehouseOutboundApi(warehouseCode, payload),
    onSuccess: async (_row, input) => {
      toast.success(input.id ? 'Đã cập nhật NVL xuất kho' : 'Đã ghi phiếu xuất')
      dialog.close()
      // Dòng mới nằm cuối danh sách nên nhảy tới trang chứa nó.
      if (!input.id) table.setPage(Math.ceil((rows.length + 1) / params.pageSize))
      await queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: (row: OutboundRow) => deleteWarehouseOutboundApi(warehouseCode, row.id),
    onSuccess: async () => {
      toast.success('Đã xóa phiếu xuất')
      setDeletingRow(null)
      await queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns: Column<OutboundRow>[] = useMemo(
    () => [
      {
        key: 'issuedAt',
        header: 'Ngày xuất',
        width: 96,
        sortable: true,
        render: (row) => formatOutboundDate(row.issuedAt),
      },
      {
        key: 'name',
        header: 'Tên hàng',
        width: 340,
        sortable: true,
        className: 'name-cell',
        cellSx: { overflow: 'visible', textOverflow: 'clip' },
      },
      { key: 'unit', header: 'Đơn vị tính', width: 88 },
      {
        key: 'qty',
        header: 'Số lượng',
        width: 72,
        numeric: true,
        sortable: true,
        render: (row) => formatQty(row.qty),
      },
      {
        key: 'inboundUnitPrice',
        header: 'Đơn giá xuất',
        width: 168,
        align: 'right',
        cellSx: {
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'normal',
          lineHeight: 1.35,
          overflow: 'visible',
          textOverflow: 'clip',
        },
        render: (row) => (
          <PriceBreakdownView breakdown={row.priceBreakdown} fallback={row.inboundUnitPrice} />
        ),
      },
      {
        key: 'amount',
        header: 'Thành tiền',
        width: 108,
        numeric: true,
        sortable: true,
        cellSx: { fontWeight: 700 },
        render: (row) => formatMoney(row.amount),
      },
      {
        key: 'note',
        header: 'Ghi chú',
        width: 108,
        ellipsis: true,
        className: 'note-cell',
        render: (row) => row.note ?? '—',
      },
      {
        key: 'issuedBy',
        header: 'Người Xuất',
        width: 96,
        ellipsis: true,
        sortable: true,
        render: (row) => row.issuedBy ?? '—',
      },
      {
        key: 'receivedBy',
        header: 'Người Nhận',
        width: 96,
        ellipsis: true,
        render: (row) => row.receivedBy ?? '—',
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
            Tổng hợp xuất kho
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <SummaryStat label="Số lượng ( SL )" value={formatQty(totals.qty)} tone="out" />
            <SummaryStat label="Thành tiền ( TT )" value={formatMoney(totals.amount)} tone="out" />
            <SummaryStat
              label={filtering ? 'Số dòng (đang lọc)' : 'Số dòng'}
              value={String(filtering ? rows.length : items.length)}
              tone="out"
            />
          </Stack>
        </Paper>
      ) : null}

      <DataTable
        columns={columns}
        rows={paginate(sortOutbounds(rows, params.sort, params.dir), page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={outbounds.isFetching}
        errorText={outbounds.error instanceof Error ? outbounds.error.message : undefined}
        emptyText={filtering ? 'Không có dòng xuất khớp bộ lọc.' : 'Chưa có dòng xuất kho.'}
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
        tableSx={{ '& .MuiTableCell-root.note-cell': { width: 108, maxWidth: 108 } }}
        toolbar={
          <>
            <SearchInput
              value={params.search}
              onChange={table.setSearch}
              placeholder="Tìm tên hàng, ghi chú, người xuất/nhận..."
            />
            <SelectInput
              label="Người xuất"
              options={issuerOptions}
              value={params.issuedBy}
              onChange={(value) => table.setFilter({ issuedBy: String(value) })}
              placeholder="Tất cả"
              sx={{ width: 180 }}
              fullWidth={false}
            />
            <Button variant="contained" sx={{ ml: 'auto' }} onClick={dialog.openCreate}>
              Thêm phiếu xuất
            </Button>
          </>
        }
      />

      <OutboundDialog
        open={dialog.open}
        kind={dialog.kind}
        row={dialog.row}
        readOnly={dialog.readOnly}
        saving={save.isPending}
        units={units}
        materials={materials}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) =>
          save.mutate({ id: dialog.kind === 'edit' ? dialog.row?.id : undefined, payload })
        }
      />
      <ConfirmDeleteDialog
        open={Boolean(deletingRow)}
        title="Xóa phiếu xuất"
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

function sortOutbounds(rows: OutboundRow[], sort: string, dir: 'asc' | 'desc') {
  if (!sort) return rows
  const direction = dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const left = a[sort as keyof OutboundRow]
    const right = b[sort as keyof OutboundRow]
    const leftNum = Number(left)
    const rightNum = Number(right)
    if (left !== '' && right !== '' && Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
      return (leftNum - rightNum) * direction
    }
    return String(left ?? '').localeCompare(String(right ?? ''), 'vi') * direction
  })
}

function formatOutboundDate(value: string) {
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
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
  issuedBy: string
  receivedBy: string
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
  issuedBy: '',
  receivedBy: '',
}

function OutboundDialog({
  open,
  kind,
  row,
  readOnly,
  saving,
  units,
  materials,
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
  materials: StockMaterialOption[]
  onClose: () => void
  onExited: () => void
  onSave: (payload: CreateOutboundPayload) => void
}) {
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
            issuedBy: row.issuedBy ?? '',
            receivedBy: row.receivedBy ?? '',
          }
        : {
            ...EMPTY_OUTBOUND,
            issuedAt: new Date().toISOString().slice(0, 10),
            unitId: units[0]?.id ?? '',
          },
    )
  }, [open, row, units, form])

  const materialId = form.watch('materialId')
  const qty = form.watch('qty')
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

  const unitOptions: SelectOption<string>[] = units.map((unit) => ({
    value: unit.id,
    label: unit.name,
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
      issuedBy: values.issuedBy.trim() || undefined,
      receivedBy: values.receivedBy.trim() || undefined,
      applyToStock: !row,
    })
  }

  const title =
    kind === 'view'
      ? 'Chi tiết phiếu xuất'
      : kind === 'edit'
        ? 'Chỉnh sửa phiếu xuất'
        : 'Thêm phiếu xuất'

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
          <FormRow sx={{ mt: 1 }}>
            <FormTextField<OutboundFormValues>
              name="issuedAt"
              label="Ngày xuất"
              type="date"
              required
              readOnly={readOnly}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormSelect<OutboundFormValues>
              name="unitId"
              label="Đơn vị tính"
              options={unitOptions}
              required
              readOnly={readOnly}
            />
          </FormRow>

          <MaterialField kind={kind} readOnly={readOnly} materials={materials} form={form} />

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
            <FormTextField<OutboundFormValues>
              name="issuedBy"
              label="Người Xuất"
              readOnly={readOnly}
            />
            <FormTextField<OutboundFormValues>
              name="receivedBy"
              label="Người Nhận"
              readOnly={readOnly}
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
              <Button
                type="submit"
                variant="contained"
                disabled={saving || (kind === 'create' && available <= 0)}
              >
                {kind === 'edit' ? 'Lưu' : 'Thêm'}
              </Button>
            </>
          )}
        </DialogActions>
      </Form>
    </Dialog>
  )
}

/** Xem chú thích ở [StockInboundPanel](./StockInboundPanel.tsx) — cùng cơ chế. */
function MaterialField({
  kind,
  readOnly,
  materials,
  form,
}: {
  kind: 'create' | 'edit' | 'view'
  readOnly: boolean
  materials: StockMaterialOption[]
  form: ReturnType<typeof useForm<OutboundFormValues>>
}) {
  const { field, fieldState } = useController({
    name: 'name',
    control: form.control,
    rules: {
      required: 'Chọn tên hàng từ Cấu hình giá sản phẩm',
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
        if (Number(qtyFromApi(material.qty ?? '0')) <= 0) form.setValue('qty', '')
      }}
    />
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
