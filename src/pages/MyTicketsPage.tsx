import { useState, type ReactNode } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Link, Paper, Stack, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  claimSubTicketApi,
  getMyTicketsApi,
  submitSubTicketApi,
  unclaimSubTicketApi,
  unsubmitSubTicketApi,
  type MyTicketItem,
  type ProductionOrderDetail,
} from '../api/productionOrders'
import { formatQty, formatStockedDate } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import { PageHeader } from '../components/ui'
import { QrScannerDialog } from '../components/QrScannerDialog'
import { formatDateShort, STAGE_LABEL } from '../orders/catalog'
import { SubTicketStateChip } from '../orders/OrderChips'

/** Màn của thợ: nhận phiếu con ở khâu đang mở, theo dõi phiếu đang giữ và phiếu vừa nộp. */
export function MyTicketsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [scanOpen, setScanOpen] = useState(false)
  const tickets = useQuery({
    queryKey: ['my-tickets'],
    queryFn: getMyTicketsApi,
    // Người giao xác nhận / KCS nhận lại ở máy khác — tự làm mới để thợ thấy ngay.
    refetchInterval: 30_000,
  })

  const onDone = (order: ProductionOrderDetail) => {
    queryClient.setQueryData(['production-order', order.code], order)
    return queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
  }
  const submit = useMutation({
    mutationFn: (item: MyTicketItem) => submitSubTicketApi(item.orderCode, item.no),
    onSuccess: async (order, item) => {
      toast.success(`Đã báo xong phiếu ${item.ticketCode} — mang hàng tới KCS cân lại`)
      await onDone(order)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const unsubmit = useMutation({
    mutationFn: (item: MyTicketItem) => unsubmitSubTicketApi(item.orderCode, item.no),
    onSuccess: async (order, item) => {
      toast.success(`Đã bỏ báo xong phiếu ${item.ticketCode}`)
      await onDone(order)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const claim = useMutation({
    mutationFn: (item: MyTicketItem) => claimSubTicketApi(item.orderCode, item.no),
    onSuccess: async (order, item) => {
      toast.success(`Đã nhận phiếu ${item.ticketCode} — chờ người giao cân bạc và xác nhận`)
      await onDone(order)
    },
    onError: (error: Error) => {
      toast.error(error.message)
      void queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
    },
  })
  const unclaim = useMutation({
    mutationFn: (item: MyTicketItem) => unclaimSubTicketApi(item.orderCode, item.no),
    onSuccess: async (order, item) => {
      toast.success(`Đã huỷ nhận phiếu ${item.ticketCode}`)
      await onDone(order)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const busy =
    claim.isPending || unclaim.isPending || submit.isPending || unsubmit.isPending

  return (
    <Stack spacing={2} sx={{ pb: 3 }}>
      <PageHeader
        title="Phiếu của tôi"
        subtitle="Nhận phiếu con ở khâu đang mở, rồi mang hàng tới người giao cân bạc và xác nhận."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<QrCodeScannerIcon fontSize="small" />}
              onClick={() => setScanOpen(true)}
            >
              Quét mã
            </Button>
            <Button variant="outlined" onClick={() => void tickets.refetch()} disabled={tickets.isFetching}>
              Làm mới
            </Button>
          </Stack>
        }
      />

      <QrScannerDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={(path) => {
          setScanOpen(false)
          navigate(path)
        }}
      />

      {tickets.isLoading ? (
        <Stack sx={{ py: 6, alignItems: 'center' }}>
          <CircularProgress size={28} />
        </Stack>
      ) : !tickets.data ? (
        <Alert severity="error">
          {tickets.error instanceof Error ? tickets.error.message : 'Không tải được phiếu'}
        </Alert>
      ) : (
        <>
          <Group title="Đang giữ" empty="Chưa nhận phiếu nào." count={tickets.data.mine.length}>
            {tickets.data.mine.map((item) => (
              <TicketCard
                key={`${item.ticketCode}-${item.state}`}
                item={item}
                status={
                  item.state === 'CLAIMED'
                    ? `Đã nhận lúc ${formatDateShort(item.claimedAt)} — chờ người giao cân bạc và xác nhận`
                    : item.state === 'SUBMITTED'
                      ? `Đã báo xong lúc ${formatDateShort(item.submittedAt)} — chờ KCS cân lại`
                      : `Đang làm từ ${formatDateShort(item.handedAt)} · người giao ${item.handedByName ?? '—'}`
                }
                action={
                  item.state === 'CLAIMED' ? (
                    <Button size="small" color="inherit" disabled={busy} onClick={() => unclaim.mutate(item)}>
                      Huỷ nhận
                    </Button>
                  ) : item.state === 'WORKING' ? (
                    <Button size="small" variant="contained" disabled={busy} onClick={() => submit.mutate(item)}>
                      Đã làm xong
                    </Button>
                  ) : item.state === 'SUBMITTED' ? (
                    <Button size="small" color="inherit" disabled={busy} onClick={() => unsubmit.mutate(item)}>
                      Bỏ báo xong
                    </Button>
                  ) : null
                }
              />
            ))}
          </Group>

          <Group
            title="Chờ nhận"
            empty="Chưa có phiếu con nào đang mở khâu."
            count={tickets.data.available.length}
          >
            {tickets.data.available.map((item) => (
              <TicketCard
                key={item.ticketCode}
                item={item}
                status={`Mở khâu lúc ${formatDateShort(item.pendingAt)}`}
                action={
                  <Button variant="contained" disabled={busy} onClick={() => claim.mutate(item)}>
                    Nhận phiếu
                  </Button>
                }
              />
            ))}
          </Group>

          <Group title="Đã nộp gần đây" empty="Chưa có phiếu nào được KCS nhận lại." count={tickets.data.recent.length}>
            {tickets.data.recent.map((item) => (
              <TicketCard
                key={`${item.ticketCode}-${item.stage}-${item.returnedAt}`}
                item={item}
                status={`KCS ${item.returnedByName ?? '—'} nhận lại ${formatDateShort(item.returnedAt)}${
                  item.returnedSilverWeight != null ? ` · ${formatQty(item.returnedSilverWeight)} g` : ''
                }${item.silverLoss != null ? ` · hao hụt ${formatQty(item.silverLoss)} g` : ''}`}
              />
            ))}
          </Group>
        </>
      )}
    </Stack>
  )
}

function Group({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: number
  empty: string
  children: ReactNode
}) {
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        {title} ({count})
      </Typography>
      {count === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {empty}
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  )
}

function TicketCard({ item, status, action }: { item: MyTicketItem; status: string; action?: ReactNode }) {
  return (
    <Paper sx={{ p: 1.5, display: 'flex', gap: 1.5, minWidth: 0 }}>
      <Box
        sx={{
          width: 72,
          height: 72,
          flexShrink: 0,
          borderRadius: 1,
          border: '1px solid #d5dbe0',
          bgcolor: '#f4f6f7',
          overflow: 'hidden',
        }}
      >
        {item.imageUrl ? (
          <Box
            component="img"
            src={cloudinaryThumb(item.imageUrl, 144)}
            alt=""
            loading="lazy"
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
      </Box>
      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Link component={RouterLink} to={`/tickets/${item.ticketCode}`} sx={{ fontWeight: 700 }}>
            {item.ticketCode}
          </Link>
          {item.stage ? <Chip size="small" label={STAGE_LABEL[item.stage]} sx={{ borderRadius: 1 }} /> : null}
          {item.state ? <SubTicketStateChip state={item.state} /> : null}
        </Stack>
        <Typography
          variant="body2"
          sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {item.description}
        </Typography>
        <Typography variant="body2">
          <b>{item.qty}</b> sp
          {item.silverWeight != null ? (
            <>
              {' '}
              · <b>{formatQty(item.silverWeight)}</b> g bạc
            </>
          ) : null}
          {item.dueDate ? ` · cần trả ${formatStockedDate(item.dueDate)}` : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {status}
        </Typography>
        {action ? <Box sx={{ pt: 0.5 }}>{action}</Box> : null}
      </Stack>
    </Paper>
  )
}
