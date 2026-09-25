import { useEffect, useMemo } from 'react'
import { Autocomplete, Box, Button, Paper, Stack, TextField } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createCastingOrderApi,
  listCastingNvlOptionsApi,
  listCastingOrdersApi,
  updateCastingOrderApi,
  type CastingNvlOption,
  type CastingOrder,
  type CastingOrderLine,
  type CastingOrderPayload,
} from '../api/castingOrders'
import { formatQty } from '../api/inventory'
import {
  ColumnHeaderSearch,
  CrudDialogShell,
  DataTable,
  FormQtyField,
  FormRow,
  FormTextField,
  PageHeader,
  RowActions,
  TextInput,
  type Column,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { useTableParams } from '../hooks/useTableParams'
import { LineActions } from '../warehouses/LineActions'

type LineValues = { materialId: string; gramQty: string }

type FormValues = {
  code: string
  moldCount: string
  lines: LineValues[]
}

const EMPTY_LINE: LineValues = { materialId: '', gramQty: '' }
const EMPTY: FormValues = { code: '', moldCount: '', lines: [EMPTY_LINE] }

const digitsOnly = (value: string) => value.replace(/\D/g, '')

function snapshotOption(line: CastingOrderLine): CastingNvlOption {
  return {
    id: line.materialId,
    sku: line.materialSku ?? '',
    name: line.materialName,
    locationCode: line.locationCode,
    category: line.category,
    materialType: line.materialType,
    shape: line.shape,
    color: line.color,
    unit: line.unit,
    sizeLabel: null,
  }
}

function lineText(values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join('\n')
  return text || '—'
}

const cellLeft = { textAlign: 'left', paddingLeft: '10px' } as const

export function CastingOrdersPage() {
  const queryClient = useQueryClient()
  const dialog = useCrudDialog<CastingOrder>()
  const table = useTableParams({ pageSize: 25, filters: { sku: '', name: '' } })
  const { params } = table
  const sku = params.sku.trim()
  const name = params.name.trim()

  const list = useQuery({
    queryKey: ['casting-orders', params.page, params.pageSize, sku, name],
    queryFn: () =>
      listCastingOrdersApi({
        sku,
        name,
        page: params.page,
        pageSize: params.pageSize,
      }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['casting-orders'] })
    if (dialog.row) {
      void queryClient.invalidateQueries({
        queryKey: ['edit-logs', 'casting_order', dialog.row.id],
      })
    }
  }

  const create = useMutation({
    mutationFn: createCastingOrderApi,
    onSuccess: () => {
      dialog.close()
      toast.success('Đã nhập lệnh đúc')
      refresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const update = useMutation({
    mutationFn: ({ id, ...payload }: CastingOrderPayload & { id: string }) =>
      updateCastingOrderApi(id, payload),
    onSuccess: () => {
      dialog.close()
      toast.success('Đã lưu lệnh đúc')
      refresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo<Column<CastingOrder>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã đúc',
        width: 140,
        align: 'left',
        headSx: cellLeft,
        cellSx: { ...cellLeft, fontWeight: 700 },
      },
      { key: 'moldCount', header: 'Số cối', width: 110, align: 'left', headSx: cellLeft, cellSx: cellLeft },
      {
        key: 'materialSku',
        header: 'Mã NVL',
        width: 160,
        align: 'left',
        headSx: cellLeft,
        cellSx: { ...cellLeft, whiteSpace: 'pre-line' },
        render: (row) => lineText(row.lines.map((line) => line.materialSku)),
        filter: (
          <ColumnHeaderSearch
            value={params.sku}
            onChange={(sku) => table.setFilter({ sku })}
            placeholder="Tìm mã NVL…"
          />
        ),
      },
      {
        key: 'materialName',
        header: 'Tên NVL',
        align: 'left',
        headSx: cellLeft,
        cellSx: { ...cellLeft, whiteSpace: 'pre-line' },
        render: (row) => lineText(row.lines.map((line) => line.materialName)),
        filter: (
          <ColumnHeaderSearch
            value={params.name}
            onChange={(name) => table.setFilter({ name })}
            placeholder="Tìm tên NVL…"
          />
        ),
      },
      {
        key: 'gramQty',
        header: 'Số gram',
        width: 110,
        align: 'left',
        headSx: cellLeft,
        cellSx: { ...cellLeft, whiteSpace: 'pre-line' },
        render: (row) => lineText(row.lines.map((line) => formatQty(line.gramQty))),
      },
      {
        key: 'actions',
        header: 'Hành động',
        width: 130,
        align: 'center',
        render: (row) => (
          <RowActions
            titles={{ view: 'Xem chi tiết', edit: 'Chỉnh sửa' }}
            onView={() => dialog.openView(row)}
            onEdit={() => dialog.openEdit(row)}
          />
        ),
      },
    ],
    [dialog.openEdit, dialog.openView, params.name, params.sku, table.setFilter],
  )

  const saving = create.isPending || update.isPending

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: { md: 1 }, minHeight: { md: 0 }, height: { md: '100%' }, overflow: { xs: 'visible', md: 'hidden' } }}
    >
      <PageHeader title="Lệnh đúc" subtitle="Nhập mã đúc, số cối và NVL lấy từ Tồn." compactSubtitle />
      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={list.isLoading && !list.data}
        errorText={list.error instanceof Error ? list.error.message : undefined}
        emptyText={sku || name ? 'Không có lệnh đúc khớp tìm kiếm.' : 'Chưa có lệnh đúc. Bấm Nhập lệnh đúc.'}
        variant="grid"
        fixedLayout
        minWidth={720}
        showIndex
        indexOffset={(params.page - 1) * params.pageSize}
        page={params.page}
        pageSize={params.pageSize}
        total={list.data?.total ?? 0}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        rowsLabel="lệnh"
        sx={{ flex: { md: 1 } }}
        toolbar={
          <Button variant="contained" sx={{ ml: 'auto' }} onClick={dialog.openCreate}>
            Nhập lệnh đúc
          </Button>
        }
      />
      <CastingOrderFormDialog
        open={dialog.open}
        kind={dialog.kind}
        row={dialog.row}
        readOnly={dialog.readOnly}
        saving={saving}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(values) => {
          const payload: CastingOrderPayload = {
            code: values.code.trim(),
            moldCount: Number(values.moldCount),
            lines: values.lines.map((line) => ({
              materialId: line.materialId,
              gramQty: line.gramQty,
            })),
            editReason: values.editReason,
          }
          if (dialog.kind === 'edit' && dialog.row) {
            update.mutate({ id: dialog.row.id, ...payload })
            return
          }
          create.mutate(payload)
        }}
      />
    </Stack>
  )
}

