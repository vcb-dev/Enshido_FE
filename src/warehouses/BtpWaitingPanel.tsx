import { useEffect, useMemo } from 'react'
import { Box, Button, Stack } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createBtpWaitingApi,
  deleteBtpWaitingApi,
  getBtpWaitingApi,
  updateBtpWaitingApi,
  type BtpWaitingResponse,
  type BtpWaitingRow,
  type UpsertBtpWaitingPayload,
} from '../api/btp'
import { formatQty, formatStockedDate, getInventoryLookupsApi, qtyFromApi } from '../api/inventory'
import {
  ColumnHeaderFilter,
  ColumnHeaderSearch,
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
import type { SearchSelectOption } from './SearchSelect'
import { headerTotal, uniqueFilterOptions } from './stockFilters'

export function BtpWaitingPanel({ warehouseCode }: { warehouseCode: string }) {
  const operatorName = useOperatorName()
  const queryClient = useQueryClient()
  const dialog = useCrudDialog<BtpWaitingRow>()
  // Tách sẵn các callback ổn định để useMemo cột không chạy lại mỗi render.
  const { openView, openEdit } = dialog
  const table = useTableParams({
    pageSize: 8,
    filters: { craftsmanName: '', enteredBy: '', unit: '' },
  })
  const { params } = table

  const list = useQuery({
    queryKey: ['btp-waiting', warehouseCode],
    queryFn: () => getBtpWaitingApi(warehouseCode),
    staleTime: 60_000,
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
  const apiTotals = list.data?.totals
  const craftsmanOptions = useMemo(
    () => uniqueFilterOptions(items.map((row) => row.craftsmanName)),
    [items],
  )
  const enteredByOptions = useMemo(
    () => uniqueFilterOptions(items.map((row) => row.enteredBy)),
    [items],
  )
  const unitOptions = useMemo(() => uniqueFilterOptions(items.map((row) => row.unit)), [items])

  const rows = useMemo(() => {
    const nameQuery = params.search.trim().toLocaleLowerCase('vi')
    return items.filter((row) => {
      if (nameQuery && !row.name.toLocaleLowerCase('vi').includes(nameQuery)) return false
      if (params.unit && row.unit !== params.unit) return false
      if (params.craftsmanName && row.craftsmanName !== params.craftsmanName) return false
      if (params.enteredBy && (row.enteredBy ?? '').trim() !== params.enteredBy) return false
      return true
    })
  }, [items, params.craftsmanName, params.enteredBy, params.search, params.unit])

  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const indexOffset = (page - 1) * params.pageSize
  const filtering = Boolean(
    params.search.trim() || params.craftsmanName || params.enteredBy || params.unit,
  )
  const totals = filtering
    ? {
        qty: String(rows.reduce((acc, row) => acc + (Number(row.qty) || 0), 0)),
        weight: String(rows.reduce((acc, row) => acc + (Number(row.weight) || 0), 0)),
      }
    : apiTotals

  const save = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: UpsertBtpWaitingPayload }) =>
      id
        ? updateBtpWaitingApi(warehouseCode, await resolveRowId(id), payload)
        : createBtpWaitingApi(warehouseCode, payload),
    onMutate: (input) => {
      dialog.close()
      toast.success(input.id ? 'Đã cập nhật dòng BTP' : 'Đã thêm dòng BTP')
      void queryClient.cancelQueries({ queryKey: ['btp-waiting', warehouseCode] })
      const previous = queryClient.getQueryData<BtpWaitingResponse>(['btp-waiting', warehouseCode])
      const tempId = input.id ?? newTempId()
      if (!input.id) registerTempId(tempId)
      const optimistic: BtpWaitingRow = {
        id: tempId,
        stt: input.id
          ? (previous?.items.find((item) => item.id === input.id)?.stt ?? 0)
          : (previous?.items.length ?? 0) + 1,
        receivedAt: input.payload.receivedAt,
        craftsmanUserId: input.payload.craftsmanUserId,
        craftsmanName:
          users.find((item) => item.id === input.payload.craftsmanUserId)?.fullName ?? '',
        name: input.payload.name,
        unit:
          input.payload.unitName ||
          units.find((unit) => unit.id === input.payload.unitId)?.name ||
          '',
        unitId: input.payload.unitId ?? null,
        qty: input.payload.qty,
        weight: input.payload.weight,
        note: input.payload.note ?? null,
        enteredBy: operatorName,
      }
      queryClient.setQueryData(
        ['btp-waiting', warehouseCode],
        (current: BtpWaitingResponse | undefined) => {
          if (!current) return current
          const items = input.id
            ? current.items.map((item) => (item.id === tempId ? optimistic : item))
            : [...current.items, optimistic]
          return {
            ...current,
            items,
            totals: {
              qty: String(items.reduce((acc, row) => acc + (Number(row.qty) || 0), 0)),
              weight: String(items.reduce((acc, row) => acc + (Number(row.weight) || 0), 0)),
            },
          }
        },
      )
      if (!input.id) table.setPage(Math.ceil((rows.length + 1) / params.pageSize))
      return { previous, tempId }
    },
    onSuccess: (row, _input, ctx) => {
      if (ctx?.tempId && isTempId(ctx.tempId)) resolveTempId(ctx.tempId, row.id)
      queryClient.setQueryData(
        ['btp-waiting', warehouseCode],
        (current: BtpWaitingResponse | undefined) => {
          if (!current) return current
          const fromId = ctx?.tempId ?? row.id
          if (!current.items.some((item) => item.id === fromId)) return current
          const items = current.items.map((item) => (item.id === fromId ? row : item))
          return {
            ...current,
            items,
            totals: {
              qty: String(items.reduce((acc, item) => acc + (Number(item.qty) || 0), 0)),
              weight: String(items.reduce((acc, item) => acc + (Number(item.weight) || 0), 0)),
            },
          }
        },
      )
    },
    onError: (error: Error, _input, ctx) => {
      if (ctx?.tempId && isTempId(ctx.tempId)) rejectTempId(ctx.tempId, error)
      if (ctx?.previous) queryClient.setQueryData(['btp-waiting', warehouseCode], ctx.previous)
      toast.error(error.message)
    },
  })

  const del = useDeleteRowDialog({
    mutationFn: (row: BtpWaitingRow) =>
      deleteWhenReady(row.id, (id) => deleteBtpWaitingApi(warehouseCode, id)),
    successMessage: 'Đã xóa dòng BTP',
    queryKeys: [['btp-waiting', warehouseCode]],
    onRemoved: (row) => {
      queryClient.setQueryData(
        ['btp-waiting', warehouseCode],
        (current: BtpWaitingResponse | undefined) => {
          if (!current) return current
          const items = current.items.filter((item) => item.id !== row.id)
          return {
            ...current,
            items,
            totals: {
              qty: String(items.reduce((acc, item) => acc + (Number(item.qty) || 0), 0)),
              weight: String(items.reduce((acc, item) => acc + (Number(item.weight) || 0), 0)),
            },
          }
        },
      )
    },
  })

  const columns = useMemo(
    () => [
      {
        key: 'receivedAt',
        card: 'meta' as const,
        header: 'Ngày nhập',
        width: 108,
        sortable: true,
        render: (row: BtpWaitingRow) => formatStockedDate(row.receivedAt),
      },
      {
        key: 'craftsmanName',
        card: 'meta' as const,
        header: 'Thợ nguội',
        width: 140,
        ellipsis: true,
        sortable: true,
        filter: (
          <ColumnHeaderFilter
            valueId={params.craftsmanName}
            options={craftsmanOptions}
            onChange={(id) => table.setFilter({ craftsmanName: id })}
          />
        ),
        render: (row: BtpWaitingRow) => row.craftsmanName || '—',
      },
      {
        key: 'name',
        card: 'title' as const,
        header: 'Tên bán thành phẩm',
        ellipsis: true,
        sortable: true,
        filter: <ColumnHeaderSearch value={params.search} onChange={table.setSearch} />,
      },
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
      {
        key: 'qty',
        header: headerTotal('Số lượng', totals?.qty, formatQty),
        width: 120,
        numeric: true,
        sortable: true,
        render: (row: BtpWaitingRow) => formatQty(row.qty),
      },
      {
        key: 'weight',
        header: headerTotal('Trọng lượng', totals?.weight, formatQty),
        width: 130,
        numeric: true,
        sortable: true,
        render: (row: BtpWaitingRow) => formatQty(row.weight),
      },
      {
        key: 'note',
        header: 'Ghi chú',
        width: 180,
        ellipsis: true,
        render: (row: BtpWaitingRow) => row.note ?? '—',
      },
      {
        key: 'enteredBy',
        header: 'Người nhập',
        width: 120,
        ellipsis: true,
        sortable: true,
        filter: (
          <ColumnHeaderFilter
            valueId={params.enteredBy}
            options={enteredByOptions}
            onChange={(id) => table.setFilter({ enteredBy: id })}
          />
        ),
        render: (row: BtpWaitingRow) => row.enteredBy ?? '—',
      },
      {
        key: 'actions',
        card: 'actions' as const,
        header: 'Hành động',
        width: 120,
        align: 'center' as const,
        cellSx: { overflow: 'visible' },
        render: (row: BtpWaitingRow) => (
          <RowActions
            onView={() => openView(row)}
            onEdit={() => openEdit(row)}
            onDelete={() => del.request(row)}
          />
        ),
      },
    ],
    [
      craftsmanOptions,
      del.request,
      enteredByOptions,
      openEdit,
      openView,
      params.craftsmanName,
      params.enteredBy,
      params.search,
      params.unit,
      table.setFilter,
      table.setSearch,
      totals?.qty,
      totals?.weight,
      unitOptions,
    ],
  )

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
        loading={list.isLoading}
        errorText={list.error instanceof Error ? list.error.message : undefined}
        emptyText={filtering ? 'Không có dòng khớp bộ lọc.' : 'Chưa có dòng BTP chờ vào đá.'}
        variant="grid"
        minWidth={1100}
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
              Thêm dòng
            </Button>
          </>
        }
      />

      <BtpDialog
        open={dialog.open}
        kind={dialog.kind}
        row={dialog.row}
        readOnly={dialog.readOnly}
        saving={false}
        units={units}
        users={users}
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
        title="Xóa dòng BTP"
        description={del.row ? `Xóa ${del.row.name} (${formatQty(del.row.qty)} ${del.row.unit})?` : ''}
        deleting={del.deleting}
        onClose={del.cancel}
        onConfirm={del.confirm}
      />
    </Stack>
  )
}

type BtpFormValues = {
  receivedAt: string
  craftsmanUserId: string
  name: string
  unitId: string
  qty: string
  weight: string
  note: string
  editReason?: string
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
      editReason: values.editReason?.trim() || undefined,
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
      editLog={row ? { entityType: 'btp_waiting', entityId: row.id } : undefined}
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
