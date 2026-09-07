import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  deleteLocationApi,
  generateLocationsApi,
  getLocationsApi,
  updateLocationApi,
  type LocationSlot,
} from '../api/locations'
import { ConfirmDeleteDialog, TrashIcon } from '../warehouses/ConfirmDeleteDialog'
import { formatQty } from '../api/inventory'

const WAREHOUSE_CODE = 'nvl-chinh'
const NAVY = '#1b4f72'
const NAVY_SOFT = '#eaf0f6'
const BORDER = '#d5dbe0'

function locationCodeOf(zone: string, aisle: number, level: string, position: number) {
  return `${zone}${aisle}${level}${position}`
}

export function LocationsPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LocationSlot | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'free' | 'used'>('all')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [deleting, setDeleting] = useState<LocationSlot | null>(null)
  const [viewing, setViewing] = useState<LocationSlot | null>(null)

  const locations = useQuery({
    queryKey: ['warehouse-locations', WAREHOUSE_CODE],
    queryFn: () => getLocationsApi(WAREHOUSE_CODE),
  })

  const items = locations.data?.items ?? []
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((row) => {
      if (status === 'free' && row.occupied) return false
      if (status === 'used' && !row.occupied) return false
      if (!q) return true
      return (
        row.code.toLowerCase().includes(q) ||
        row.zone.toLowerCase().includes(q) ||
        String(row.aisle).includes(q) ||
        row.level.toLowerCase().includes(q) ||
        String(row.position).includes(q)
      )
    })
  }, [items, search, status])
  const maxPage = Math.max(0, Math.ceil(visible.length / rowsPerPage) - 1)
  const currentPage = Math.min(page, maxPage)
  const paged = visible.slice(currentPage * rowsPerPage, currentPage * rowsPerPage + rowsPerPage)
  const freeCount = items.filter((row) => !row.occupied).length
  const usedCount = items.length - freeCount

  async function refreshLocations() {
    await queryClient.invalidateQueries({ queryKey: ['warehouse-locations', WAREHOUSE_CODE] })
    await queryClient.invalidateQueries({ queryKey: ['warehouse-stock', WAREHOUSE_CODE] })
  }

  const generate = useMutation({
    mutationFn: generateLocationsApi,
    onSuccess: async (result) => {
      toast.success(result.created ? `Đã tạo ${result.created} vị trí` : 'Các vị trí này đã có sẵn')
      setOpen(false)
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
      setEditing(null)
      await refreshLocations()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: (row: LocationSlot) => deleteLocationApi(row.id),
    onSuccess: async () => {
      toast.success('Đã xóa vị trí')
      setDeleting(null)
      await refreshLocations()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Stack spacing={1.75} sx={{ flex: 1, minHeight: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between', gap: 1.5 }}
      >
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h5">Vị trí kho</Typography>
            <Chip
              size="small"
              label="Kho NVL chính"
              sx={{ bgcolor: NAVY_SOFT, color: NAVY, fontWeight: 600, height: 24 }}
            />
          </Stack>
          <FormulaStrip />
          <Typography variant="caption" color="text.secondary">
            Mã vị trí tự sinh từ công thức, không nhập tay.
          </Typography>
        </Stack>
        <Button variant="contained" startIcon={<PlusIcon />} onClick={() => setOpen(true)} sx={{ alignSelf: { sm: 'center' } }}>
          Tạo vị trí
        </Button>
      </Stack>

      {locations.error instanceof Error ? (
        <Alert severity="error">{locations.error.message}</Alert>
      ) : null}

      <Paper sx={{ px: 1.5, py: 1.25 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.25}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, flex: 1 }}>
            <TextField
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              placeholder="Tìm mã, zone, dãy, tầng…"
              sx={{ width: { xs: '100%', sm: 280 }, '& .MuiOutlinedInput-root': { bgcolor: '#fff' } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ color: 'text.secondary' }}>
                      <SearchGlyph />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Stack direction="row" spacing={0.75}>
              {(
                [
                  ['all', 'Tất cả'],
                  ['free', 'Trống'],
                  ['used', 'Đang dùng'],
                ] as const
              ).map(([id, label]) => (
                <Chip
                  key={id}
                  size="small"
                  clickable
                  label={label}
                  onClick={() => {
                    setStatus(id)
                    setPage(0)
                  }}
                  sx={{
                    fontWeight: 600,
                    bgcolor: status === id ? NAVY : '#fff',
                    color: status === id ? '#fff' : 'text.secondary',
                    border: `1px solid ${status === id ? NAVY : BORDER}`,
                    '&:hover': { bgcolor: status === id ? NAVY : NAVY_SOFT },
                  }}
                />
              ))}
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1}>
            <StatCard label="Tổng" value={items.length} />
            <StatCard label="Trống" value={freeCount} color="#1e8449" />
            <StatCard label="Đang dùng" value={usedCount} color="#b9770e" />
          </Stack>
        </Stack>
      </Paper>

      <TableContainer
        component={Paper}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {locations.isFetching ? <LinearProgress /> : null}
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Table
            size="small"
            stickyHeader
            sx={{
              '& .MuiTableCell-root': { py: 1, px: 1.5, borderColor: '#e6ebef' },
              '& .MuiTableCell-head': {
                bgcolor: '#f4f6f7',
                borderBottom: `1px solid ${BORDER}`,
              },
              '& .MuiTableRow-hover:hover .MuiTableCell-root': { bgcolor: '#f7fafc' },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Mã vị trí</TableCell>
                <TableCell align="center">Zone</TableCell>
                <TableCell align="center">Dãy</TableCell>
                <TableCell align="center">Tầng</TableCell>
                <TableCell align="center">Số thứ tự</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right" width={140}>
                  Hành động
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell
                    sx={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontWeight: 700,
                      color: NAVY,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {row.code}
                  </TableCell>
                  <TableCell align="center">{row.zone}</TableCell>
                  <TableCell align="center">{row.aisle}</TableCell>
                  <TableCell align="center">{row.level}</TableCell>
                  <TableCell align="center">{row.position}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {row.occupied ? (
                      <Tooltip title="Xem NVL tại vị trí này">
                        <IconButton
                          size="small"
                          aria-label={`Xem NVL tại ${row.code}`}
                          onClick={() => setViewing(row)}
                        >
                          <EyeIcon />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    <Tooltip title="Sửa vị trí">
                      <IconButton size="small" aria-label={`Sửa ${row.code}`} onClick={() => setEditing(row)}>
                        <PencilIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={row.occupied ? 'Đang dùng, không xóa được' : 'Xóa vị trí'}>
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={`Xóa ${row.code}`}
                          disabled={row.occupied}
                          onClick={() => setDeleting(row)}
                        >
                          <TrashIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!locations.isLoading && visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 6, border: 0 }}>
                    <EmptyState
                      hasItems={items.length > 0}
                      onCreate={() => setOpen(true)}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Box>
        <TablePagination
          component="div"
          count={visible.length}
          page={currentPage}
          onPageChange={(_, next) => setPage(next)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value))
            setPage(0)
          }}
          rowsPerPageOptions={[25, 50, 100]}
          labelRowsPerPage="Mỗi trang"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          sx={{ borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}
        />
      </TableContainer>

      <GenerateDialog
        open={open}
        saving={generate.isPending}
        onClose={() => setOpen(false)}
        onSave={(payload) => generate.mutate(payload)}
      />
      <EditLocationDialog
        row={editing}
        saving={saveEdit.isPending}
        onClose={() => setEditing(null)}
        onSave={(payload) => editing && saveEdit.mutate({ id: editing.id, payload })}
      />
      <OccupantsDialog row={viewing} onClose={() => setViewing(null)} />
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        title="Xóa vị trí"
        description={deleting ? `Xóa vị trí ${deleting.code}?` : ''}
        deleting={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
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
    <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center' }}>
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

function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 1.75,
      }}
    >
      {children}
    </Box>
  )
}

function GenerateDialog({
  open,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  saving: boolean
  onClose: () => void
  onSave: (payload: {
    warehouseCode: string
    zone: string
    aisleCount: number
    levelCount: number
    positionCount: number
  }) => void
}) {
  const [zone, setZone] = useState('A')
  const [aisleCount, setAisleCount] = useState('3')
  const [levelCount, setLevelCount] = useState('8')
  const [positionCount, setPositionCount] = useState('10')

  const aisles = Number(aisleCount)
  const levels = Number(levelCount)
  const positions = Number(positionCount)
  const letter = zone.trim().toUpperCase()
  const canCreate =
    /^[A-Z]$/.test(letter) &&
    Number.isInteger(aisles) &&
    aisles >= 1 &&
    Number.isInteger(levels) &&
    levels >= 1 &&
    Number.isInteger(positions) &&
    positions >= 1

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!/^[A-Z]$/.test(letter)) {
      toast.error('Zone phải là một chữ cái (A, B, C…)')
      return
    }
    if (!aisles || !levels || !positions) {
      toast.error('Nhập số dãy, tầng và vị trí')
      return
    }
    onSave({
      warehouseCode: WAREHOUSE_CODE,
      zone: letter,
      aisleCount: aisles,
      levelCount: levels,
      positionCount: positions,
    })
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle sx={{ pb: 0.5 }}>Tạo vị trí theo Zone</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Typography variant="body2" color="text.secondary">
            Chỉ nhập Zone, số dãy, số tầng và số ô. Mã vị trí tự sinh, không cần gõ tay.
          </Typography>
          <FieldGrid>
            <TextField
              label="Zone"
              value={zone}
              onChange={(e) => setZone(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1))}
              required
              helperText="Một chữ cái, ví dụ A"
              slotProps={{ htmlInput: { maxLength: 1, style: { textTransform: 'uppercase' } } }}
            />
            <TextField
              label="Số dãy"
              value={aisleCount}
              onChange={(e) => setAisleCount(e.target.value.replace(/\D/g, ''))}
              required
              helperText="Số dãy trong zone"
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
            <TextField
              label="Số tầng"
              value={levelCount}
              onChange={(e) => setLevelCount(e.target.value.replace(/\D/g, ''))}
              required
              helperText="Số tầng mỗi dãy"
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
            <TextField
              label="Số ô / tầng"
              value={positionCount}
              onChange={(e) => setPositionCount(e.target.value.replace(/\D/g, ''))}
              required
              helperText="Số thứ tự trên mỗi tầng"
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
          </FieldGrid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={saving || !canCreate}>
            Tạo vị trí
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function EditLocationDialog({
  row,
  saving,
  onClose,
  onSave,
}: {
  row: LocationSlot | null
  saving: boolean
  onClose: () => void
  onSave: (payload: { zone: string; aisle: number; level: string; position: number }) => void
}) {
  const [zone, setZone] = useState('')
  const [aisle, setAisle] = useState('')
  const [level, setLevel] = useState('')
  const [position, setPosition] = useState('')

  useEffect(() => {
    if (!row) return
    setZone(row.zone)
    setAisle(String(row.aisle))
    setLevel(row.level)
    setPosition(String(row.position))
  }, [row])

  const letter = zone.trim().toUpperCase()
  const levelLetter = level.trim().toUpperCase()
  const aisleNum = Number(aisle)
  const positionNum = Number(position)
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

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!/^[A-Z]$/.test(letter)) {
      toast.error('Zone phải là một chữ cái (A, B, C…)')
      return
    }
    if (!/^[A-Z]$/.test(levelLetter)) {
      toast.error('Tầng phải là một chữ cái (A, B, C…)')
      return
    }
    if (!Number.isInteger(aisleNum) || aisleNum < 1) {
      toast.error('Dãy phải là số nguyên dương')
      return
    }
    if (!Number.isInteger(positionNum) || positionNum < 1) {
      toast.error('Số thứ tự phải là số nguyên dương')
      return
    }
    onSave({ zone: letter, aisle: aisleNum, level: levelLetter, position: positionNum })
  }

  return (
    <Dialog open={Boolean(row)} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle sx={{ pb: 0.5 }}>Sửa vị trí {row?.code ?? ''}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {row?.occupied ? (
            <Alert severity="warning">
              Vị trí đang dùng trên Kho NVL chính. Đổi Zone / dãy / tầng / số sẽ tự đổi mã và cập nhật cột Vị trí của NVL đang gắn.
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Chỉ sửa Zone, dãy, tầng hoặc số. Mã vị trí tự sinh, không nhập tay.
            </Typography>
          )}
          <FieldGrid>
            <TextField
              label="Zone"
              value={zone}
              onChange={(e) => setZone(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1))}
              required
              helperText="Một chữ cái"
              slotProps={{ htmlInput: { maxLength: 1, style: { textTransform: 'uppercase' } } }}
            />
            <TextField
              label="Dãy"
              value={aisle}
              onChange={(e) => setAisle(e.target.value.replace(/\D/g, ''))}
              required
              helperText="Số nguyên dương"
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
            <TextField
              label="Tầng"
              value={level}
              onChange={(e) => setLevel(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1))}
              required
              helperText="Một chữ cái"
              slotProps={{ htmlInput: { maxLength: 1, style: { textTransform: 'uppercase' } } }}
            />
            <TextField
              label="Số thứ tự"
              value={position}
              onChange={(e) => setPosition(e.target.value.replace(/\D/g, ''))}
              required
              helperText="Ô trên tầng"
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
          </FieldGrid>
          <PreviewCard>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
              Mã vị trí (tự sinh)
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <FormulaPart label="Zone" sample={letter || '·'} />
              <PlusSign />
              <FormulaPart label="Dãy" sample={aisle || '·'} />
              <PlusSign />
              <FormulaPart label="Tầng" sample={levelLetter || '·'} />
              <PlusSign />
              <FormulaPart label="Số" sample={position || '·'} />
              <Typography variant="body2" sx={{ px: 0.25, fontWeight: 700, color: NAVY }}>
                =
              </Typography>
              <FormulaPart label="Mã" sample={preview || '—'} accent />
            </Stack>
          </PreviewCard>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={saving || !preview || unchanged}>
            Lưu
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function OccupantsDialog({ row, onClose }: { row: LocationSlot | null; onClose: () => void }) {
  const items = row?.materials?.length
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
    <Dialog open={Boolean(row)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 0.5 }}>NVL tại vị trí {row?.code ?? ''}</DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Sản phẩm đang gắn mã này trên Kho NVL chính.
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã NVL</TableCell>
              <TableCell>Tên NVL</TableCell>
              <TableCell>Hình dạng</TableCell>
              <TableCell align="right">Tồn kho</TableCell>
              <TableCell>Đơn vị</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.sku ?? '—'}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{item.name}</TableCell>
                <TableCell>{item.shape ?? '—'}</TableCell>
                <TableCell align="right">{item.qty ? formatQty(item.qty) : '—'}</TableCell>
                <TableCell>{item.unit || '—'}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Không có sản phẩm tại vị trí này.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
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

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SearchGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4.6L19.2 9.4a1.5 1.5 0 0 0 0-2.1l-2.5-2.5a1.5 1.5 0 0 0-2.1 0L4 15.4V20Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m13.2 6.2 4.6 4.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}
