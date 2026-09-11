import { useEffect, useMemo } from 'react'
import { Stack } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createBtpWaitingApi,
  deleteBtpWaitingApi,
  getBtpWaitingApi,
  updateBtpWaitingApi,
  type BtpWaitingRow,
  type UpsertBtpWaitingPayload,
} from '../api/btp'
import { formatQty, formatStockedDate, getInventoryLookupsApi, qtyFromApi } from '../api/inventory'
import {
  CrudDialogShell,
  DataTable,
  FormQtyField,
  FormRow,
  FormSearchSelect,
  FormTextField,
  PanelSummaryCard,
  PanelToolbar,
  RowActions,
  TextInput,
  type Column,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { useDeleteRowDialog } from '../hooks/useDeleteRowDialog'
import { useOperatorName } from '../hooks/useOperatorName'
import { paginate, sortRows, useTableParams } from '../hooks/useTableParams'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import type { SearchSelectOption } from './SearchSelect'

export function BtpWaitingPanel({ warehouseCode }: { warehouseCode: string }) {
  const operatorName = useOperatorName()
  const queryClient = useQueryClient()
  const dialog = useCrudDialog<BtpWaitingRow>()
  // Tách sẵn các callback ổn định để useMemo cột không chạy lại mỗi render.
  const { openView, openEdit } = dialog
  const table = useTableParams({ pageSize: 8 })
  const { params } = table

  const list = useQuery({
    queryKey: ['btp-waiting', warehouseCode],
    queryFn: () => getBtpWaitingApi(warehouseCode),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  })
  const lookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    staleTime: 30 * 60_000,
  })

  const units = useMemo(() => lookups.data?.units ?? [], [lookups.data?.units])
  const users = useMemo(() => lookups.data?.users ?? [], [lookups.data?.users])

  const items = useMemo(() => list.data?.items ?? [], [list.data?.items])
  const totals = list.data?.totals

  const rows = useMemo(() => {
    const keyword = params.search.trim().toLowerCase()
    if (!keyword) return items
    return items.filter((row) =>
      [row.name, row.craftsmanName, row.note ?? ''].some((field) =>
        field.toLowerCase().includes(keyword),
      ),
    )
  }, [items, params.search])

  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize
  const filtering = table.hasFilters

  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertBtpWaitingPayload }) =>
      id
        ? updateBtpWaitingApi(warehouseCode, id, payload)
        : createBtpWaitingApi(warehouseCode, payload),
    onSuccess: async (_row, input) => {
      toast.success(input.id ? 'Đã cập nhật dòng BTP' : 'Đã thêm dòng BTP')
      dialog.close()
      // Dòng mới nằm cuối danh sách nên nhảy tới trang chứa nó.
      if (!input.id) table.setPage(Math.ceil((rows.length + 1) / params.pageSize))
      await queryClient.invalidateQueries({ queryKey: ['btp-waiting', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const del = useDeleteRowDialog({
    mutationFn: (row: BtpWaitingRow) => deleteBtpWaitingApi(warehouseCode, row.id),
    successMessage: 'Đã xóa dòng BTP',
    invalidateKeys: [['btp-waiting', warehouseCode]],
  })

  const columns = useMemo(
    () => btpColumns({ onView: openView, onEdit: openEdit, onDelete: del.request }),
    [openView, openEdit, del.request],
  )

  return (
    <Stack spacing={1.25} sx={{ flex: { md: 1 }, minHeight: { md: 0 }, overflow: { xs: 'visible', md: 'hidden' } }}>
      {totals && items.length > 0 ? (
        <PanelSummaryCard
          title="Tổng hợp BTP chờ vào đá"
          stats={[
            { label: 'Số lượng ( SL )', value: formatQty(totals.qty) },
            { label: 'Trọng lượng', value: formatQty(totals.weight) },
            {
              label: filtering ? 'Số dòng (đang lọc)' : 'Số dòng',
              value: String(filtering ? rows.length : items.length),
            },
          ]}
        />
      ) : null}

      <DataTable
        columns={columns}
        rows={paginate(sortRows(rows, params.sort, params.dir), page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={list.isFetching}
        errorText={list.error instanceof Error ? list.error.message : undefined}
        emptyText={filtering ? 'Không có dòng khớp bộ lọc.' : 'Chưa có dòng BTP chờ vào đá.'}
        variant="grid"
        fixedLayout
        minWidth={1240}
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
          <PanelToolbar
            search={params.search}
            onSearchChange={table.setSearch}
            searchPlaceholder="Tìm tên, thợ nguội, ghi chú..."
            filterCount={table.filterCount}
            onClearFilters={table.reset}
            createLabel="Thêm dòng"
            onCreate={dialog.openCreate}
          />
        }
      />

      <BtpDialog
        open={dialog.open}
        kind={dialog.kind}
        row={dialog.row}
        readOnly={dialog.readOnly}
        saving={save.isPending}
        units={units}
        users={users}
        operatorName={operatorName}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) =>
          save.mutate({ id: dialog.kind === 'edit' ? dialog.row?.id : undefined, payload })
        }
      />
      <ConfirmDeleteDialog
        open={Boolean(del.row)}
        title="Xóa dòng BTP"
        description={del.row ? `Xóa ${del.row.name} (${formatQty(del.row.qty)} ${del.row.unit})?` : ''}
        deleting={del.deleting}
        onClose={del.cancel}
        onConfirm={del.confirm}
      />
    </Stack>
  )
}

function btpColumns({
  onView,
  onEdit,
  onDelete,
}: {
  onView: (row: BtpWaitingRow) => void
  onEdit: (row: BtpWaitingRow) => void
  onDelete: (row: BtpWaitingRow) => void
}): Column<BtpWaitingRow>[] {
  return [
    {
      key: 'receivedAt',
      card: 'meta',
      header: 'Ngày nhập',
      width: 108,
      sortable: true,
      render: (row) => formatStockedDate(row.receivedAt),
    },
    {
      key: 'craftsmanName',
      card: 'meta',
      header: 'Thợ nguội',
      width: 140,
      ellipsis: true,
      sortable: true,
      render: (row) => row.craftsmanName || '—',
    },
    { key: 'name', card: 'title', header: 'Tên bán thành phẩm', ellipsis: true, sortable: true },
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
      key: 'weight',
      header: 'Trọng lượng',
      width: 108,
      numeric: true,
      sortable: true,
      render: (row) => formatQty(row.weight),
    },
    {
      key: 'note',
      header: 'Ghi chú',
      width: 180,
      ellipsis: true,
      render: (row) => row.note ?? '—',
    },
    {
      key: 'enteredBy',
      header: 'Người nhập',
      width: 120,
      ellipsis: true,
      sortable: true,
      render: (row) => row.enteredBy ?? '—',
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

type BtpFormValues = {
  receivedAt: string
  craftsmanUserId: string
  name: string
  unitId: string
  qty: string
  weight: string
  note: string
}

const EMPTY_BTP: BtpFormValues = {
  receivedAt: '',
  craftsmanUserId: '',
  name: '',
  unitId: '',
  qty: '',
  weight: '',
  note: '',
}

const BTP_TITLES = {
  create: 'Thêm BTP chờ vào đá',
  edit: 'Chỉnh sửa BTP',
  view: 'Chi tiết BTP',
}

function BtpDialog({
  open,
  kind,
  row,
  readOnly,
  saving,
  units,
  users,
  operatorName,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  kind: 'create' | 'edit' | 'view'
  row: BtpWaitingRow | null
  readOnly: boolean
  saving: boolean
  units: { id: string; name: string }[]
  users: { id: string; username: string; fullName: string }[]
  operatorName: string
  onClose: () => void
  onExited: () => void
  onSave: (payload: UpsertBtpWaitingPayload) => void
}) {
  const form = useForm<BtpFormValues>({ defaultValues: EMPTY_BTP })

  useEffect(() => {
    if (!open) return
    const chiec = units.find((item) => item.name === 'chiếc')
    form.reset(
      row
        ? {
            receivedAt: row.receivedAt,
            craftsmanUserId:
              row.craftsmanUserId ??
              users.find((item) => item.fullName === row.craftsmanName)?.id ??
              '',
            name: row.name,
            unitId: row.unitId ?? units.find((item) => item.name === row.unit)?.id ?? chiec?.id ?? '',
            qty: qtyFromApi(row.qty),
            weight: qtyFromApi(row.weight),
            note: row.note ?? '',
          }
        : {
            ...EMPTY_BTP,
            receivedAt: new Date().toISOString().slice(0, 10),
            unitId: chiec?.id ?? units[0]?.id ?? '',
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

  function submit(values: BtpFormValues) {
    if (readOnly) return
    onSave({
      receivedAt: values.receivedAt,
      craftsmanUserId: values.craftsmanUserId,
      name: values.name.trim(),
      unitId: values.unitId,
      unitName: units.find((item) => item.id === values.unitId)?.name,
      qty: values.qty,
      weight: values.weight,
      note: values.note.trim() || undefined,
    })
  }

  return (
    <CrudDialogShell<BtpFormValues>
      open={open}
      kind={kind}
      titles={BTP_TITLES}
      form={form}
      onSubmit={submit}
      saving={saving}
      onClose={onClose}
      onExited={onExited}
    >
      <FormRow columns={3} sx={{ mt: 1 }}>
        <FormTextField<BtpFormValues>
          name="receivedAt"
          label="Ngày nhập"
          type="date"
          required
          readOnly={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormSearchSelect<BtpFormValues>
          name="craftsmanUserId"
          label="Thợ nguội"
          options={userOptions}
          required
          readOnly={readOnly}
          displayValue={row?.craftsmanName}
          placeholder="Tìm tài khoản…"
        />
        <TextInput
          label="Người nhập"
          value={row?.enteredBy || operatorName || '—'}
          required
          readOnly
        />
      </FormRow>

      <FormTextField<BtpFormValues>
        name="name"
        label="Tên bán thành phẩm"
        required
        readOnly={readOnly}
      />

      <FormRow columns={3}>
        <FormSearchSelect<BtpFormValues>
          name="unitId"
          label="Đơn vị tính"
          options={unitOptions}
          required
          readOnly={readOnly}
          displayValue={row?.unit}
          placeholder="Tìm đơn vị…"
        />
        <FormQtyField<BtpFormValues>
          name="qty"
          label="Số lượng"
          required
          readOnly={readOnly}
          rules={{ validate: (value) => (Number(value) || 0) > 0 || 'Số lượng phải lớn hơn 0' }}
        />
        <FormQtyField<BtpFormValues>
          name="weight"
          label="Trọng lượng"
          required
          readOnly={readOnly}
          rules={{ validate: (value) => (Number(value) || 0) >= 0 || 'Trọng lượng không hợp lệ' }}
        />
      </FormRow>

      <FormTextField<BtpFormValues>
        name="note"
        label="Ghi chú"
        readOnly={readOnly}
        multiline
        minRows={2}
        maxRows={6}
      />
    </CrudDialogShell>
  )
}
