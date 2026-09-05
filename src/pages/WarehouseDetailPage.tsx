import { memo, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom'
import {
  Alert,
  Autocomplete,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  formatMoney,
  formatQty,
  formatQtyInput,
  getInventoryLookupsApi,
  getWarehouseStockApi,
  parseQtyInput,
  qtyFromApi,
  updateWarehouseStockApi,
  type AvailabilityCode,
  type LookupItem,
  type StockRow,
  type StockTotals,
  type UpdateStockPayload,
} from '../api/inventory'
import { colorHex, COLOR_CATALOG } from '../warehouses/colorPalette'
import { StockInboundPanel } from '../warehouses/StockInboundPanel'
import { StockOutboundPanel } from '../warehouses/StockOutboundPanel'
import {
  MOCK_IN,
  MOCK_OUT,
  MOCK_STOCK,
  binSectionByCode,
  stockWarehouseCode,
  warehouseByCode,
  warehousePath,
  type StockMove,
} from '../warehouses/catalog'

export function WarehouseDetailPage() {
  const { code, bin, section } = useParams<{
    code: string
    bin?: string
    section?: string
  }>()

  if (code === 'ban-thanh-pham') {
    return <Navigate to="/kho/nvl-chinh/bac/btp" replace />
  }

  const warehouse = warehouseByCode(code ?? '')
  const activeBin = warehouse?.bins?.find((b) => b.code === bin)
  const activeSection = binSectionByCode(section, bin)
  const hasBins = Boolean(warehouse?.bins?.length)

  if (!warehouse) {
    return <Navigate to="/kho" replace />
  }

  if (hasBins && !bin) {
    return <Navigate to={warehousePath(warehouse)} replace />
  }

  if (hasBins && bin && !activeBin) {
    return <Navigate to={warehousePath(warehouse)} replace />
  }

  if (section === 'gia') {
    return <Navigate to="/cau-hinh-gia" replace />
  }

  if (hasBins && activeBin && !activeSection) {
    return <Navigate to={warehousePath(warehouse, activeBin.code, 'ton')} replace />
  }

  const stockKey = stockWarehouseCode(warehouse, activeBin?.code, section)
  const items = MOCK_STOCK[stockKey] ?? []
  const title = hasBins
    ? `${activeSection?.name} — ${activeBin?.name}`
    : warehouse.name
  const subtitle = hasBins
    ? activeSection?.code === 'btp'
      ? 'Bán thành phẩm đã gia công, chờ gắn đá — thuộc Kho bạc.'
      : `${activeBin?.name} thuộc ${warehouse.name}.`
    : warehouse.description

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <Breadcrumbs sx={{ flexShrink: 0 }}>
        <Link component={RouterLink} to="/kho" underline="hover" color="inherit">
          Kho
        </Link>
        {activeBin ? (
          <Typography color="text.secondary">{warehouse.shortName}</Typography>
        ) : null}
        {activeBin ? (
          <Typography color="text.secondary">{activeBin.name}</Typography>
        ) : null}
        <Typography color="text.primary">
          {activeSection?.name ?? warehouse.shortName}
        </Typography>
      </Breadcrumbs>

      <Stack sx={{ flexShrink: 0 }}>
        <Typography variant="h5">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Stack>

      {activeSection?.code === 'nhap' ? (
        stockKey === 'da' ? (
          <StockInboundPanel warehouseCode={stockKey} />
        ) : (
          <MoveTable key={`${stockKey}-nhap`} kind="nhap" binCode={stockKey} items={items} />
        )
      ) : activeSection?.code === 'xuat' ? (
        stockKey === 'da' ? (
          <StockOutboundPanel warehouseCode={stockKey} />
        ) : (
          <MoveTable key={`${stockKey}-xuat`} kind="xuat" binCode={stockKey} items={items} />
        )
      ) : (
        <StockOnHandTable warehouseCode={stockKey} />
      )}
    </Stack>
  )
}

