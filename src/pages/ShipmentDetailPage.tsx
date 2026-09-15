import { useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import {
  deleteShipmentApi,
  getFinishedGoodsLookupsApi,
  getFinishedGoodsStockApi,
  getShipmentApi,
  updateShipmentApi,
  type ShipmentPayload,
} from '../api/finishedGoods'
import { formatMoney, formatStockedDate } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import { PageHeader } from '../components/ui'
import { ShipmentFormDialog } from '../finishedGoods/ShipmentFormDialog'
import { formatDateTime } from '../orders/catalog'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'

const NUM = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as const

export function ShipmentDetailPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.roleCode === 'ADMIN' || Boolean(user?.extraRoles?.includes('ADMIN'))
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const detail = useQuery({ queryKey: ['shipment', code], queryFn: () => getShipmentApi(code), staleTime: 10_000 })
  const stock = useQuery({
    queryKey: ['finished-goods-stock'],
    queryFn: () => getFinishedGoodsStockApi(),
    enabled: editing,
    staleTime: 15_000,
  })
  const lookups = useQuery({
    queryKey: ['finished-goods-lookups'],
    queryFn: getFinishedGoodsLookupsApi,
    enabled: editing,
    staleTime: 5 * 60_000,
  })

  const refreshRelated = () =>
    Promise.all(
      [['finished-goods-stock'], ['finished-goods-shipments'], ['production-orders'], ['production-order']].map(
        (queryKey) => queryClient.invalidateQueries({ queryKey }),
      ),
    )

  const update = useMutation({
    mutationFn: (payload: ShipmentPayload) => updateShipmentApi(code, payload),
    onSuccess: async (shipment) => {
      queryClient.setQueryData(['shipment', code], shipment)
      toast.success('Đã lưu phiếu xuất')
      setEditing(false)
      await refreshRelated()
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: () => deleteShipmentApi(code),
    onSuccess: async () => {
      toast.success(`Đã xóa phiếu ${code}`)
      await refreshRelated()
      navigate('/finished-goods?tab=shipments', { replace: true })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (detail.isLoading) {
    return (
      <Stack sx={{ py: 6, alignItems: 'center' }}>
        <CircularProgress size={28} />
      </Stack>
    )
  }
  if (!detail.data) {
    return (
      <Alert severity="error">
        {detail.error instanceof Error ? detail.error.message : 'Không tải được phiếu xuất hàng'}
      </Alert>
    )
  }

  const shipment = detail.data
  const margin = Number(shipment.totals.amount) - Number(shipment.totals.costAmount)
  const stale = shipment.lastPrintedAt != null && shipment.dataChangedAt > shipment.lastPrintedAt

  return (
    <Stack spacing={1.5} sx={{ pb: 3 }}>
      <PageHeader
        title={`Phiếu xuất ${shipment.code}`}
        subtitle={`Lập bởi ${shipment.createdByName} · ${formatDateTime(shipment.createdAt)}`}
        breadcrumbs={
          <Breadcrumbs>
            <Link component={RouterLink} to="/finished-goods?tab=shipments" underline="hover" color="inherit">
              Kho thành phẩm
            </Link>
            <Typography color="text.primary">{shipment.code}</Typography>
          </Breadcrumbs>
        }
        actions={
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={() => setEditing(true)}>
              Sửa phiếu
            </Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon fontSize="small" />}
              component={RouterLink}
              to={`/finished-goods/shipments/${shipment.code}/print`}
              target="_blank"
            >
              In phiếu
            </Button>
            {isAdmin ? (
              <Button color="error" onClick={() => setDeleting(true)}>
                Xóa phiếu
              </Button>
            ) : null}
          </Stack>
        }
      />

      {stale ? (
        <Alert severity="warning">Phiếu đã sửa sau lần in gần nhất ({formatDateTime(shipment.lastPrintedAt)}) — nên in lại.</Alert>
      ) : null}

      <Paper sx={{ p: { xs: 1.5, md: 2 } }}>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' } }}>
          <Field label="Ngày xuất" value={formatStockedDate(shipment.shippedAt)} />
          <Field label="Khách hàng" value={shipment.customerName} />
          <Field label="Hình thức thanh toán" value={shipment.paymentMethod} />
          <Field label="Ghi chú" value={shipment.note} />
        </Box>
      </Paper>

      <Paper sx={{ p: { xs: 1.5, md: 2 } }}>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 900, '& td, & th': { px: 1 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Mã SX</TableCell>
                <TableCell>Sản phẩm</TableCell>
                <TableCell sx={NUM}>SL</TableCell>
                <TableCell sx={NUM}>Đơn giá bán</TableCell>
                <TableCell sx={NUM}>Thành tiền</TableCell>
                <TableCell sx={NUM}>Giá vốn / SP</TableCell>
                <TableCell sx={NUM}>Chi phí</TableCell>
                <TableCell>Ghi chú</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shipment.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <Link component={RouterLink} to={`/orders/${line.orderCode}`} sx={{ fontWeight: 700 }}>
                      {line.orderCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      {line.imageUrl ? (
                        <Box
                          component="img"
                          src={cloudinaryThumb(line.imageUrl, 72)}
                          alt=""
                          sx={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 0.5, border: '1px solid #d5dbe0' }}
                        />
                      ) : null}
                      <Box>
                        <Typography variant="body2">{line.description}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[line.sizeLabel && `Size ${line.sizeLabel}`, line.mainMaterial].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell sx={NUM}>{line.qty}</TableCell>
                  <TableCell sx={NUM}>{formatMoney(line.unitPrice)}</TableCell>
                  <TableCell sx={{ ...NUM, fontWeight: 700 }}>{formatMoney(line.amount)}</TableCell>
                  <TableCell sx={NUM}>{formatMoney(line.unitCost)}</TableCell>
                  <TableCell sx={NUM}>{formatMoney(line.costAmount)}</TableCell>
                  <TableCell>{line.note ?? '—'}</TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ '& td': { fontWeight: 700, bgcolor: '#f4f6f7' } }}>
                <TableCell colSpan={2}>Cộng</TableCell>
                <TableCell sx={NUM}>{shipment.totals.qty}</TableCell>
                <TableCell />
                <TableCell sx={NUM}>{formatMoney(shipment.totals.amount)}</TableCell>
                <TableCell />
                <TableCell sx={NUM}>{formatMoney(shipment.totals.costAmount)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="body2" sx={{ mt: 1.25 }}>
          Chênh lệch thành tiền − chi phí: <b>{formatMoney(String(Math.round(margin)))}</b>
          <Typography component="span" variant="caption" color="text.secondary">
            {' '}
            (chi phí chụp theo giá vốn lúc lập / sửa phiếu)
          </Typography>
        </Typography>
      </Paper>

      <ShipmentFormDialog
        open={editing}
        shipment={shipment}
        stock={stock.data?.items ?? []}
        customers={lookups.data?.customers ?? []}
        paymentMethods={lookups.data?.paymentMethods ?? []}
        saving={update.isPending}
        onClose={() => setEditing(false)}
        onSave={(payload) => update.mutate(payload)}
      />
      <ConfirmDeleteDialog
        open={deleting}
        title="Xóa phiếu xuất hàng"
        description={`Xóa phiếu ${shipment.code}? Hàng trả lại kho thành phẩm, "Đã trả" và trạng thái các đơn được tính lại.`}
        deleting={remove.isPending}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
      />
    </Stack>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ overflowWrap: 'anywhere' }}>
        {value == null || value === '' ? '—' : value}
      </Typography>
    </Box>
  )
}
