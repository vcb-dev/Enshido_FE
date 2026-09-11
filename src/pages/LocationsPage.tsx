import { useEffect, useMemo, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import {
  deleteLocationApi,
  generateLocationsApi,
  getLocationsApi,
  updateLocationApi,
  type LocationOccupant,
  type LocationSlot,
} from '../api/locations'
import {
  CrudDialogShell,
  DataTable,
  FormRow,
  FormTextField,
  PageHeader,
  PlusIcon,
  RowActions,
  SearchInput,
  type Column,
} from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { useDeleteRowDialog } from '../hooks/useDeleteRowDialog'
import { paginate, useTableParams } from '../hooks/useTableParams'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'
import { formatQty } from '../api/inventory'

const WAREHOUSE_CODE = 'nvl-chinh'
const NAVY = '#1b4f72'
const NAVY_SOFT = '#eaf0f6'
const BORDER = '#d5dbe0'

const STATUS_FILTERS = [
  ['all', 'Tất cả'],
  ['free', 'Trống'],
  ['used', 'Đang dùng'],
] as const

const LOCATION_QUERY_KEYS = [
  ['warehouse-locations', WAREHOUSE_CODE],
  ['warehouse-stock', WAREHOUSE_CODE],
]

function locationCodeOf(zone: string, aisle: number, level: string, position: number) {
  return `${zone}${aisle}${level}${position}`
}

export function LocationsPage() {
  const queryClient = useQueryClient()
  const dialog = useCrudDialog<LocationSlot>()
  const table = useTableParams({ pageSize: 25, filters: { status: 'all' } })
  const { params } = table

  const locations = useQuery({
    queryKey: ['warehouse-locations', WAREHOUSE_CODE],
    queryFn: () => getLocationsApi(WAREHOUSE_CODE),
  })

  const items = useMemo(() => locations.data?.items ?? [], [locations.data])
  const visible = useMemo(() => {
    const q = params.search.trim().toLowerCase()
    return items.filter((row) => {
      if (params.status === 'free' && row.occupied) return false
      if (params.status === 'used' && !row.occupied) return false
      if (!q) return true
      return (
        row.code.toLowerCase().includes(q) ||
        row.zone.toLowerCase().includes(q) ||
        String(row.aisle).includes(q) ||
        row.level.toLowerCase().includes(q) ||
        String(row.position).includes(q)
      )
    })
  }, [items, params.search, params.status])

  const pageCount = Math.max(1, Math.ceil(visible.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const freeCount = items.filter((row) => !row.occupied).length
  const usedCount = items.length - freeCount

  async function refreshLocations() {
    await Promise.all(
      LOCATION_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )
  }

  const generate = useMutation({
    mutationFn: generateLocationsApi,
    onSuccess: async (result) => {
      toast.success(result.created ? `Đã tạo ${result.created} vị trí` : 'Các vị trí này đã có sẵn')
      dialog.close()
      await refreshLocations()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const saveEdit = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: { zone: string; aisle: number; level: string; position: number }
    }) => updateLocationApi(id, payload),
    onSuccess: async (row) => {
      toast.success(`Đã cập nhật vị trí ${row.code}`)
      dialog.close()
      await refreshLocations()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const del = useDeleteRowDialog<LocationSlot>({
    mutationFn: (row) => deleteLocationApi(row.id),
    successMessage: 'Đã xóa vị trí',
    invalidateKeys: LOCATION_QUERY_KEYS,
  })

  const { openEdit, openView } = dialog
  const { request: requestDelete } = del
  const columns = useMemo<Column<LocationSlot>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã vị trí',
        cellSx: {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontWeight: 700,
          color: NAVY,
          letterSpacing: '0.03em',
        },
      },
      { key: 'zone', header: 'Zone', align: 'center' },
      { key: 'aisle', header: 'Dãy', align: 'center' },
      { key: 'level', header: 'Tầng', align: 'center' },
      { key: 'position', header: 'Số thứ tự', align: 'center' },
      {
        key: 'occupied',
        header: 'Trạng thái',
        render: (row) => (
          <Chip
            size="small"
            label={row.occupied ? 'Đang dùng' : 'Trống'}
            sx={{
              fontWeight: 600,
              bgcolor: row.occupied ? '#fef6e6' : '#e8f6ee',
              color: row.occupied ? '#b9770e' : '#1e8449',
              border: 'none',
            }}
          />
        ),
      },
      {
        key: 'actions',
        header: 'Hành động',
        align: 'center',
        width: 140,
        render: (row) => (
          <RowActions
            onView={row.occupied ? () => openView(row) : undefined}
            onEdit={() => openEdit(row)}
            onDelete={() => requestDelete(row)}
            deleteDisabled={row.occupied}
            titles={{
              view: 'Xem NVL tại vị trí này',
              edit: 'Sửa vị trí',
              delete: row.occupied ? 'Đang dùng, không xóa được' : 'Xóa vị trí',
            }}
          />
        ),
      },
    ],
    [openEdit, openView, requestDelete],
  )

  return (
    <Stack spacing={1.75} sx={{ flex: { md: 1 }, minHeight: { md: 0 } }}>
      <PageHeader
        title="Vị trí kho"
        titleAdornment={
          <Chip
            size="small"
            label="Kho NVL chính"
            sx={{ bgcolor: NAVY_SOFT, color: NAVY, fontWeight: 600, height: 24 }}
          />
        }
        actions={
          <Button variant="contained" startIcon={<PlusIcon />} onClick={dialog.openCreate}>
            Tạo vị trí
          </Button>
        }
      >
        <FormulaStrip />
        <Typography variant="caption" color="text.secondary">
          Mã vị trí tự sinh từ công thức, không nhập tay.
        </Typography>
      </PageHeader>

      <Paper sx={{ px: 1.5, py: 1.25, flexShrink: 0 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.25}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ alignItems: { sm: 'center' }, flex: 1 }}
          >
            <SearchInput
              value={params.search}
              onChange={table.setSearch}
              placeholder="Tìm mã, zone, dãy, tầng…"
              sx={{ width: { xs: '100%', sm: 280 }, '& .MuiOutlinedInput-root': { bgcolor: '#fff' } }}
            />
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {STATUS_FILTERS.map(([id, label]) => (
                <Chip
                  key={id}
                  size="small"
                  clickable
                  label={label}
                  onClick={() => table.setFilter({ status: id })}
                  sx={{
                    fontWeight: 600,
                    bgcolor: params.status === id ? NAVY : '#fff',
                    color: params.status === id ? '#fff' : 'text.secondary',
                    border: `1px solid ${params.status === id ? NAVY : BORDER}`,
                    '&:hover': { bgcolor: params.status === id ? NAVY : NAVY_SOFT },
                  }}
                />
              ))}
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <StatCard label="Tổng" value={items.length} />
            <StatCard label="Trống" value={freeCount} color="#1e8449" />
            <StatCard label="Đang dùng" value={usedCount} color="#b9770e" />
          </Stack>
        </Stack>
      </Paper>

      <DataTable
        columns={columns}
        rows={paginate(visible, page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={locations.isFetching}
        errorText={locations.error instanceof Error ? locations.error.message : undefined}
        emptyText={<EmptyState hasItems={items.length > 0} onCreate={dialog.openCreate} />}
        rowsLabel="vị trí"
        page={page}
        pageSize={params.pageSize}
        total={visible.length}
        pageSizeOptions={[25, 50, 100]}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sx={{ flex: { md: 1 } }}
        tableSx={{
          '& .MuiTableCell-root': { py: 1, px: 1.5, borderColor: '#e6ebef' },
          '& .MuiTableRow-hover:hover .MuiTableCell-root': { bgcolor: '#f7fafc' },
        }}
      />

      <GenerateDialog
        open={dialog.open && dialog.kind === 'create'}
        saving={generate.isPending}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) => generate.mutate(payload)}
      />
      <EditLocationDialog
        open={dialog.open && dialog.kind === 'edit'}
        row={dialog.row}
        saving={saveEdit.isPending}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) => dialog.row && saveEdit.mutate({ id: dialog.row.id, payload })}
      />
      <OccupantsDialog
        open={dialog.open && dialog.kind === 'view'}
        row={dialog.row}
        onClose={dialog.close}
        onExited={dialog.clear}
      />
      <ConfirmDeleteDialog
        open={Boolean(del.row)}
        title="Xóa vị trí"
        description={del.row ? `Xóa vị trí ${del.row.code}?` : ''}
        deleting={del.deleting}
        onClose={del.cancel}
        onConfirm={del.confirm}
      />
    </Stack>
  )
}