const numCell = { fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const }
const split = { borderLeft: '2px solid #1b4f72' }
const groupHead = {
  open: { ...split, bgcolor: '#edf1f4', fontWeight: 700 },
  in: { ...split, bgcolor: '#e4f0e8', fontWeight: 700 },
  out: { ...split, bgcolor: '#f3ebe7', fontWeight: 700 },
  stock: { ...split, bgcolor: '#d6e3ee', fontWeight: 700, color: 'primary.main' },
  meta: { ...split, bgcolor: '#f4f6f7', fontWeight: 700 },
}
const groupBody = {
  open: { ...split, ...numCell, bgcolor: '#f7f9fb' },
  in: { ...split, ...numCell, bgcolor: '#f2f8f4' },
  out: { ...split, ...numCell, bgcolor: '#faf6f4' },
  stock: { ...split, ...numCell, bgcolor: '#eaf0f6', fontWeight: 700 },
  meta: { ...split },
}

function availabilityColor(code: AvailabilityCode) {
  if (code === 'IN_STOCK') return 'success' as const
  if (code === 'LOW') return 'warning' as const
  return 'error' as const
}

const STATUS_FILTERS: { value: 'ALL' | AvailabilityCode; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'IN_STOCK', label: 'Còn' },
  { value: 'LOW', label: 'Sắp hết hàng' },
  { value: 'OUT_OF_STOCK', label: 'Hết hàng' },
]