function CastingOrderFormDialog({
  open,
  kind,
  row,
  readOnly,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  kind: 'create' | 'edit' | 'view'
  row: CastingOrder | null
  readOnly: boolean
  saving: boolean
  onClose: () => void
  onExited: () => void
  onSave: (values: FormValues & { editReason?: string }) => void
}) {
  const form = useForm<FormValues>({ defaultValues: EMPTY })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const watched = form.watch('lines')
  const materials = useQuery({
    queryKey: ['casting-nvl-options'],
    queryFn: listCastingNvlOptionsApi,
    enabled: open && !readOnly,
    staleTime: 60_000,
  })

  const items = useMemo(() => {
    const base = materials.data ?? []
    const extras = (row?.lines ?? [])
      .filter((line) => !base.some((item) => item.id === line.materialId))
      .map(snapshotOption)
    return [...extras, ...base]
  }, [materials.data, row])

  useEffect(() => {
    if (!open) return
    if (row) {
      form.reset({
        code: row.code,
        moldCount: String(row.moldCount),
        lines: row.lines.length
          ? row.lines.map((line) => ({ materialId: line.materialId, gramQty: line.gramQty }))
          : [EMPTY_LINE],
      })
      return
    }
    form.reset(EMPTY)
  }, [open, row, form])

  return (
    <CrudDialogShell
      open={open}
      kind={kind}
      titles={{ create: 'Nhập lệnh đúc', edit: 'Sửa lệnh đúc', view: 'Chi tiết lệnh đúc' }}
      form={form}
      saving={saving}
      submitLabel={kind === 'edit' ? 'Lưu' : 'Nhập lệnh đúc'}
      pendingLabel={kind === 'edit' ? 'Đang lưu…' : 'Đang nhập…'}
      maxWidth="md"
      editLog={row ? { entityType: 'casting_order', entityId: row.id } : undefined}
      onClose={onClose}
      onExited={() => {
        form.reset(EMPTY)
        onExited()
      }}
      onSubmit={(values) => {
        const submitted = values as FormValues & { editReason?: string }
        if (submitted.lines.some((line) => !line.materialId || !(Number(line.gramQty) > 0))) return
        onSave(submitted)
      }}
    >
      <FormRow columns={2} sx={{ mt: 1 }}>
        <FormTextField<FormValues>
          name="code"
          label="Mã đúc"
          required
          autoFocus={!readOnly}
          readOnly={readOnly}
          placeholder="Nhập mã đúc…"
          rules={{ validate: (value) => Boolean(String(value ?? '').trim()) || 'Nhập mã đúc' }}
        />
        <FormTextField<FormValues>
          name="moldCount"
          label="Số cối"
          required
          readOnly={readOnly}
          placeholder="Nhập số cối…"
          transform={digitsOnly}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          rules={{
            validate: (value) => (Number(value) || 0) >= 1 || 'Số cối phải từ 1',
          }}
        />
      </FormRow>

      <Stack spacing={1.25}>
        {lines.fields.map((field, index) => {
          const materialId = watched[index]?.materialId ?? ''
          const stored =
            row?.lines.find((line) => line.materialId === materialId) ?? row?.lines[index]
          const selected = items.find((item) => item.id === materialId) ?? (stored ? snapshotOption(stored) : null)
          const taken = new Set(
            watched.filter((_, lineIndex) => lineIndex !== index).map((line) => line.materialId),
          )
          return (
            <Paper key={field.id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {readOnly ? (
                      <TextInput label="Mã NVL" value={selected?.sku ?? ''} readOnly />
                    ) : (
                      <NvlCodeField
                        materials={items.filter((item) => !taken.has(item.id))}
                        loading={materials.isFetching}
                        valueId={materialId}
                        errorText={form.formState.errors.lines?.[index]?.materialId?.message}
                        onBlur={() => void form.trigger(`lines.${index}.materialId`)}
                        onChange={(id) =>
                          form.setValue(`lines.${index}.materialId`, id, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      />
                    )}
                    <input
                      type="hidden"
                      {...form.register(`lines.${index}.materialId`, { required: 'Chọn mã NVL từ Tồn' })}
                    />
                  </Box>
                  {readOnly ? null : (
                    <Box sx={{ pt: '8px' }}>
                      <LineActions
                        addLabel="Thêm NVL"
                        removeLabel="Xóa NVL"
                        onAdd={() => lines.insert(index + 1, { ...EMPTY_LINE }, { shouldFocus: false })}
                        onRemove={() => {
                          if (lines.fields.length <= 1) {
                            form.setValue('lines', [{ ...EMPTY_LINE }], { shouldDirty: true })
                            return
                          }
                          lines.remove(index)
                        }}
                        removeDisabled={lines.fields.length <= 1 && !materialId}
                      />
                    </Box>
                  )}
                </Stack>
                <FormRow columns={3}>
                  <TextInput label="Tên NVL" value={selected?.name ?? ''} readOnly />
                  <TextInput label="Danh mục NVL" value={selected?.category ?? ''} readOnly />
                  <TextInput label="Chất loại" value={selected?.materialType ?? ''} readOnly />
                  <TextInput label="Hình dạng" value={selected?.shape ?? ''} readOnly />
                  <TextInput label="Màu sắc" value={selected?.color ?? ''} readOnly />
                  <TextInput label="Đơn vị" value={selected?.unit ?? ''} readOnly />
                  <TextInput label="Vị trí" value={selected?.locationCode ?? ''} readOnly />
                </FormRow>
                {readOnly ? (
                  <TextInput
                    label="Số gram"
                    value={watched[index]?.gramQty ? formatQty(watched[index].gramQty) : ''}
                    readOnly
                  />
                ) : (
                  <FormQtyField<FormValues>
                    name={`lines.${index}.gramQty`}
                    label="Số gram"
                    required
                    placeholder="Nhập số gram cho NVL này…"
                    rules={{
                      validate: (value) => (Number(value) || 0) > 0 || 'Số gram phải lớn hơn 0',
                    }}
                  />
                )}
              </Stack>
            </Paper>
          )
        })}
      </Stack>
    </CrudDialogShell>
  )
}

function NvlCodeField({
  materials,
  loading,
  valueId,
  errorText,
  onBlur,
  onChange,
}: {
  materials: CastingNvlOption[]
  loading: boolean
  valueId: string
  errorText?: string
  onBlur: () => void
  onChange: (id: string) => void
}) {
  const selected = materials.find((item) => item.id === valueId) ?? null
  return (
    <Autocomplete
      forcePopupIcon
      options={materials}
      value={selected}
      loading={loading}
      onBlur={onBlur}
      getOptionLabel={(option) => option.sku}
      isOptionEqualToValue={(option, next) => option.id === next.id}
      filterOptions={(options, state) => {
        const q = state.inputValue.trim().toLowerCase()
        const matched = !q
          ? options
          : options.filter(
              (item) =>
                item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q),
            )
        return matched.slice(0, 50)
      }}
      onChange={(_, next) => onChange(next?.id ?? '')}
      noOptionsText={loading ? 'Đang tải Tồn NVL…' : 'Tồn chưa có mã NVL'}
      renderOption={(props, option) => {
        const { key, ...rest } = props
        return (
          <li key={key} {...rest}>
            <Box component="span" sx={{ fontWeight: 700, mr: 1 }}>
              {option.sku}
            </Box>
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {option.name}
            </Box>
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Mã NVL"
          required
          placeholder="Chọn mã trên Tồn kho NVL chính…"
          error={Boolean(errorText)}
          helperText={errorText}
        />
      )}
    />
  )
}