function FormulaStrip() {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: 'center', flexWrap: 'wrap', color: 'text.secondary' }}
    >
      <FormulaPart label="Zone" sample="A" />
      <PlusSign />
      <FormulaPart label="Dãy" sample="1" />
      <PlusSign />
      <FormulaPart label="Tầng" sample="C" />
      <PlusSign />
      <FormulaPart label="Số" sample="12" />
      <Typography variant="body2" sx={{ px: 0.25, fontWeight: 700, color: NAVY }}>
        =
      </Typography>
      <FormulaPart label="Mã" sample="A1C12" accent />
    </Stack>
  )
}

function FormulaPart({ label, sample, accent }: { label: string; sample: string; accent?: boolean }) {
  return (
    <Box
      sx={{
        px: 0.9,
        py: 0.35,
        minWidth: 44,
        textAlign: 'center',
        border: `1px solid ${accent ? '#c5d3de' : BORDER}`,
        bgcolor: accent ? NAVY_SOFT : '#fff',
        borderRadius: 1,
      }}
    >
      <Typography sx={{ fontSize: 9, lineHeight: 1.1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        {sample}
      </Typography>
    </Box>
  )
}

function PlusSign() {
  return (
    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
      +
    </Typography>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Box
      sx={{
        minWidth: 84,
        px: 1.25,
        py: 0.6,
        bgcolor: '#f8fafb',
        border: `1px solid ${BORDER}`,
        borderRadius: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, color: color ?? NAVY, fontSize: '1.05rem', lineHeight: 1.25 }}>
        {value}
      </Typography>
    </Box>
  )
}

function EmptyState({ hasItems, onCreate }: { hasItems: boolean; onCreate: () => void }) {
  return (
    <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', py: 5 }}>
      <Typography sx={{ fontWeight: 600 }}>
        {hasItems ? 'Không có vị trí khớp tìm kiếm.' : 'Chưa có vị trí nào'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {hasItems
          ? 'Thử mã khác, hoặc lọc Tất cả / Trống / Đang dùng.'
          : 'Tạo theo Zone, dãy, tầng để gắn vào cột Vị trí trên Kho NVL chính.'}
      </Typography>
      {!hasItems ? (
        <Button variant="contained" startIcon={<PlusIcon />} onClick={onCreate}>
          Tạo vị trí
        </Button>
      ) : null}
    </Stack>
  )
}

const ONLY_DIGITS = (value: string) => value.replace(/\D/g, '')
const ONE_LETTER = (value: string) => value.replace(/[^a-zA-Z]/g, '').slice(0, 1)

const LETTER_RULE = {
  pattern: { value: /^[A-Za-z]$/, message: 'Phải là một chữ cái (A, B, C…)' },
} as const

const COUNT_RULE = {
  validate: (value: string) => {
    const parsed = Number(value)
    return (Number.isInteger(parsed) && parsed >= 1) || 'Phải là số nguyên dương'
  },
} as const

type GenerateFormValues = {
  zone: string
  aisleCount: string
  levelCount: string
  positionCount: string
}

const EMPTY_GENERATE: GenerateFormValues = {
  zone: 'A',
  aisleCount: '3',
  levelCount: '8',
  positionCount: '10',
}

function GenerateDialog({
  open,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  saving: boolean
  onClose: () => void
  onExited: () => void
  onSave: (payload: {
    warehouseCode: string
    zone: string
    aisleCount: number
    levelCount: number
    positionCount: number
  }) => void
}) {
  const form = useForm<GenerateFormValues>({ defaultValues: EMPTY_GENERATE })

  useEffect(() => {
    if (!open) return
    form.reset(EMPTY_GENERATE)
  }, [open, form])

  return (
    <CrudDialogShell<GenerateFormValues>
      open={open}
      kind="create"
      titles={{ create: 'Tạo vị trí theo Zone', edit: '', view: '' }}
      form={form}
      saving={saving}
      submitLabel="Tạo vị trí"
      maxWidth="sm"
      onClose={onClose}
      onExited={onExited}
      onSubmit={(values) =>
        onSave({
          warehouseCode: WAREHOUSE_CODE,
          zone: values.zone.trim().toUpperCase(),
          aisleCount: Number(values.aisleCount),
          levelCount: Number(values.levelCount),
          positionCount: Number(values.positionCount),
        })
      }
    >
      <Typography variant="body2" color="text.secondary">
        Chỉ nhập Zone, số dãy, số tầng và số ô. Mã vị trí tự sinh, không cần gõ tay.
      </Typography>
      <FormRow>
        <FormTextField<GenerateFormValues>
          name="zone"
          label="Zone"
          required
          rules={LETTER_RULE}
          transform={ONE_LETTER}
          helperText="Một chữ cái, ví dụ A"
          slotProps={{ htmlInput: { maxLength: 1, style: { textTransform: 'uppercase' } } }}
        />
        <FormTextField<GenerateFormValues>
          name="aisleCount"
          label="Số dãy"
          required
          rules={COUNT_RULE}
          transform={ONLY_DIGITS}
          helperText="Số dãy trong zone"
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
        <FormTextField<GenerateFormValues>
          name="levelCount"
          label="Số tầng"
          required
          rules={COUNT_RULE}
          transform={ONLY_DIGITS}
          helperText="Số tầng mỗi dãy"
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
        <FormTextField<GenerateFormValues>
          name="positionCount"
          label="Số ô / tầng"
          required
          rules={COUNT_RULE}
          transform={ONLY_DIGITS}
          helperText="Số thứ tự trên mỗi tầng"
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
      </FormRow>
    </CrudDialogShell>
  )
}

type EditFormValues = { zone: string; aisle: string; level: string; position: string }

const EMPTY_EDIT: EditFormValues = { zone: '', aisle: '', level: '', position: '' }

function EditLocationDialog({
  open,
  row,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  row: LocationSlot | null
  saving: boolean
  onClose: () => void
  onExited: () => void
  onSave: (payload: { zone: string; aisle: number; level: string; position: number }) => void
}) {
  const form = useForm<EditFormValues>({ defaultValues: EMPTY_EDIT })

  useEffect(() => {
    if (!open) return
    form.reset(
      row
        ? {
            zone: row.zone,
            aisle: String(row.aisle),
            level: row.level,
            position: String(row.position),
          }
        : EMPTY_EDIT,
    )
  }, [open, row, form])

  const values = useWatch({ control: form.control })
  const letter = (values.zone ?? '').trim().toUpperCase()
  const levelLetter = (values.level ?? '').trim().toUpperCase()
  const aisleNum = Number(values.aisle)
  const positionNum = Number(values.position)
  const preview =
    /^[A-Z]$/.test(letter) &&
    /^[A-Z]$/.test(levelLetter) &&
    Number.isInteger(aisleNum) &&
    aisleNum >= 1 &&
    Number.isInteger(positionNum) &&
    positionNum >= 1
      ? locationCodeOf(letter, aisleNum, levelLetter, positionNum)
      : ''
  const unchanged =
    Boolean(row) &&
    preview === row?.code &&
    letter === row.zone &&
    levelLetter === row.level &&
    aisleNum === row.aisle &&
    positionNum === row.position

  return (
    <CrudDialogShell<EditFormValues>
      open={open}
      kind="edit"
      titles={{ create: '', edit: `Sửa vị trí ${row?.code ?? ''}`, view: '' }}
      form={form}
      saving={saving}
      submitDisabled={!preview || unchanged}
      maxWidth="sm"
      onClose={onClose}
      onExited={onExited}
      onSubmit={() =>
        onSave({ zone: letter, aisle: aisleNum, level: levelLetter, position: positionNum })
      }
    >
      {row?.occupied ? (
        <Alert severity="warning">
          Vị trí đang dùng trên Kho NVL chính. Đổi Zone / dãy / tầng / số sẽ tự đổi mã và cập nhật
          cột Vị trí của NVL đang gắn.
        </Alert>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Chỉ sửa Zone, dãy, tầng hoặc số. Mã vị trí tự sinh, không nhập tay.
        </Typography>
      )}
      <FormRow>
        <FormTextField<EditFormValues>
          name="zone"
          label="Zone"
          required
          rules={LETTER_RULE}
          transform={ONE_LETTER}
          helperText="Một chữ cái"
          slotProps={{ htmlInput: { maxLength: 1, style: { textTransform: 'uppercase' } } }}
        />
        <FormTextField<EditFormValues>
          name="aisle"
          label="Dãy"
          required
          rules={COUNT_RULE}
          transform={ONLY_DIGITS}
          helperText="Số nguyên dương"
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
        <FormTextField<EditFormValues>
          name="level"
          label="Tầng"
          required
          rules={LETTER_RULE}
          transform={ONE_LETTER}
          helperText="Một chữ cái"
          slotProps={{ htmlInput: { maxLength: 1, style: { textTransform: 'uppercase' } } }}
        />
        <FormTextField<EditFormValues>
          name="position"
          label="Số thứ tự"
          required
          rules={COUNT_RULE}
          transform={ONLY_DIGITS}
          helperText="Ô trên tầng"
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
      </FormRow>
      <PreviewCard>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
          Mã vị trí (tự sinh)
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <FormulaPart label="Zone" sample={letter || '·'} />
          <PlusSign />
          <FormulaPart label="Dãy" sample={values.aisle || '·'} />
          <PlusSign />
          <FormulaPart label="Tầng" sample={levelLetter || '·'} />
          <PlusSign />
          <FormulaPart label="Số" sample={values.position || '·'} />
          <Typography variant="body2" sx={{ px: 0.25, fontWeight: 700, color: NAVY }}>
            =
          </Typography>
          <FormulaPart label="Mã" sample={preview || '—'} accent />
        </Stack>
      </PreviewCard>
    </CrudDialogShell>
  )
}

const OCCUPANT_COLUMNS: Column<LocationOccupant>[] = [
  { key: 'sku', header: 'Mã NVL', render: (row) => row.sku ?? '—' },
  { key: 'name', header: 'Tên NVL', cellSx: { fontWeight: 600 } },
  { key: 'shape', header: 'Hình dạng', render: (row) => row.shape ?? '—' },
  {
    key: 'qty',
    header: 'Tồn kho',
    numeric: true,
    render: (row) => (row.qty ? formatQty(row.qty) : '—'),
  },
  { key: 'unit', header: 'Đơn vị', render: (row) => row.unit || '—' },
]

function OccupantsDialog({
  open,
  row,
  onClose,
  onExited,
}: {
  open: boolean
  row: LocationSlot | null
  onClose: () => void
  onExited: () => void
}) {
  const items: LocationOccupant[] = row?.materials?.length
    ? row.materials
    : row?.materialName
      ? [
          {
            id: row.materialId ?? row.code,
            sku: null,
            name: row.materialName,
            unit: '',
            qty: '',
            shape: null,
            color: null,
          },
        ]
      : []

  return (
    <ViewDialogShell
      open={open}
      title={`NVL tại vị trí ${row?.code ?? ''}`}
      onClose={onClose}
      onExited={onExited}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Sản phẩm đang gắn mã này trên Kho NVL chính.
      </Typography>
      <DataTable
        columns={OCCUPANT_COLUMNS}
        rows={items}
        rowKey={(item) => item.id}
        stickyHeader={false}
        emptyText="Không có sản phẩm tại vị trí này."
      />
    </ViewDialogShell>
  )
}

/** Hộp thoại chỉ để xem: tiêu đề + nội dung + nút Đóng. */
function ViewDialogShell({
  open,
  title,
  onClose,
  onExited,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  onExited: () => void
  children: ReactNode
}) {
  const fullScreen = useIsMobile()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="sm"
      slotProps={{ transition: { onExited } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function PreviewCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1.25,
        bgcolor: '#f8fafb',
        border: `1px solid ${BORDER}`,
        borderRadius: 1,
      }}
    >
      {children}
    </Box>
  )
}
