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
  createWarehouseInboundApi,
  deleteWarehouseInboundApi,
  formatMoney,
  formatQty,
  formatQtyInput,
  getInventoryLookupsApi,
  getWarehouseInboundsApi,
  getWarehouseStockApi,
  parseQtyInput,
  qtyFromApi,
  updateWarehouseInboundApi,
  type CreateInboundPayload,
  type InboundRow,
} from '../api/inventory'
import { ConfirmDeleteDialog, TrashIcon } from './ConfirmDeleteDialog'
import { MaterialNameField, type StockMaterialOption } from './MaterialNameField'
import { SearchSelect } from './SearchSelect'
import { useAuth } from '../auth/AuthContext'
import { getLocationsApi } from '../api/locations'

type InboundDialogState =
  | { kind: 'create' }
  | { kind: 'edit' | 'view'; row: InboundRow }

export function StockInboundPanel({ warehouseCode }: { warehouseCode: string }) {
  const { user } = useAuth()
  const operatorName = user?.fullName?.trim() || user?.username || ''
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<InboundDialogState | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(8)
  const inbounds = useQuery({
    queryKey: ['warehouse-inbounds', warehouseCode],
    queryFn: () => getWarehouseInboundsApi(warehouseCode),
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
    locationCode: item.locationCode,
  }))

  const items = inbounds.data?.items ?? []
  const totals = inbounds.data?.totals
  const maxPage = Math.max(0, Math.ceil(items.length / rowsPerPage) - 1)
  const currentPage = Math.min(page, maxPage)
  const paged = items.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deletingRow, setDeletingRow] = useState<InboundRow | null>(null)
  const editing = dialog?.kind === 'edit' || dialog?.kind === 'view' ? dialog.row : null
  const readOnly = dialog?.kind === 'view'

  function openDialog(next: InboundDialogState) {
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
      payload: CreateInboundPayload
    }) =>
      id
        ? updateWarehouseInboundApi(warehouseCode, id, payload)
        : createWarehouseInboundApi(warehouseCode, payload),
    onSuccess: async (_row, input) => {
      toast.success(input.id ? 'Đã cập nhật NVL nhập kho' : 'Đã thêm NVL')
      closeDialog()
      if (!input.id) setPage(9999)
      await queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-locations', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: (row: InboundRow) => deleteWarehouseInboundApi(warehouseCode, row.id),
    onSuccess: async () => {
      toast.success('Đã xóa phiếu nhập')
      setDeletingRow(null)
      await queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      await queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {inbounds.error instanceof Error ? (
        <Alert severity="error" sx={{ flexShrink: 0 }}>
          {inbounds.error.message}
        </Alert>
      ) : null}

      {totals && items.length > 0 ? (
        <Paper sx={{ p: 1.25, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Tổng hợp nhập kho
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
            Thêm NVL
          </Button>
        </Stack>
        <TableContainer sx={{ flex: 1, minHeight: 0, overflowX: 'hidden', overflowY: 'auto' }}>
          {inbounds.isFetching ? <LinearProgress /> : null}
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
                <TableCell>Tên hàng</TableCell>
                <TableCell sx={{ width: 88 }}>Đơn vị tính</TableCell>
                <TableCell align="right" sx={{ width: 80 }}>Số lượng</TableCell>
                <TableCell align="right" sx={{ width: 108 }}>Đơn giá</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Thành tiền</TableCell>
                <TableCell sx={{ width: 120 }}>Ghi chú</TableCell>
                <TableCell sx={{ width: 110 }}>Người nhập</TableCell>
                <TableCell sx={{ width: 100 }}>Mã hàng NCC</TableCell>
                <TableCell sx={{ width: 92 }}>NCC</TableCell>
                <TableCell align="center" sx={{ width: 120, overflow: 'visible' }}>Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((row, index) => (
                <InboundRowView
                  key={row.id}
                  row={row}
                  stt={currentPage * rowsPerPage + index + 1}
                  onView={(row) => openDialog({ kind: 'view', row })}
                  onEdit={(row) => openDialog({ kind: 'edit', row })}
                  onDelete={(row) => setDeletingRow(row)}
                />
              ))}
              {!inbounds.isLoading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12}>Chưa có dòng nhập kho.</TableCell>
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

      <InboundDialog
        open={dialogOpen}
        kind={dialog?.kind ?? 'create'}
        row={editing}
        readOnly={readOnly}
        saving={save.isPending}
        units={lookups.data?.units ?? []}
        suppliers={lookups.data?.suppliers ?? []}
        materials={materials}
        warehouseCode={warehouseCode}
        operatorName={operatorName}
        onClose={closeDialog}
        onExited={() => setDialog(null)}
        onSave={(payload) =>
          save.mutate({ id: dialog?.kind === 'edit' ? editing?.id : undefined, payload })
        }
      />
      <ConfirmDeleteDialog
        open={Boolean(deletingRow)}
        title="Xóa phiếu nhập"
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
        bgcolor: '#f2f8f4',
        border: '1px solid #b7c2cc',
        borderLeft: '4px solid #1e8449',
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

function InboundRowView({
  row,
  stt,
  onView,
  onEdit,
  onDelete,
}: {
  row: InboundRow
  stt: number
  onView: (row: InboundRow) => void
  onEdit: (row: InboundRow) => void
  onDelete: (row: InboundRow) => void
}) {
  return (
    <TableRow hover>
      <TableCell align="center">{stt}</TableCell>
      <TableCell>{formatInboundDate(row.receivedAt)}</TableCell>
      <EllipsisCell text={row.name} />
      <TableCell>{row.unit}</TableCell>
      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatQty(row.qty)}
      </TableCell>
      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatMoney(Number(row.unitPrice) ? row.unitPrice : row.stockUnitPrice)}
      </TableCell>
      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
        {formatMoney(row.amount)}
      </TableCell>
      <EllipsisCell text={row.note ?? '—'} />
      <EllipsisCell text={row.enteredBy ?? '—'} />
      <EllipsisCell text={row.supplierSku ?? '—'} />
      <EllipsisCell text={row.supplierName ?? '—'} />
      <TableCell align="center" sx={{ overflow: 'visible', whiteSpace: 'nowrap' }}>
        <Stack direction="row" spacing={0} sx={{ justifyContent: 'center' }}>
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

function EllipsisCell({ text }: { text: string }) {
  return (
    <Tooltip title={text} disableHoverListener={!text || text === '—'}>
      <TableCell>{text}</TableCell>
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

function formatInboundDate(value: string) {
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function InboundDialog({
  open,
  kind,
  row,
  readOnly,
  saving,
  units,
  suppliers,
  materials,
  warehouseCode,
  operatorName,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  kind: 'create' | 'edit' | 'view'
  row: InboundRow | null
  readOnly: boolean
  saving: boolean
  units: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  materials: StockMaterialOption[]
  warehouseCode: string
  operatorName: string
  onClose: () => void
  onExited: () => void
  onSave: (payload: CreateInboundPayload) => void
}) {
  const locations = useQuery({
    queryKey: ['warehouse-locations', warehouseCode],
    queryFn: () => getLocationsApi(warehouseCode),
    enabled: open,
    staleTime: 20_000,
  })
  const [receivedAt, setReceivedAt] = useState('')
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [unitId, setUnitId] = useState('')
  const [locationCode, setLocationCode] = useState('')
  const [qty, setQty] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [note, setNote] = useState('')
  const [supplierSku, setSupplierSku] = useState('')
  const [supplierId, setSupplierId] = useState('')

  useEffect(() => {
    if (!open) return
    if (row) {
      setReceivedAt(row.receivedAt)
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
      setUnitPrice(moneyDigitsFromApi(Number(row.unitPrice) ? row.unitPrice : row.stockUnitPrice))
      setNote(row.note ?? '')
      setSupplierSku(row.supplierSku ?? '')
      setSupplierId(row.supplierId ?? '')
      setLocationCode(
        materials.find((item) => item.id === row.materialId)?.locationCode ?? '',
      )
      return
    }
    setReceivedAt(new Date().toISOString().slice(0, 10))
    setName('')
    setSku('')
    setMaterialId(null)
    setUnitId(units[0]?.id ?? '')
    setLocationCode('')
    setQty('')
    setUnitPrice('')
    setNote('')
    setSupplierSku('')
    setSupplierId('')
  }, [open, row, units, materials])

  const amount = useMemo(() => {
    const q = Number(qty)
    const p = Number(unitPrice)
    if (!Number.isFinite(q) || !Number.isFinite(p)) return ''
    return String(Math.round(q * p))
  }, [qty, unitPrice])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return
    if (!name.trim() || (kind === 'create' && !materialId)) {
      toast.error('Chọn tên hàng từ Kho tồn')
      return
    }
    if (!qty || Number(qty) < 0) {
      toast.error('Số lượng không hợp lệ')
      return
    }
    if (!unitId) {
      toast.error('Chọn đơn vị tính')
      return
    }
    onSave({
      receivedAt,
      name: name.trim(),
      sku: sku.trim() || undefined,
      materialId,
      unitId: unitId || undefined,
      unitName: units.find((u) => u.id === unitId)?.name,
      qty,
      stockUnitPrice: '0',
      unitPrice: unitPrice || '0',
      amount: amount || String(Math.round((Number(qty) || 0) * (Number(unitPrice) || 0))),
      note: note.trim() || undefined,
      supplierSku: supplierSku.trim() || undefined,
      supplierId: supplierId || undefined,
      applyToStock: !row,
      locationCode: locationCode || null,
    })
  }

  const locationOptions = useMemo(() => {
    const slots = locations.data?.items ?? []
    const opts = slots
      .filter((slot) => !slot.occupied || slot.code === locationCode)
      .map((slot) => ({
        id: slot.code,
        name: slot.code,
        secondary: slot.occupied ? slot.materialName ?? 'Đang dùng' : 'Trống',
      }))
    if (locationCode && !opts.some((item) => item.id === locationCode)) {
      opts.unshift({ id: locationCode, name: locationCode, secondary: 'Hiện tại' })
    }
    return opts
  }, [locationCode, locations.data?.items])

  const title =
    kind === 'view' ? 'Chi tiết NVL' : kind === 'edit' ? 'Chỉnh sửa NVL' : 'Thêm NVL'
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
              label="Người nhập"
              value={row?.enteredBy || operatorName || '—'}
              required
              disabled
              sx={fieldSx}
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
              setLocationCode(material.locationCode ?? '')
            }}
          />
          <SearchSelect
            label="Vị trí"
            valueId={locationCode}
            options={locationOptions}
            allowClear
            readOnly={readOnly}
            displayValue={locationCode || '—'}
            placeholder="Tìm vị trí trống…"
            noOptionsText="Chưa có vị trí. Cấu hình ở mục Cấu hình → Vị trí."
            sx={fieldSx}
            onChange={setLocationCode}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
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
              label="Đơn giá"
              value={formatMoneyInput(unitPrice)}
              onChange={(e) => setUnitPrice(moneyDigitsFromInput(e.target.value))}
              disabled={readOnly}
              sx={fieldSx}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
            <TextField
              label="Thành tiền"
              value={amount ? formatMoney(amount) : ''}
              disabled
              sx={fieldSx}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <SearchSelect
              label="NCC"
              valueId={supplierId}
              options={suppliers}
              readOnly={readOnly}
              displayValue={row?.supplierName ?? undefined}
              placeholder="Tìm NCC…"
              allowClear
              sx={fieldSx}
              onChange={setSupplierId}
            />
            <TextField
              label="Mã hàng NCC"
              value={readOnly ? supplierSku || '—' : supplierSku}
              onChange={(e) => setSupplierSku(e.target.value)}
              disabled={readOnly}
              sx={fieldSx}
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
