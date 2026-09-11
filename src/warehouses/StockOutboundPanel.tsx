import { useEffect, useMemo } from 'react'
import { Box, Stack, Typography } from '@mui/material'
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
  type OutboundRow,
} from '../api/inventory'
import {
  CrudDialogShell,
  DataTable,
  FormQtyField,
  FormRow,
  FormSearchSelect,
  FormTextField,
  PanelSummaryCard,
  FILTER_FIELD_SX,
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

export function StockOutboundPanel({ warehouseCode }: { warehouseCode: string }) {
  const operatorName = useOperatorName()
  const queryClient = useQueryClient()
  const dialog = useCrudDialog<OutboundRow>()
  // Tách sẵn các callback ổn định để useMemo cột không chạy lại mỗi render.
  const { openView, openEdit } = dialog
  const table = useTableParams({ pageSize: 8, filters: { issuedBy: '' } })
  const { params } = table

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
  const filtering = table.hasFilters

  const invalidateAll = () =>
    Promise.all(
      [
        ['warehouse-outbounds', warehouseCode],
        ['warehouse-stock', warehouseCode],
        ['warehouse-inbounds', warehouseCode],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )

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
      await invalidateAll()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const del = useDeleteRowDialog({
    mutationFn: (row: OutboundRow) => deleteWarehouseOutboundApi(warehouseCode, row.id),
    successMessage: 'Đã xóa phiếu xuất',
    invalidateKeys: [
      ['warehouse-outbounds', warehouseCode],
      ['warehouse-stock', warehouseCode],
      ['warehouse-inbounds', warehouseCode],
    ],
  })

  const columns = useMemo(
    () => outboundColumns({ onView: openView, onEdit: openEdit, onDelete: del.request }),
    [openView, openEdit, del.request],
  )

  return (
    <Stack spacing={1.25} sx={{ flex: { md: 1 }, minHeight: { md: 0 }, overflow: { xs: 'visible', md: 'hidden' } }}>
      {totals && items.length > 0 ? (
        <PanelSummaryCard
          title="Tổng hợp xuất kho"
          stats={[
            { label: 'Số lượng ( SL )', value: formatQty(totals.qty), tone: 'out' },
            { label: 'Thành tiền ( TT )', value: formatMoney(totals.amount), tone: 'out' },
            {
              label: filtering ? 'Số dòng (đang lọc)' : 'Số dòng',
              value: String(filtering ? rows.length : items.length),
              tone: 'out',
            },
          ]}
        />
      ) : null}

      <DataTable
        columns={columns}
        rows={paginate(sortRows(rows, params.sort, params.dir), page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={outbounds.isFetching}
        errorText={outbounds.error instanceof Error ? outbounds.error.message : undefined}
        emptyText={filtering ? 'Không có dòng xuất khớp bộ lọc.' : 'Chưa có dòng xuất kho.'}
        variant="grid"
        fixedLayout
        minWidth={1372}
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
          <PanelToolbar
            search={params.search}
            onSearchChange={table.setSearch}
            searchPlaceholder="Tìm tên hàng, ghi chú, người xuất/nhận..."
            filters={
              <SelectInput
                label="Người xuất"
                options={issuerOptions}
                value={params.issuedBy}
                onChange={(value) => table.setFilter({ issuedBy: String(value) })}
                placeholder="Tất cả"
                sx={FILTER_FIELD_SX}
                fullWidth={false}
              />
            }
            filterCount={table.filterCount}
            onClearFilters={table.reset}
            createLabel="Thêm phiếu xuất"
            onCreate={dialog.openCreate}
          />
        }
      />

      <OutboundDialog
        open={dialog.open}
        kind={dialog.kind}
        row={dialog.row}
        readOnly={dialog.readOnly}
        saving={save.isPending}
        units={units}
        users={users}
        materials={materials}
        operatorName={operatorName}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) =>
          save.mutate({ id: dialog.kind === 'edit' ? dialog.row?.id : undefined, payload })
        }
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

function outboundColumns({
  onView,
  onEdit,
  onDelete,
}: {
  onView: (row: OutboundRow) => void
  onEdit: (row: OutboundRow) => void
  onDelete: (row: OutboundRow) => void
}): Column<OutboundRow>[] {
  return [
    {
      key: 'issuedAt',
      card: 'meta',
      header: 'Ngày xuất',
      width: 96,
      sortable: true,
      render: (row) => formatStockedDate(row.issuedAt),
    },
    {
      key: 'name',
      card: 'title',
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
      width: 104,
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
      card: 'meta',
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
      card: 'actions',
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

const OUTBOUND_TITLES = {
  create: 'Thêm phiếu xuất',
  edit: 'Chỉnh sửa phiếu xuất',
  view: 'Chi tiết phiếu xuất',
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
      titles={OUTBOUND_TITLES}
      form={form}
      onSubmit={submit}
      saving={saving}
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
          if (Number(qtyFromApi(material.qty ?? '0')) <= 0) form.setValue('qty', '')
        }}
      />

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