function StockOnHandTable({ warehouseCode }: { warehouseCode: string }) {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'ALL' | AvailabilityCode>('ALL')
  const [dialog, setDialog] = useState<StockRow | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(8)
  const stock = useQuery({
    queryKey: ['warehouse-stock', warehouseCode],
    queryFn: () => getWarehouseStockApi(warehouseCode),
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
  useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  })
  const items = stock.data?.items ?? []
  const statusCounts = useMemo(() => {
    const counts = { IN_STOCK: 0, LOW: 0, OUT_OF_STOCK: 0 }
    for (const row of items) counts[row.availability] += 1
    return counts
  }, [items])
  const visible = useMemo(() => {
    if (statusFilter === 'ALL') return items
    return items.filter((row) => row.availability === statusFilter)
  }, [items, statusFilter])
  const filtered = statusFilter !== 'ALL'
  const totals = filtered ? sumStockTotals(visible) : stock.data?.totals
  const maxPage = Math.max(0, Math.ceil(visible.length / rowsPerPage) - 1)
  const currentPage = Math.min(page, maxPage)
  const paged = visible.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage,
  )

  const editing = dialog
  const openEdit = useCallback((row: StockRow) => setDialog(row), [])

  const save = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStockPayload }) =>
      updateWarehouseStockApi(warehouseCode, id, payload),
    onSuccess: async (row) => {
      toast.success('Đã cập nhật NVL')
      setDialog(null)
      queryClient.setQueryData(
        ['warehouse-stock', warehouseCode],
        (current: { items: StockRow[]; totals: StockTotals } | undefined) => {
          if (!current) return current
          const items = current.items.map((item) => (item.id === row.id ? row : item))
          return { ...current, items, totals: sumStockTotals(items) }
        },
      )
      void queryClient.invalidateQueries({ queryKey: ['warehouse-stock', warehouseCode] })
      void queryClient.invalidateQueries({ queryKey: ['warehouse-inbounds', warehouseCode] })
      void queryClient.invalidateQueries({ queryKey: ['warehouse-outbounds', warehouseCode] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {stock.error instanceof Error ? (
        <Alert severity="error" sx={{ flexShrink: 0 }}>{stock.error.message}</Alert>
      ) : null}

      {totals && visible.length > 0 ? (
        <StockSummaryBar totals={totals} count={visible.length} filtered={filtered} />
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
          spacing={1}
          sx={{
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5,
            py: 1,
            borderBottom: '1px solid #d5dbe0',
            flexWrap: 'nowrap',
          }}
        >
          <FormControl size="small" sx={{ width: 220, flex: '0 0 auto' }}>
            <InputLabel id="stock-status-filter">Trạng thái</InputLabel>
            <Select
              labelId="stock-status-filter"
              label="Trạng thái"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | AvailabilityCode)
                setPage(0)
              }}
              renderValue={(value) => {
                const opt = STATUS_FILTERS.find((item) => item.value === value)
                const count = value === 'ALL' ? items.length : statusCounts[value]
                const label = `${opt?.label ?? 'Tất cả'} (${count})`
                if (value === 'ALL') return label
                return (
                  <Chip
                    size="small"
                    variant="outlined"
                    color={availabilityColor(value)}
                    label={label}
                  />
                )
              }}
            >
              {STATUS_FILTERS.map((opt) => {
                const count = opt.value === 'ALL' ? items.length : statusCounts[opt.value]
                const label = `${opt.label} (${count})`
                return (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.value === 'ALL' ? (
                      label
                    ) : (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={availabilityColor(opt.value)}
                        label={label}
                        sx={{ pointerEvents: 'none' }}
                      />
                    )}
                  </MenuItem>
                )
              })}
            </Select>
          </FormControl>
        </Stack>
        <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {stock.isFetching ? <LinearProgress /> : null}
          <Table
            size="small"
            sx={{
              minWidth: 1480,
              borderCollapse: 'separate',
              borderSpacing: 0,
              '& .MuiTableCell-root': {
                border: '1px solid #b7c2cc',
                py: 0.75,
                px: 1,
              },
              '& .MuiTableCell-head': {
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
                <TableCell rowSpan={2} align="center">
                  STT
                </TableCell>
                <TableCell rowSpan={2}>Vị trí</TableCell>
                {warehouseCode === 'da' ? null : (
                  <TableCell rowSpan={2}>Mã NVL</TableCell>
                )}
                <TableCell rowSpan={2}>Hình dạng</TableCell>
                <TableCell rowSpan={2}>Màu sắc</TableCell>
                <TableCell rowSpan={2}>Tên NVL</TableCell>
                <TableCell rowSpan={2} align="center">
                  Đơn vị
                </TableCell>
                <TableCell align="center" colSpan={2} sx={groupHead.open}>
                  Tồn đầu kỳ
                </TableCell>
                <TableCell align="center" colSpan={2} sx={groupHead.in}>
                  Nhập
                </TableCell>
                <TableCell align="center" colSpan={2} sx={groupHead.out}>
                  Xuất
                </TableCell>
                <TableCell align="center" colSpan={2} sx={groupHead.stock}>
                  Tồn kho
                </TableCell>
                <TableCell rowSpan={2} sx={groupHead.meta}>
                  Loại đá
                </TableCell>
                <TableCell rowSpan={2} align="center">
                  Trạng thái
                </TableCell>
                <TableCell rowSpan={2} align="center">
                  Hành động
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell align="right" sx={groupHead.open}>
                  SL
                </TableCell>
                <TableCell align="right" sx={{ bgcolor: groupHead.open.bgcolor }}>
                  TT
                </TableCell>
                <TableCell align="right" sx={groupHead.in}>
                  SL
                </TableCell>
                <TableCell align="right" sx={{ bgcolor: groupHead.in.bgcolor }}>
                  TT
                </TableCell>
                <TableCell align="right" sx={groupHead.out}>
                  SL
                </TableCell>
                <TableCell align="right" sx={{ bgcolor: groupHead.out.bgcolor }}>
                  TT
                </TableCell>
                <TableCell align="right" sx={groupHead.stock}>
                  SL
                </TableCell>
                <TableCell align="right" sx={{ bgcolor: groupHead.stock.bgcolor, color: 'primary.main' }}>
                  TT
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((row, index) => {
                const stt = currentPage * rowsPerPage + index + 1
                return (
                  <StockOnHandRow
                    key={row.id}
                    row={row}
                    stt={stt}
                    hideSku={warehouseCode === 'da'}
                    onEdit={openEdit}
                  />
                )
              })}
              {!stock.isLoading && visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={warehouseCode === 'da' ? 17 : 18}>
                    {stock.isLoading
                      ? 'Đang tải…'
                      : 'Chưa có hàng tồn. Thêm tên hàng ở Cấu hình giá sản phẩm.'}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
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
          rowsPerPageOptions={[8, 25, 50, 100]}
          labelRowsPerPage="Mỗi trang"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}–${to} / ${count} NVL`
          }
          sx={{ flexShrink: 0, borderTop: '1px solid #d5dbe0' }}
        />
      </Paper>
      <StockEditDialog
        open={dialog !== null}
        row={editing}
        hideSku={warehouseCode === 'da'}
        saving={save.isPending}
        onClose={() => setDialog(null)}
        onSave={(payload) => {
          if (!editing) return
          save.mutate({ id: editing.id, payload })
        }}
      />
    </Stack>
  )
}

function sumStockTotals(rows: StockRow[]): StockTotals {
  const sum = (pick: (row: StockRow) => string) =>
    String(rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0))
  return {
    openingQty: sum((r) => r.openingQty),
    openingAmount: sum((r) => r.openingAmount),
    inQty: sum((r) => r.inQty),
    inAmount: sum((r) => r.inAmount),
    outQty: sum((r) => r.outQty),
    outAmount: sum((r) => r.outAmount),
    qty: sum((r) => r.qty),
    amount: sum((r) => r.amount),
  }
}

const StockOnHandRow = memo(function StockOnHandRow({
  row,
  stt,
  hideSku,
  onEdit,
}: {
  row: StockRow
  stt: number
  hideSku?: boolean
  onEdit: (row: StockRow) => void
}) {
  return (
    <TableRow hover>
      <TableCell align="center">{stt}</TableCell>
      <TableCell>{row.locationCode ?? '—'}</TableCell>
      {hideSku ? null : (
        <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{row.sku ?? '—'}</TableCell>
      )}
      <TableCell>{row.shape ?? '—'}</TableCell>
      <TableCell>{row.color ?? '—'}</TableCell>
      <TableCell sx={{ minWidth: 220 }}>{row.name}</TableCell>
      <TableCell align="center">{row.unit}</TableCell>
      <TableCell align="right" sx={groupBody.open}>
        {formatQty(row.openingQty)}
      </TableCell>
      <TableCell align="right" sx={{ ...numCell, bgcolor: groupBody.open.bgcolor }}>
        {formatMoney(row.openingAmount)}
      </TableCell>
      <TableCell align="right" sx={groupBody.in}>
        {formatQty(row.inQty)}
      </TableCell>
      <TableCell align="right" sx={{ ...numCell, bgcolor: groupBody.in.bgcolor }}>
        {formatMoney(row.inAmount)}
      </TableCell>
      <TableCell align="right" sx={groupBody.out}>
        {formatQty(row.outQty)}
      </TableCell>
      <TableCell align="right" sx={{ ...numCell, bgcolor: groupBody.out.bgcolor }}>
        {formatMoney(row.outAmount)}
      </TableCell>
      <TableCell align="right" sx={groupBody.stock}>
        {formatQty(row.qty)}
      </TableCell>
      <TableCell align="right" sx={{ ...groupBody.stock, borderLeft: '1px solid #b7c2cc' }}>
        {formatMoney(row.amount)}
      </TableCell>
      <TableCell sx={groupBody.meta}>{row.materialType ?? '—'}</TableCell>
      <TableCell align="center">
        <Chip
          size="small"
          variant="outlined"
          color={availabilityColor(row.availability)}
          label={row.availabilityLabel}
        />
      </TableCell>
      <TableCell align="center">
        <IconButton size="small" aria-label="Chỉnh sửa" onClick={() => onEdit(row)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 20h4.6L19.2 9.4a1.5 1.5 0 0 0 0-2.1l-2.5-2.5a1.5 1.5 0 0 0-2.1 0L4 15.4V20Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="m13.2 6.2 4.6 4.6" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </IconButton>
      </TableCell>
    </TableRow>
  )
})

function StockSummaryBar({
  totals,
  count,
  filtered,
}: {
  totals: StockTotals
  count: number
  filtered: boolean
}) {
  return (
    <Paper sx={{ p: 1.25, flexShrink: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mb: 1, alignItems: { sm: 'baseline' }, justifyContent: 'space-between' }}
      >
        <Typography variant="subtitle2">Tổng hợp nhập-xuất-tồn</Typography>
        <Typography variant="caption" color="text.secondary">
          {filtered ? `Đang lọc · ${count} NVL` : `Toàn kho · ${count} NVL`}
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
        }}
      >
        <SummaryCard title="Tồn đầu kỳ" tone="open" sl={totals.openingQty} tt={totals.openingAmount} />
        <SummaryCard title="Nhập" tone="in" sl={totals.inQty} tt={totals.inAmount} />
        <SummaryCard title="Xuất" tone="out" sl={totals.outQty} tt={totals.outAmount} />
        <SummaryCard title="Tồn kho" tone="stock" sl={totals.qty} tt={totals.amount} />
      </Box>
    </Paper>
  )
}

function SummaryCard({
  title,
  tone,
  sl,
  tt,
}: {
  title: string
  tone: 'open' | 'in' | 'out' | 'stock'
  sl: string
  tt: string
}) {
  const colors = {
    open: { bg: '#f7f9fb', bar: '#5d6d7e' },
    in: { bg: '#f2f8f4', bar: '#1e8449' },
    out: { bg: '#faf6f4', bar: '#b9770e' },
    stock: { bg: '#eaf0f6', bar: '#1b4f72' },
  }[tone]

  return (
    <Box
      sx={{
        bgcolor: colors.bg,
        border: '1px solid #b7c2cc',
        borderLeft: `4px solid ${colors.bar}`,
        borderRadius: 1,
        px: 1.25,
        py: 1,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 0.75, color: colors.bar }}>
        {title}
      </Typography>
      <Stack spacing={0.35}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
          <Typography variant="caption" color="text.secondary">
            Số lượng (SL):
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: colors.bar, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatQty(sl)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline' }}>
          <Typography variant="caption" color="text.secondary">
            Thành tiền (TT):
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: colors.bar, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMoney(tt)}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  )
}

function MoveTable({
  kind,
  binCode,
  items,
}: {
  kind: 'nhap' | 'xuat'
  binCode: string
  items: typeof MOCK_STOCK[string]
}) {
  const seed = kind === 'nhap' ? MOCK_IN[binCode] ?? [] : MOCK_OUT[binCode] ?? []
  const [rows, setRows] = useState<StockMove[]>(seed)
  const [open, setOpen] = useState(false)

  const label = kind === 'nhap' ? 'phiếu nhập' : 'phiếu xuất'

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Tạo {label}
        </Button>
      </Stack>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Số phiếu</TableCell>
              <TableCell>Ngày</TableCell>
              <TableCell>Mã</TableCell>
              <TableCell>Tên hàng</TableCell>
              <TableCell align="right">Số lượng</TableCell>
              <TableCell>Đơn vị</TableCell>
              <TableCell>Ghi chú</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.docNo} hover>
                <TableCell>{row.docNo}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.sku}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell align="right">{row.qty}</TableCell>
                <TableCell>{row.unit}</TableCell>
                <TableCell>{row.note ?? '—'}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>Chưa có {label}.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

      <MoveDialog
        open={open}
        kind={kind}
        items={items}
        onClose={() => setOpen(false)}
        onSave={(move) => {
          setRows((prev) => [move, ...prev])
          setOpen(false)
          toast.success(`Đã tạo ${label}`)
        }}
      />
    </Stack>
  )
}

function MoveDialog({
  open,
  kind,
  items,
  onClose,
  onSave,
}: {
  open: boolean
  kind: 'nhap' | 'xuat'
  items: typeof MOCK_STOCK[string]
  onClose: () => void
  onSave: (move: StockMove) => void
}) {
  const [sku, setSku] = useState(items[0]?.sku ?? '')
  const [qty, setQty] = useState('0')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setSku(items[0]?.sku ?? '')
    setQty('0')
    setNote('')
  }, [open, items])

  const selected = useMemo(() => items.find((i) => i.sku === sku), [items, sku])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const amount = Number(qty)
    if (!selected || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Số lượng không hợp lệ')
      return
    }
    const prefix = kind === 'nhap' ? 'PN' : 'PX'
    onSave({
      docNo: `${prefix}-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().slice(0, 10),
      sku: selected.sku,
      name: selected.name,
      qty: amount,
      unit: selected.unit,
      note: note.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={onSubmit}>
        <DialogTitle>{kind === 'nhap' ? 'Tạo phiếu nhập' : 'Tạo phiếu xuất'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <TextField
            select
            label="Hàng"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            required
            sx={{ mt: 1 }}
          >
            {items.map((i) => (
              <MenuItem key={i.sku} value={i.sku}>
                {i.sku} — {i.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Số lượng"
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
            slotProps={{ htmlInput: { min: 0.01, step: 'any' } }}
          />
          <TextField
            label="Ghi chú"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="contained">
            Lưu
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function StockEditDialog({
  open,
  row,
  hideSku,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  row: StockRow | null
  hideSku?: boolean
  saving: boolean
  onClose: () => void
  onSave: (payload: UpdateStockPayload) => void
}) {
  const lookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    enabled: open,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  })
  const [locationCode, setLocationCode] = useState('')
  const [sku, setSku] = useState('')
  const [shapeId, setShapeId] = useState('')
  const [colorId, setColorId] = useState('')
  const [name, setName] = useState('')
  const [unitId, setUnitId] = useState('')
  const [materialTypeId, setMaterialTypeId] = useState('')
  const [openingQty, setOpeningQty] = useState('0')
  const [stockUnitPrice, setStockUnitPrice] = useState('0')
  const [inQty, setInQty] = useState('0')
  const [inAmount, setInAmount] = useState('0')
  const [outQty, setOutQty] = useState('0')
  const [outAmount, setOutAmount] = useState('0')

  useEffect(() => {
    if (!open) return
    if (!row) {
      setLocationCode('')
      setSku('')
      setShapeId('')
      setColorId('')
      setName('')
      setUnitId('')
      setMaterialTypeId('')
      setOpeningQty('0')
      setStockUnitPrice('0')
      setInQty('0')
      setInAmount('0')
      setOutQty('0')
      setOutAmount('0')
      return
    }
    setLocationCode(row.locationCode ?? '')
    setSku(row.sku ?? '')
    setShapeId(row.shapeId ?? '')
    setColorId(row.colorId ?? '')
    setName(row.name)
    setUnitId(row.unitId)
    setMaterialTypeId(row.materialTypeId ?? '')
    setOpeningQty(qtyFromApi(row.openingQty))
    setStockUnitPrice(row.stockUnitPrice)
    setInQty(qtyFromApi(row.inQty))
    setInAmount(row.inAmount)
    setOutQty(qtyFromApi(row.outQty))
    setOutAmount(row.outAmount)
  }, [open, row])

  const colors = useMemo(() => {
    const api = lookups.data?.colors ?? []
    const byCode = new Map(api.map((item) => [item.code, item]))
    const ordered: LookupItem[] = []
    for (const pal of COLOR_CATALOG) {
      const hit = byCode.get(pal.code)
      if (hit) {
        ordered.push(hit)
        byCode.delete(pal.code)
      }
    }
    ordered.push(...byCode.values())
    return ordered
  }, [lookups.data?.colors])
  const selectedColor = colors.find((item) => item.id === colorId) ?? null
  const openingAmount = String(Math.round((Number(openingQty) || 0) * (Number(stockUnitPrice) || 0)))
  const qty = String((Number(openingQty) || 0) + (Number(inQty) || 0) - (Number(outQty) || 0))
  const amount = String(
    Math.round((Number(openingAmount) || 0) + (Number(inAmount) || 0) - (Number(outAmount) || 0)),
  )

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      toast.error('Tên NVL không được trống')
      return
    }
    if (!unitId) {
      toast.error('Chọn đơn vị tính')
      return
    }
    onSave({
      ...(hideSku ? {} : { sku }),
      locationCode,
      name: name.trim(),
      unitId,
      shapeId: shapeId || null,
      colorId: colorId || null,
      materialTypeId: materialTypeId || null,
      openingQty,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle sx={{ pb: 0.5 }}>
          {row ? `Chỉnh sửa ${row.name || 'NVL'}` : 'Thêm NVL'}
        </DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            pt: 1,
            '& .MuiFormLabel-asterisk': { color: 'error.main' },
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
            <TextField
              label="Tên NVL"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              sx={{ flex: 2 }}
            />
            <TextField
              label="Vị trí"
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value)}
              sx={{ flex: 1 }}
            />
            {hideSku ? null : (
              <TextField
                label="Mã NVL"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                sx={{ flex: 1 }}
              />
            )}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              select
              label="Hình dạng"
              value={shapeId}
              onChange={(e) => setShapeId(e.target.value)}
              sx={{ flex: 1 }}
            >
              <MenuItem value="">—</MenuItem>
              {(lookups.data?.shapes ?? []).map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              sx={{ flex: 1, minWidth: 0 }}
              options={colors}
              value={selectedColor}
              onChange={(_, next) => setColorId(next?.id ?? '')}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={(options, state) => {
                const q = state.inputValue.trim().toLowerCase()
                if (!q) return options
                return options.filter(
                  (item) =>
                    item.name.toLowerCase().includes(q) ||
                    item.code.toLowerCase().includes(q),
                )
              }}
              disablePortal
              autoHighlight
              openOnFocus
              noOptionsText="Không có màu khớp"
              renderOption={(props, option) => {
                const { key, ...rest } = props
                return (
                  <Box component="li" key={key} {...rest} sx={{ gap: 1 }}>
                    <ColorSwatch code={option.code} name={option.name} />
                    {option.name}
                  </Box>
                )
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Màu sắc"
                  placeholder="Tìm màu…"
                  slotProps={{
                    ...params.slotProps,
                    input: {
                      ...params.slotProps.input,
                      startAdornment: (
                        <>
                          {selectedColor ? (
                            <Box sx={{ display: 'flex', ml: 0.5, mr: 0.75 }}>
                              <ColorSwatch
                                code={selectedColor.code}
                                name={selectedColor.name}
                              />
                            </Box>
                          ) : null}
                          {params.slotProps.input.startAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
            />
            <TextField
              select
              label="Đơn vị"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              required
              sx={{ flex: 1 }}
            >
              {!row ? <MenuItem value="">Chọn đơn vị</MenuItem> : null}
              {(lookups.data?.units ?? []).map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Loại đá"
              value={materialTypeId}
              onChange={(e) => setMaterialTypeId(e.target.value)}
              sx={{ flex: 1 }}
            >
              <MenuItem value="">—</MenuItem>
              {(lookups.data?.materialTypes ?? []).map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <TextField
            label="Đơn giá tồn"
            value={formatMoney(stockUnitPrice || '0')}
            disabled
            helperText="Cấu hình tại mục Cấu hình giá sản phẩm. TT đầu kỳ = SL đầu kỳ × đơn giá tồn."
          />

          <NxtGrid
            openingQty={openingQty}
            openingAmount={openingAmount}
            inQty={inQty}
            inAmount={inAmount}
            outQty={outQty}
            outAmount={outAmount}
            qty={qty}
            amount={amount}
            onOpeningQty={setOpeningQty}
          />
          <Typography variant="body2" sx={{ color: '#1e8449', fontWeight: 600, px: 0.25 }}>
            Tồn kho = Tồn đầu kỳ + Nhập − Xuất (cố định). SL {formatQty(qty)} · TT {formatMoney(amount)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {row ? 'Lưu' : 'Thêm'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function ColorSwatch({ code, name }: { code?: string | null; name?: string | null }) {
  return (
    <Box
      component="span"
      sx={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        bgcolor: colorHex(code, name),
        border: '1px solid rgba(0,0,0,0.28)',
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  )
}

function NxtGrid({
  openingQty,
  openingAmount,
  inQty,
  inAmount,
  outQty,
  outAmount,
  qty,
  amount,
  onOpeningQty,
}: {
  openingQty: string
  openingAmount: string
  inQty: string
  inAmount: string
  outQty: string
  outAmount: string
  qty: string
  amount: string
  onOpeningQty: (value: string) => void
}) {
  const cols = [
    { key: 'open', label: 'Tồn đầu kỳ', bg: '#edf1f4', note: 'TT = SL × đơn giá tồn' },
    { key: 'in', label: 'Nhập', bg: '#e4f0e8', note: 'Tổng phiếu nhập (Σ SL × đơn giá)' },
    { key: 'out', label: 'Xuất', bg: '#f3ebe7', note: 'Tổng phiếu xuất theo ngày' },
    { key: 'stock', label: 'Tồn kho', bg: '#d6e3ee', note: 'Công thức cố định' },
  ] as const

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '72px repeat(4, minmax(0, 1fr))',
          border: '1px solid #b7c2cc',
          borderRadius: 1,
          overflow: 'hidden',
          '& > *': {
            borderRight: '1px solid #b7c2cc',
            borderBottom: '1px solid #b7c2cc',
            px: 1,
            py: 0.85,
            minWidth: 0,
          },
          '& > *:nth-of-type(5n)': { borderRight: 'none' },
          '& > *:nth-last-of-type(-n + 5)': { borderBottom: 'none' },
        }}
      >
        <Box sx={{ bgcolor: '#f4f6f7', fontWeight: 700, fontSize: 12, color: 'text.secondary' }} />
        {cols.map((col) => (
          <Box
            key={col.key}
            sx={{
              bgcolor: col.bg,
              fontWeight: 700,
              fontSize: 13,
              textAlign: 'center',
              color: col.key === 'stock' ? 'primary.main' : 'text.primary',
              lineHeight: 1.25,
            }}
          >
            {col.label}
            {col.note ? (
              <Box
                component="span"
                sx={{
                  display: 'block',
                  fontWeight: 500,
                  fontSize: 11,
                  color: 'text.secondary',
                  fontStyle: 'italic',
                  mt: 0.25,
                }}
              >
                {col.note}
              </Box>
            ) : null}
          </Box>
        ))}

        <Box sx={{ bgcolor: '#f4f6f7', fontSize: 12, fontWeight: 700, color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
          SL
        </Box>
        <NxtCell value={formatQtyInput(openingQty)} editable onChange={(v) => onOpeningQty(parseQtyInput(v))} />
        <NxtCell value={formatQty(inQty)} />
        <NxtCell value={formatQty(outQty)} />
        <NxtCell value={formatQty(qty)} />

        <Box sx={{ bgcolor: '#f4f6f7', fontSize: 12, fontWeight: 700, color: 'text.secondary', display: 'flex', alignItems: 'center', borderBottom: 'none' }}>
          TT
        </Box>
        <NxtCell
          value={formatMoney(openingAmount || '0')}
        />
        <NxtCell value={formatMoney(inAmount)} />
        <NxtCell value={formatMoney(outAmount)} />
        <NxtCell value={formatMoney(amount || '0')} />
      </Box>
    </Box>
  )
}

function NxtCell({
  value,
  editable,
  onChange,
}: {
  value: string
  editable?: boolean
  onChange?: (value: string) => void
}) {
  if (!editable) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          fontVariantNumeric: 'tabular-nums',
          color: 'text.secondary',
          bgcolor: '#fbfcfd',
        }}
      >
        {value}
      </Box>
    )
  }
  return (
    <Box sx={{ p: '4px 6px !important', bgcolor: '#fff' }}>
      <TextField
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        size="small"
        fullWidth
        hiddenLabel
        slotProps={{
          htmlInput: {
            inputMode: 'decimal',
            style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '6px 8px' },
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root': { bgcolor: '#fff' },
          '& fieldset': { borderColor: '#d5dbe0' },
        }}
      />
    </Box>
  )
}
