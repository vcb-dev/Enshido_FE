import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
  createWarehouseOutboundApi,
  deleteWarehouseOutboundApi,
  formatMoney,
  formatPriceOrDash,
  formatQty,
  formatQtyInput,
  getInventoryLookupsApi,
  getWarehouseOutboundsApi,
  getWarehouseStockApi,
  parseQtyInput,
  qtyFromApi,
  updateWarehouseOutboundApi,
  type CreateOutboundPayload,
  type DirectoryUser,
  type OutboundRow,
} from '../api/inventory'
import { ConfirmDeleteDialog, TrashIcon } from './ConfirmDeleteDialog'
import { MaterialNameField, type StockMaterialOption } from './MaterialNameField'
import { SearchSelect } from './SearchSelect'
import { useAuth } from '../auth/AuthContext'

type OutboundDialogState =
  | { kind: 'create' }
  | { kind: 'edit' | 'view'; row: OutboundRow }

export function StockOutboundPanel({ warehouseCode }: { warehouseCode: string }) {
  const { user } = useAuth()
  const operatorName = user?.fullName?.trim() || user?.username || ''
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<OutboundDialogState | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(8)
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
  const materials: StockMaterialOption[] = (stock.data?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    unitId: item.unitId,
    unit: item.unit,
    qty: item.qty,
    priceLayers: item.priceLayers,
  }))

  const items = outbounds.data?.items ?? []
  const totals = outbounds.data?.totals
  const maxPage = Math.max(0, Math.ceil(items.length / rowsPerPage) - 1)
  const currentPage = Math.min(page, maxPage)
  const paged = items.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deletingRow, setDeletingRow] = useState<OutboundRow | null>(null)
  const editing = dialog?.kind === 'edit' || dialog?.kind === 'view' ? dialog.row : null
  const readOnly = dialog?.kind === 'view'

  function openDialog(next: OutboundDialogState) {
    setDialog(next)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
  }

  const save = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id?: string
      payload: CreateOutboundPayload
    }) =>
      id
        ? updateWarehouseOutboundApi(warehouseCode, id, payload)
        : createWarehouseOutboundApi(warehouseCode, payload),
    onSuccess: async (_row, input) => {
      toast.success(input.id ? 'Đã cập nhật NVL xuất kho' : 'Đã ghi phiếu xuất')
      closeDialog()
      if (!input.id) setPage(9999)
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

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {outbounds.error instanceof Error ? (
        <Alert severity="error" sx={{ flexShrink: 0 }}>
          {outbounds.error.message}
        </Alert>
      ) : null}

      {totals && items.length > 0 ? (
        <Paper sx={{ p: 1.25, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Tổng hợp xuất kho
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <SummaryStat label="Số lượng ( SL )" value={formatQty(totals.qty)} />
            <SummaryStat label="Thành tiền ( TT )" value={formatMoney(totals.amount)} />
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
            Thêm phiếu xuất
          </Button>
        </Stack>
        <TableContainer sx={{ flex: 1, minHeight: 0, overflowX: 'hidden', overflowY: 'auto' }}>
          {outbounds.isFetching ? <LinearProgress /> : null}
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
              '& .MuiTableCell-root.name-cell': {
                overflow: 'visible',
                textOverflow: 'clip',
              },
              '& .MuiTableCell-root.note-cell': {
                width: 108,
                maxWidth: 108,
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
                <TableCell align="center" sx={{ width: 44 }}>STT</TableCell>
                <TableCell sx={{ width: 96 }}>Ngày xuất</TableCell>
                <TableCell className="name-cell" sx={{ width: 340 }}>Tên hàng</TableCell>
                <TableCell sx={{ width: 88 }}>Đơn vị tính</TableCell>
                <TableCell align="right" sx={{ width: 72 }}>Số lượng</TableCell>
                <TableCell align="right" sx={{ width: 168 }}>Đơn giá xuất</TableCell>
                <TableCell align="right" sx={{ width: 108 }}>Thành tiền</TableCell>
                <TableCell className="note-cell" sx={{ width: 108, maxWidth: 108 }}>Ghi chú</TableCell>
                <TableCell sx={{ width: 96 }}>Người Xuất</TableCell>
                <TableCell sx={{ width: 96 }}>Người Nhận</TableCell>
                <TableCell align="center" sx={{ width: 120, overflow: 'visible' }}>Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((row, index) => (
                <OutboundRowView
                  key={row.id}
                  row={row}
                  stt={currentPage * rowsPerPage + index + 1}
                  onView={(row) => openDialog({ kind: 'view', row })}
                  onEdit={(row) => openDialog({ kind: 'edit', row })}
                  onDelete={(row) => setDeletingRow(row)}
                />
              ))}
              {!outbounds.isLoading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11}>Chưa có dòng xuất kho.</TableCell>
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

      <OutboundDialog
        open={dialogOpen}
        kind={dialog?.kind ?? 'create'}
        row={editing}
        readOnly={readOnly}
        saving={save.isPending}
        units={lookups.data?.units ?? []}
        users={lookups.data?.users ?? []}
        materials={materials}
        operatorName={operatorName}
        onClose={closeDialog}
        onExited={() => setDialog(null)}
        onSave={(payload) =>
          save.mutate({ id: dialog?.kind === 'edit' ? editing?.id : undefined, payload })
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

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: '#faf6f4',
        border: '1px solid #b7c2cc',
        borderLeft: '4px solid #c0392b',
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

function OutboundRowView({
  row,
  stt,
  onView,
  onEdit,
  onDelete,
}: {
  row: OutboundRow
  stt: number
  onView: (row: OutboundRow) => void
  onEdit: (row: OutboundRow) => void
  onDelete: (row: OutboundRow) => void
}) {
  return (
    <TableRow hover>
      <TableCell align="center">{stt}</TableCell>
      <TableCell>{formatOutboundDate(row.issuedAt)}</TableCell>
      <TableCell className="name-cell">{row.name}</TableCell>
      <TableCell>{row.unit}</TableCell>
      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatQty(row.qty)}
      </TableCell>
      <TableCell
        align="right"
        sx={{
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'normal',
          lineHeight: 1.35,
          overflow: 'visible',
          textOverflow: 'clip',
        }}
      >
        <PriceBreakdownView
          breakdown={row.priceBreakdown}
          fallback={row.inboundUnitPrice}
        />
      </TableCell>
      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
        {formatMoney(row.amount)}
      </TableCell>
      <EllipsisCell className="note-cell" text={row.note ?? '—'} />
      <EllipsisCell text={row.issuedBy ?? '—'} />
      <EllipsisCell text={row.receivedBy ?? '—'} />
      <TableCell align="center" sx={{ overflow: 'visible', whiteSpace: 'nowrap' }}>
        <Stack direction="row" spacing={0} justifyContent="center">
          <IconButton size="small" aria-label="Xem" onClick={() => onView(row)}>
            <EyeIcon />
          </IconButton>
          <IconButton size="small" aria-label="Chỉnh sửa" onClick={() => onEdit(row)}>
            <PencilIcon />
          </IconButton>
          <IconButton size="small" aria-label="Xóa" color="error" onClick={() => onDelete(row)}>
            <TrashIcon />
          </IconButton>
        </Stack>
      </TableCell>
    </TableRow>
  )
}

function EllipsisCell({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip title={text} disableHoverListener={!text || text === '—'}>
      <TableCell className={className}>{text}</TableCell>
    </Tooltip>
  )
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

function formatOutboundDate(value: string) {
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
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
  units: { id: string; name: string }[]
  users: DirectoryUser[]
  materials: StockMaterialOption[]
  operatorName: string
  onClose: () => void
  onExited: () => void
  onSave: (payload: CreateOutboundPayload) => void
}) {
  const [issuedAt, setIssuedAt] = useState('')
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [unitId, setUnitId] = useState('')
  const [qty, setQty] = useState('')
  const [inboundUnitPrice, setInboundUnitPrice] = useState('')
  const [note, setNote] = useState('')
  const [receivedByUserId, setReceivedByUserId] = useState('')

  useEffect(() => {
    if (!open) return
    if (row) {
      setIssuedAt(row.issuedAt)
      setName(row.name)
      setSku(row.sku ?? '')
      setMaterialId(row.materialId)
      setUnitId(
        row.unitId ??
          units.find((item) => item.name === row.unit)?.id ??
          units[0]?.id ??
          '',
      )
      setQty(qtyFromApi(row.qty))
      setInboundUnitPrice(moneyDigitsFromApi(row.inboundUnitPrice))
      setNote(row.note ?? '')
      setReceivedByUserId(
        row.receivedByUserId ??
          users.find(
            (item) => item.fullName === row.receivedBy || item.username === row.receivedBy,
          )?.id ??
          '',
      )
      return
    }
    setIssuedAt(new Date().toISOString().slice(0, 10))
    setName('')
    setSku('')
    setMaterialId(null)
    setUnitId(units[0]?.id ?? '')
    setQty('')
    setInboundUnitPrice('')
    setNote('')
    setReceivedByUserId('')
  }, [open, row, units, users])

  const selected = materials.find((item) => item.id === materialId)
  const available = useMemo(() => {
    const onHand = Number(qtyFromApi(selected?.qty ?? '0'))
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
  const amount = kind === 'create' ? fifo.amount : row ? String(Math.round(Number(row.amount) || 0)) : ''

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return
    if (!name.trim() || (kind === 'create' && !materialId)) {
      toast.error('Chọn tên hàng từ Kho tồn')
      return
    }
    if (!qty || Number(qty) <= 0) {
      toast.error('Số lượng xuất phải lớn hơn 0')
      return
    }
    if (!unitId) {
      toast.error('Chọn đơn vị tính')
      return
    }
    if (available <= 0) {
      toast.error('Không có đủ số lượng để xuất')
      return
    }
    if (Number(qty) > available) {
      toast.error(`SL sẵn có ${formatQty(String(available))}, không xuất quá số này`)
      return
    }
    if (!receivedByUserId && (kind === 'create' || !row?.receivedBy)) {
      toast.error('Chọn người nhận')
      return
    }
    onSave({
      issuedAt,
      name: name.trim(),
      sku: sku.trim() || undefined,
      materialId,
      unitId: unitId || undefined,
      unitName: units.find((u) => u.id === unitId)?.name,
      qty,
      stockUnitPrice: '0',
      inboundUnitPrice: '0',
      amount: '0',
      note: note.trim() || undefined,
      receivedByUserId: receivedByUserId || undefined,
      applyToStock: !row,
    })
  }

  const title =
    kind === 'view' ? 'Chi tiết phiếu xuất' : kind === 'edit' ? 'Chỉnh sửa phiếu xuất' : 'Thêm phiếu xuất'
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
              label="Ngày xuất"
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              required
              disabled={readOnly}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true } }}
            />
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
          </Stack>
          <MaterialNameField
            value={name}
            materials={materials}
            readOnly={readOnly}
            keepMaterialOnType={kind === 'edit'}
            sx={fieldSx}
            onChange={setName}
            onSelect={(material) => {
              if (!material) {
                if (kind !== 'edit') setMaterialId(null)
                return
              }
              setMaterialId(material.id)
              setSku(material.sku ?? '')
              setUnitId(material.unitId || unitId)
              if (Number(qtyFromApi(material.qty ?? '0')) <= 0) setQty('')
            }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="SL sẵn có"
              value={
                !materialId
                  ? 'Chọn tên hàng'
                  : available <= 0
                    ? 'Không có đủ số lượng để xuất'
                    : `${formatQty(String(available))}${selected?.unit ? ` ${selected.unit}` : ''}`
              }
              disabled
              sx={fieldSx}
              helperText={
                !materialId
                  ? 'Tồn hiện tại, trừ dần khi xuất'
                  : available <= 0
                    ? 'Hàng này đã hết tồn'
                    : qty
                      ? remaining < 0
                        ? 'Vượt quá số lượng sẵn có'
                        : `Còn lại ${formatQty(String(remaining))}${selected?.unit ? ` ${selected.unit}` : ''}`
                      : 'Tồn hiện tại, trừ dần khi xuất'
              }
              error={Boolean(materialId && (available <= 0 || (qty && remaining < 0)))}
            />
            <TextField
              label="Số lượng xuất"
              value={formatQtyInput(qty)}
              onChange={(e) => setQty(parseQtyInput(e.target.value))}
              required
              disabled={readOnly || available <= 0}
              sx={fieldSx}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Đơn giá xuất"
              value={
                kind === 'create'
                  ? fifo.label
                  : formatPriceBreakdown(row?.priceBreakdown, inboundUnitPrice)
              }
              disabled
              multiline
              sx={fieldSx}
            />
            <TextField
              label="Thành tiền"
              value={amount ? formatMoney(amount) : ''}
              disabled
              sx={fieldSx}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Hết số lượng giá cũ (tồn đầu kỳ) rồi mới đến giá nhập mới.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Người Xuất"
              value={row?.issuedBy || operatorName || '—'}
              required
              disabled
              sx={fieldSx}
            />
            <SearchSelect
              label="Người Nhận"
              valueId={receivedByUserId}
              options={users.map((item) => ({
                id: item.id,
                name: item.fullName,
                secondary: item.username,
              }))}
              required
              readOnly={readOnly}
              displayValue={row?.receivedBy ?? undefined}
              placeholder="Tìm tài khoản…"
              sx={fieldSx}
              onChange={setReceivedByUserId}
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
            sx={{
              ...fieldSx,
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
      </form>
    </Dialog>
  )
}

function moneyDigitsFromApi(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return String(Math.round(n))
}

function formatMoneyInput(value: string) {
  if (!value) return ''
  return formatMoney(value)
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
