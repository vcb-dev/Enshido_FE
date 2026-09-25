import { useState } from 'react'
import {
  Alert,
  Button,
  Chip,
  Link,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import {
  issueMaterialRequestApi,
  listMaterialRequestsApi,
  rejectMaterialRequestApi,
  type IssueMaterialPayload,
  type MaterialRequestQueueItem,
  type MaterialRequestStatus,
} from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { PageHeader, TableSkeleton } from '../components/ui'
import { formatDateShort, STAGE_LABEL } from '../orders/catalog'
import {
  IssueMaterialDialog,
  KIND_LABEL,
  RejectMaterialDialog,
  REQUEST_STATUS_META,
} from '../orders/MaterialRequests'
import { seedProductionOrder } from '../orders/orderCache'

const TABS: Array<{ value: MaterialRequestStatus; label: string }> = [
  { value: 'PENDING', label: 'Chờ xuất' },
  { value: 'ISSUED', label: 'Đã xuất' },
  { value: 'REJECTED', label: 'Không xuất' },
]

/** Hàng chờ của kho: thợ xin xuất bạc / đá trong lúc làm khâu, kho cân rồi xuất. */
export function MaterialRequestsPage() {
  const { user } = useAuth()
  const isAdmin = user?.roleCode === 'ADMIN' || Boolean(user?.extraRoles?.includes('ADMIN'))
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<MaterialRequestStatus>('PENDING')
  const [issuing, setIssuing] = useState<MaterialRequestQueueItem | null>(null)
  const [rejecting, setRejecting] = useState<MaterialRequestQueueItem | null>(null)

  const list = useQuery({
    queryKey: ['material-requests', status],
    queryFn: () => listMaterialRequestsApi(status),
    staleTime: 5_000,
    refetchInterval: status === 'PENDING' ? 15_000 : false,
  })

  const done = (message: string) => ({
    onSuccess: (order: Parameters<typeof seedProductionOrder>[1]) => {
      seedProductionOrder(queryClient, order)
      void queryClient.invalidateQueries({ queryKey: ['material-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['production-order-costing', order.code] })
      void queryClient.invalidateQueries({ queryKey: ['production-order-activity', order.code] })
      void queryClient.invalidateQueries({ queryKey: ['nvl-options'] })
      void queryClient.invalidateQueries({ queryKey: ['btp-options'] })
      toast.success(message)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const issue = useMutation({
    mutationFn: (payload: IssueMaterialPayload) => issueMaterialRequestApi(issuing?.id ?? '', payload),
    ...done('Đã xuất NVL cho thợ'),
  })
  const reject = useMutation({
    mutationFn: (reason: string) => rejectMaterialRequestApi(rejecting?.id ?? '', reason),
    ...done('Đã từ chối yêu cầu'),
  })

  const rows = list.data ?? []

  return (
    <Stack spacing={1.5}>
      <PageHeader
        title="Yêu cầu xuất NVL"
        subtitle="Thợ xin thêm bạc / đá trong lúc làm khâu — cân rồi xuất, phần xuất tự tạo phiếu xuất gắn mã đơn."
      />
      <Paper sx={{ p: 1.5 }}>
        <Tabs value={status} onChange={(_, value: MaterialRequestStatus) => setStatus(value)} sx={{ mb: 1 }}>
          {TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </Tabs>
        {list.isLoading ? (
          <TableSkeleton />
        ) : list.error ? (
          <Alert severity="error">{list.error.message}</Alert>
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
            {status === 'PENDING' ? 'Không có yêu cầu nào đang chờ xuất.' : 'Chưa có yêu cầu nào.'}
          </Typography>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table
              size="small"
              sx={{
                minWidth: 900,
                '& td, & th': { px: 1, py: 0.75, fontSize: '0.84rem', borderColor: '#e9e0d4' },
                '& th': { fontWeight: 700, bgcolor: '#f8f3eb' },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Lúc xin</TableCell>
                  <TableCell>Phiếu · khâu</TableCell>
                  <TableCell>Thợ</TableCell>
                  <TableCell>Mã NVL</TableCell>
                  <TableCell align="right">Xin</TableCell>
                  <TableCell align="right">{status === 'PENDING' ? 'Tồn kho' : 'Đã xuất'}</TableCell>
                  <TableCell>{status === 'PENDING' ? 'Thao tác' : 'Xử lý'}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const own = row.requestedByUserId === user?.id
                  const short = Number(row.stockQty) < Number(row.requestedQty)
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell>{formatDateShort(row.requestedAt)}</TableCell>
                      <TableCell>
                        <Link component={RouterLink} to={`/tickets/${row.ticketCode}`} sx={{ fontWeight: 700 }}>
                          {row.ticketCode}
                        </Link>
                        {row.stage ? ` · ${STAGE_LABEL[row.stage]}` : ''}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {row.orderDescription}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.requestedByName}</TableCell>
                      <TableCell>
                        {row.material.sku ? `${row.material.sku} — ` : ''}
                        {row.material.name}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {row.material.warehouseName}
                          {row.note ? ` · ${row.note}` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatQty(row.requestedQty)} {row.material.unit}
                      </TableCell>
                      <TableCell align="right">
                        {status === 'PENDING' ? (
                          <Typography
                            variant="body2"
                            color={short ? 'error.main' : undefined}
                            sx={{ fontSize: 'inherit' }}
                          >
                            {formatQty(row.stockQty)} {row.material.unit}
                          </Typography>
                        ) : row.status === 'ISSUED' ? (
                          <>
                            {formatQty(row.issuedQty ?? '0')} {row.material.unit}
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {[
                                row.issuedWeight ? `${formatQty(row.issuedWeight)} g` : null,
                                row.issuedStoneCount ? `${row.issuedStoneCount} viên` : null,
                                KIND_LABEL[row.kind],
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </Typography>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {status === 'PENDING' ? (
                          own && !isAdmin ? (
                            <Typography variant="caption" color="text.secondary">
                              Yêu cầu của chính bạn — nhờ người khác xuất
                            </Typography>
                          ) : (
                            <Stack direction="row" spacing={0.5}>
                              <Button size="small" variant="contained" onClick={() => setIssuing(row)}>
                                Xuất
                              </Button>
                              <Button size="small" color="error" onClick={() => setRejecting(row)}>
                                Từ chối
                              </Button>
                            </Stack>
                          )
                        ) : (
                          <>
                            <Chip
                              size="small"
                              variant="outlined"
                              color={REQUEST_STATUS_META[row.status].color}
                              label={REQUEST_STATUS_META[row.status].label}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {row.handledByName} · {formatDateShort(row.handledAt)}
                            </Typography>
                            {row.rejectReason ? (
                              <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                                {row.rejectReason}
                              </Typography>
                            ) : null}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <IssueMaterialDialog
        request={issuing}
        suggestedKind={issuing?.suggestedKind}
        saving={issue.isPending}
        onClose={() => setIssuing(null)}
        onSave={(payload) => issue.mutate(payload, { onSuccess: () => setIssuing(null) })}
      />
      <RejectMaterialDialog
        request={rejecting}
        saving={reject.isPending}
        onClose={() => setRejecting(null)}
        onSave={(reason) => reject.mutate(reason, { onSuccess: () => setRejecting(null) })}
      />
    </Stack>
  )
}
