import { useEffect, useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
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
} from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createWarehouseStockApi,
  formatMoney,
  formatPriceOrDash,
  formatQty,
  formatQtyInput,
  formatStockAge,
  getInventoryLookupsApi,
  getWarehouseStockApi,
  parseQtyInput,
  qtyFromApi,
  updateWarehouseStockApi,
  type StockRow,
  type UpdateStockPayload,
} from '../api/inventory'

type PriceDialogState =
  | { kind: 'create' }
  | { kind: 'edit' | 'view'; row: StockRow }

export function StockPricePanel({ warehouseCode }: { warehouseCode: string }) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<PriceDialogState | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(8)
  const [dialogOpen, setDialogOpen] = useState(false)
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

  const items = stock.data?.items ?? []
  const maxPage = Math.max(0, Math.ceil(items.length / rowsPerPage) - 1)
  const currentPage = Math.min(page, maxPage)
  const paged = items.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage,
  )
  const editing = dialog?.kind === 'edit' || dialog?.kind === 'view' ? dialog.row : null
  const readOnly = dialog?.kind === 'view'

  function openDialog(next: PriceDialogState) {
    setDialog(next)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
  }

  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: UpdateStockPayload }) =>
      id
        ? updateWarehouseStockApi(warehouseCode, id, payload)
        : createWarehouseStockApi(warehouseCode, payload),
    onSuccess: async (_row, input) => {
      toast.success(input.id ? 'Đã cập nhật đơn giá tồn' : 'Đã thêm NVL vào kho đơn giá')
      closeDialog()
      if (!input.id) setPage(9999)
      await queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {stock.error instanceof Error ? (
        <Alert severity="error" sx={{ flexShrink: 0 }}>
          {stock.error.message}
        </Alert>
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
            Thêm NVL
          </Button>
        </Stack>
        <TableContainer sx={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'auto' }}>
          {stock.isFetching ? <LinearProgress /> : null}
          <Table
            size="small"
            sx={{
              width: '100%',
              minWidth: 920,
              tableLayout: 'fixed',
              borderCollapse: 'separate',
              borderSpacing: 0,
              '& .MuiTableCell-root': {
                border: '1px solid #b7c2cc',
                py: 0.75,
                px: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
              '& .MuiTableHead-root': {
                position: 'sticky',
                top: 0,
                zIndex: 3,
                bgcolor: '#edf1f4',
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ width: '5%' }}>
                  STT
                </TableCell>
                <TableCell sx={{ width: '24%' }}>Tên hàng</TableCell>
                <TableCell sx={{ width: '9%' }}>Đơn vị tính</TableCell>
                <TableCell align="right" sx={{ width: '11%' }}>
                  Đơn giá tồn
                </TableCell>
                <TableCell align="right" sx={{ width: '10%' }}>
                  SL đầu kỳ
                </TableCell>
                <TableCell sx={{ width: '12%' }}>Thời gian tồn</TableCell>
                <TableCell sx={{ width: '20%' }}>Ghi chú</TableCell>
                <TableCell align="center" sx={{ width: '9%', overflow: 'visible' }}>
                  Hành động
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((row, index) => (
                <TableRow hover key={row.id}>
                  <TableCell align="center">{currentPage * rowsPerPage + index + 1}</TableCell>
                  <EllipsisCell text={row.name} />
                  <TableCell>{row.unit}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatPriceOrDash(row.stockUnitPrice)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatQty(row.openingQty)}
                  </TableCell>
                  <StockAgeCell stockedAt={row.stockedAt} />
                  <EllipsisCell text={row.note?.trim() || '—'} />
                  <TableCell align="center" sx={{ overflow: 'visible', whiteSpace: 'nowrap' }}>
                    <Stack direction="row" spacing={0} justifyContent="center">
                      <IconButton size="small" aria-label="Xem" onClick={() => openDialog({ kind: 'view', row })}>
                        <EyeIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Chỉnh sửa"
                        onClick={() => openDialog({ kind: 'edit', row })}
                      >
                        <PencilIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!stock.isLoading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>Chưa có NVL. Bấm Thêm NVL để tạo tên hàng cho kho tồn.</TableCell>
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
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count} NVL`}
          sx={{ flexShrink: 0, borderTop: '1px solid #d5dbe0' }}
        />
      </Paper>

      <PriceDialog
        open={dialogOpen}
        kind={dialog?.kind ?? 'create'}
        row={editing}
        readOnly={readOnly}
        saving={save.isPending}
        units={lookups.data?.units ?? []}
        onClose={closeDialog}
        onExited={() => setDialog(null)}
        onSave={(payload) =>
          save.mutate({ id: dialog?.kind === 'edit' ? editing?.id : undefined, payload })
        }
      />
    </Stack>
  )
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
  units: { id: string; name: string }[]
  onClose: () => void
  onExited: () => void
  onSave: (payload: UpdateStockPayload) => void
}) {
  const [name, setName] = useState('')
  const [unitId, setUnitId] = useState('')
  const [stockUnitPrice, setStockUnitPrice] = useState('')
  const [openingQty, setOpeningQty] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    if (row) {
      setName(row.name)
      setUnitId(row.unitId)
      setStockUnitPrice(moneyDigitsFromApi(row.stockUnitPrice))
      setOpeningQty(qtyFromApi(row.openingQty))
      setNote(row.note ?? '')
      return
    }
    setName('')
    setUnitId(units[0]?.id ?? '')
    setStockUnitPrice('')
    setOpeningQty('')
    setNote('')
  }, [open, row, units])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return
    if (!name.trim()) {
      toast.error('Tên hàng không được trống')
      return
    }
    if (!unitId) {
      toast.error('Chọn đơn vị tính')
      return
    }
    onSave({
      name: name.trim(),
      unitId,
      stockUnitPrice: stockUnitPrice || '0',
      note: note.trim() || null,
      ...(kind === 'create' ? { openingQty: openingQty || '0' } : {}),
    })
  }

  const title =
    kind === 'view' ? 'Chi tiết đơn giá' : kind === 'edit' ? 'Sửa đơn giá tồn' : 'Thêm NVL'
  const fieldSx = readOnly
    ? { '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#1b2a38', color: '#1b2a38' } }
    : undefined

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
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
          <TextField
            label="Tên hàng"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={readOnly}
            sx={{ ...fieldSx, mt: 1 }}
          />
          <TextField
            select={!readOnly}
            label="Đơn vị tính"
            value={readOnly ? units.find((item) => item.id === unitId)?.name || row?.unit || '—' : unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
            disabled={readOnly}
            sx={fieldSx}
          >
            {readOnly
              ? null
              : units.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
          </TextField>
          <TextField
            label="Đơn giá tồn"
            value={formatMoneyInput(stockUnitPrice)}
            onChange={(e) => setStockUnitPrice(moneyDigitsFromInput(e.target.value))}
            required
            disabled={readOnly}
            sx={fieldSx}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="SL đầu kỳ"
              value={formatQtyInput(openingQty)}
              onChange={(e) => setOpeningQty(parseQtyInput(e.target.value))}
              disabled={readOnly || kind === 'edit'}
              sx={fieldSx}
              helperText={kind === 'edit' ? 'Sửa số lượng ở Kho tồn' : undefined}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
            {kind !== 'create' ? (
              <TextField
                label="Thời gian tồn"
                value={stockAgeLabel(row?.stockedAt)}
                disabled
                sx={fieldSx}
              />
            ) : null}
          </Stack>
          <TextField
            label="Ghi chú"
            value={readOnly ? note || '—' : note}
            onChange={(e) => setNote(e.target.value)}
            disabled={readOnly}
            multiline
            minRows={2}
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

function EllipsisCell({ text }: { text: string }) {
  return (
    <Tooltip title={text} disableHoverListener={!text}>
      <TableCell>{text}</TableCell>
    </Tooltip>
  )
}

function StockAgeCell({ stockedAt }: { stockedAt?: string | null }) {
  const age = formatStockAge(stockedAt)
  return (
    <Tooltip title={age.since ? `Từ ${age.since}` : ''} disableHoverListener={!age.since}>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{age.label}</TableCell>
    </Tooltip>
  )
}

function stockAgeLabel(stockedAt?: string | null) {
  const age = formatStockAge(stockedAt)
  if (age.label === '—') return '—'
  return age.since ? `${age.label} (từ ${age.since})` : age.label
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
        d="M4 20h4.6L19.2 9.4a1.5 1.5 0 0 0 0-2.1l-2.5-2.5a1.5 1.5 0 0 0-2.1 0L4 15.4V20Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m13.2 6.2 4.6 4.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function moneyDigitsFromApi(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return String(Math.round(n))
}

function moneyDigitsFromInput(value: string) {
  return value.replace(/[^\d]/g, '')
}

function formatMoneyInput(value: string) {
  if (!value) return ''
  return formatMoney(value)
}
