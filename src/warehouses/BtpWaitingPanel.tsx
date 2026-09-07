import { useEffect, useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createBtpWaitingApi,
  deleteBtpWaitingApi,
  getBtpWaitingApi,
  updateBtpWaitingApi,
  type BtpWaitingRow,
  type UpsertBtpWaitingPayload,
} from '../api/btp'
import {
  formatQty,
  formatQtyInput,
  getInventoryLookupsApi,
  parseQtyInput,
  qtyFromApi,
} from '../api/inventory'
import { useAuth } from '../auth/AuthContext'
import { TrashIcon } from '../components/ui'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { SearchSelect } from './SearchSelect'

type DialogState = { kind: 'create' } | { kind: 'edit' | 'view'; row: BtpWaitingRow }

export function BtpWaitingPanel({ warehouseCode }: { warehouseCode: string }) {
  const { user } = useAuth()
  const operatorName = user?.fullName?.trim() || user?.username || ''
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(8)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deletingRow, setDeletingRow] = useState<BtpWaitingRow | null>(null)

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

  const items = list.data?.items ?? []
  const totals = list.data?.totals
  const maxPage = Math.max(0, Math.ceil(items.length / rowsPerPage) - 1)
  const currentPage = Math.min(page, maxPage)
  const paged = items.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage,
  )
  const editing = dialog?.kind === 'edit' || dialog?.kind === 'view' ? dialog.row : null
  const readOnly = dialog?.kind === 'view'

  function openDialog(next: DialogState) {
    setDialog(next)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
  }

  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpsertBtpWaitingPayload }) =>
      id
        ? updateBtpWaitingApi(warehouseCode, id, payload)
        : createBtpWaitingApi(warehouseCode, payload),
    onSuccess: async (_row, input) => {
      toast.success(input.id ? 'Đã cập nhật dòng BTP' : 'Đã thêm dòng BTP')
      closeDialog()
      if (!input.id) setPage(9999)
      await queryClient.invalidateQueries({ queryKey: ['btp-waiting', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: (row: BtpWaitingRow) => deleteBtpWaitingApi(warehouseCode, row.id),
    onSuccess: async () => {
      toast.success('Đã xóa dòng BTP')
      setDeletingRow(null)
      await queryClient.invalidateQueries({ queryKey: ['btp-waiting', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {list.error instanceof Error ? (
        <Alert severity="error" sx={{ flexShrink: 0 }}>
          {list.error.message}
        </Alert>
      ) : null}

      {totals && items.length > 0 ? (
        <Paper sx={{ p: 1.25, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Tổng hợp BTP chờ vào đá
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <SummaryStat label="Số lượng ( SL )" value={formatQty(totals.qty)} />
            <SummaryStat label="Trọng lượng" value={formatQty(totals.weight)} />
            <SummaryStat label="Số dòng" value={String(items.length)} />
          </Stack>
        </Paper>
      ) : null}

      <Paper
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Stack
          direction="row"
          sx={{
            flexShrink: 0,
            justifyContent: 'flex-end',
            px: 1.5,
            py: 1,
            borderBottom: '1px solid #d5dbe0',
          }}
        >
          <Button variant="contained" onClick={() => openDialog({ kind: 'create' })}>
            Thêm dòng
          </Button>
        </Stack>
        <TableContainer sx={{ flex: 1, minHeight: 0, overflowX: 'hidden', overflowY: 'auto' }}>
          {list.isFetching ? <LinearProgress /> : null}
          <Table
            size="small"
            sx={{
              width: '100%',
              tableLayout: 'fixed',
              borderCollapse: 'separate',
              borderSpacing: 0,
              '& .MuiTableCell-root': {
                border: '1px solid #b7c2cc',
                py: 0.75,
                px: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
              '& .MuiTableHead-root': {
                position: 'sticky',
                top: 0,
                zIndex: 3,
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ width: 48 }}>STT</TableCell>
                <TableCell sx={{ width: 108 }}>Ngày nhập</TableCell>
                <TableCell sx={{ width: 140 }}>Thợ nguội</TableCell>
                <TableCell>Tên bán thành phẩm</TableCell>
                <TableCell sx={{ width: 88 }}>Đơn vị tính</TableCell>
                <TableCell align="right" sx={{ width: 80 }}>Số lượng</TableCell>
                <TableCell align="right" sx={{ width: 108 }}>Trọng lượng</TableCell>
                <TableCell sx={{ width: 180 }}>Ghi chú</TableCell>
                <TableCell sx={{ width: 120 }}>Người nhập</TableCell>
                <TableCell align="center" sx={{ width: 120, overflow: 'visible' }}>Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((row, index) => (
                <TableRow key={row.id} hover>
                  <TableCell align="center">{currentPage * rowsPerPage + index + 1}</TableCell>
                  <TableCell>{formatDate(row.receivedAt)}</TableCell>
                  <EllipsisCell text={row.craftsmanName || '—'} />
                  <EllipsisCell text={row.name} />
                  <TableCell>{row.unit}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatQty(row.qty)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatQty(row.weight)}
                  </TableCell>
                  <EllipsisCell text={row.note ?? '—'} />
                  <EllipsisCell text={row.enteredBy ?? '—'} />
                  <TableCell align="center" sx={{ overflow: 'visible', whiteSpace: 'nowrap' }}>
                    <Stack direction="row" spacing={0} sx={{ justifyContent: 'center' }}>
                      <IconButton size="small" aria-label="Xem" onClick={() => openDialog({ kind: 'view', row })}>
                        <EyeIcon />
                      </IconButton>
                      <IconButton size="small" aria-label="Chỉnh sửa" onClick={() => openDialog({ kind: 'edit', row })}>
                        <PencilIcon />
                      </IconButton>
                      <IconButton size="small" aria-label="Xóa" color="error" onClick={() => setDeletingRow(row)}>
                        <TrashIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!list.isLoading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10}>Chưa có dòng BTP chờ vào đá.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={items.length}
          page={currentPage}
          onPageChange={(_, next) => setPage(next)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value))
            setPage(0)
          }}
          rowsPerPageOptions={[8, 25, 50, 100]}
          labelRowsPerPage="Mỗi trang"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count} dòng`}
          sx={{ flexShrink: 0, borderTop: '1px solid #d5dbe0' }}
        />
      </Paper>

      <BtpDialog
        open={dialogOpen}
        kind={dialog?.kind ?? 'create'}
        row={editing}
        readOnly={readOnly}
        saving={save.isPending}
        units={lookups.data?.units ?? []}
        users={lookups.data?.users ?? []}
        operatorName={operatorName}
        onClose={closeDialog}
        onExited={() => setDialog(null)}
        onSave={(payload) =>
          save.mutate({ id: dialog?.kind === 'edit' ? editing?.id : undefined, payload })
        }
      />
      <ConfirmDeleteDialog
        open={Boolean(deletingRow)}
        title="Xóa dòng BTP"
        description={
          deletingRow
            ? `Xóa ${deletingRow.name} (${formatQty(deletingRow.qty)} ${deletingRow.unit})?`
            : ''
        }
        deleting={remove.isPending}
        onClose={() => setDeletingRow(null)}
        onConfirm={() => deletingRow && remove.mutate(deletingRow)}
      />
    </Stack>
  )
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
  const [receivedAt, setReceivedAt] = useState('')
  const [craftsmanUserId, setCraftsmanUserId] = useState('')
  const [name, setName] = useState('')
  const [unitId, setUnitId] = useState('')
  const [qty, setQty] = useState('')
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    const chiec = units.find((item) => item.name === 'chiếc')
    if (row) {
      setReceivedAt(row.receivedAt)
      setCraftsmanUserId(
        row.craftsmanUserId ??
          users.find((item) => item.fullName === row.craftsmanName)?.id ??
          '',
      )
      setName(row.name)
      setUnitId(row.unitId ?? units.find((item) => item.name === row.unit)?.id ?? chiec?.id ?? '')
      setQty(qtyFromApi(row.qty))
      setWeight(qtyFromApi(row.weight))
      setNote(row.note ?? '')
      return
    }
    setReceivedAt(new Date().toISOString().slice(0, 10))
    setCraftsmanUserId('')
    setName('')
    setUnitId(chiec?.id ?? units[0]?.id ?? '')
    setQty('')
    setWeight('')
    setNote('')
  }, [open, row, units, users])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return
    if (!name.trim()) {
      toast.error('Nhập tên bán thành phẩm')
      return
    }
    if (!craftsmanUserId) {
      toast.error('Chọn thợ nguội')
      return
    }
    if (!unitId) {
      toast.error('Chọn đơn vị tính')
      return
    }
    if (!qty || Number(qty) <= 0) {
      toast.error('Số lượng không hợp lệ')
      return
    }
    if (!weight || Number(weight) < 0) {
      toast.error('Trọng lượng không hợp lệ')
      return
    }
    onSave({
      receivedAt,
      craftsmanUserId,
      name: name.trim(),
      unitId,
      unitName: units.find((item) => item.id === unitId)?.name,
      qty,
      weight,
      note: note.trim() || undefined,
    })
  }

  const title =
    kind === 'view' ? 'Chi tiết BTP' : kind === 'edit' ? 'Chỉnh sửa BTP' : 'Thêm BTP chờ vào đá'
  const fieldSx = readOnly
    ? { '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#1b2a38', color: '#1b2a38' } }
    : undefined

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{ transition: { onExited } }}
    >
      <form onSubmit={onSubmit} noValidate>
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              label="Ngày nhập"
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              required
              disabled={readOnly}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <SearchSelect
              label="Thợ nguội"
              valueId={craftsmanUserId}
              options={users.map((item) => ({
                id: item.id,
                name: item.fullName,
                secondary: item.username,
              }))}
              required
              readOnly={readOnly}
              displayValue={row?.craftsmanName}
              placeholder="Tìm tài khoản…"
              sx={fieldSx}
              onChange={setCraftsmanUserId}
            />
            <TextField
              label="Người nhập"
              value={row?.enteredBy || operatorName || '—'}
              required
              disabled
              sx={fieldSx}
            />
          </Stack>
          <TextField
            label="Tên bán thành phẩm"
            value={readOnly ? name || '—' : name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={readOnly}
            sx={fieldSx}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <SearchSelect
              label="Đơn vị tính"
              valueId={unitId}
              options={units}
              required
              readOnly={readOnly}
              displayValue={row?.unit}
              placeholder="Tìm đơn vị…"
              sx={fieldSx}
              onChange={setUnitId}
            />
            <TextField
              label="Số lượng"
              value={formatQtyInput(qty)}
              onChange={(e) => setQty(parseQtyInput(e.target.value))}
              required
              disabled={readOnly}
              sx={fieldSx}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
            <TextField
              label="Trọng lượng"
              value={formatQtyInput(weight)}
              onChange={(e) => setWeight(parseQtyInput(e.target.value))}
              required
              disabled={readOnly}
              sx={fieldSx}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
          </Stack>
          <TextField
            label="Ghi chú"
            value={readOnly ? note || '—' : note}
            onChange={(e) => setNote(e.target.value)}
            disabled={readOnly}
            multiline
            minRows={2}
            maxRows={6}
            sx={fieldSx}
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
      </form>
    </Dialog>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: '#f7f4f0',
        border: '1px solid #b7c2cc',
        borderLeft: '4px solid #8d6e63',
        borderRadius: 1,
        px: 1.25,
        py: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  )
}

function EllipsisCell({ text }: { text: string }) {
  return (
    <Tooltip title={text} disableHoverListener={!text || text === '—'}>
      <TableCell>{text}</TableCell>
    </Tooltip>
  )
}

function formatDate(value: string) {
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.4 12S6 5.8 12 5.8 21.6 12 21.6 12 18 18.2 12 18.2 2.4 12 2.4 12Z"
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
        d="M4 20h4.6L19.2 9.4a1.5 1.5 0 0 0 0-2.1l-2.5-2.5a1.5 1.5 0 0 0 2.1 0L4 15.4V20Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m13.2 6.2 4.6 4.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}
