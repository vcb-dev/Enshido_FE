import { useEffect, type ReactNode } from 'react'
import { Alert, Box, Button, Chip, Link, Paper, Stack, Typography } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import {
  getMyTicketsApi,
  getSubTicketOrderApi,
  type MyTicketItem,
} from '../api/productionOrders'
import { formatQty, formatStockedDate } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import { CardGroupSkeleton, PageHeader } from '../components/ui'
import { ScanQrButton } from '../components/ScanQrButton'
import { formatDateShort, STAGE_LABEL } from '../orders/catalog'
import { SubTicketStateChip } from '../orders/OrderChips'
import { useQueuedSubTickets, useSubTicketAction } from '../orders/subTicketActions'
import { queuedLabel, type QueuedSubTicketAction, type SubTicketAction } from '../orders/subTicketQueue'

/** Màn của thợ: nhận phiếu mẹ hoặc phiếu con đang mở, theo dõi việc đang giữ và vừa nộp. */
export function MyTicketsPage() {
  const queryClient = useQueryClient()
  const tickets = useQuery({
    queryKey: ['my-tickets'],
    queryFn: getMyTicketsApi,
    // Khâu vừa được mở từ máy người giao phải xuất hiện sớm trên máy của thợ.
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!tickets.data) return
    for (const item of [...tickets.data.available, ...tickets.data.mine]) {
      const key = ['production-order', item.orderCode] as const
      if (queryClient.getQueryData(key)) continue
      void queryClient.prefetchQuery({
        queryKey: key,
        queryFn: () => getSubTicketOrderApi(item.ticketCode),
        staleTime: 60_000,
      })
    }
  }, [tickets.data, queryClient])

  // Cache, thông báo và hàng chờ khi mất mạng nằm hết trong orders/subTicketActions.ts.
  const claim = useSubTicketAction('claim')
  const unclaim = useSubTicketAction('unclaim')
  const submit = useSubTicketAction('submit')
  const unsubmit = useSubTicketAction('unsubmit')
  // Khoá theo từng phiếu, không khoá cả màn: mất mạng thì thao tác nằm chờ rất lâu, thợ
  // vẫn phải bấm được phiếu khác. Bảng này còn nguyên sau khi tắt mở lại app.
  const queued = useQueuedSubTickets()

  // Đang gửi lên máy chủ thì nút quay; nằm chờ mạng thì chỉ khoá — chip "Chờ gửi" đã nói rõ.
  const sending = (item: MyTicketItem, action: SubTicketAction) => {
    const entry = queued.get(item.ticketCode)
    return entry?.action === action && !entry.waiting
  }

  const vars = (item: MyTicketItem) => ({
    orderCode: item.orderCode,
    no: item.no,
    ticketCode: item.ticketCode,
  })

  return (
    <Stack spacing={2} sx={{ pb: 3 }}>
      <PageHeader
        title="Phiếu của tôi"
        subtitle="Nhận phiếu ở khâu đang mở — người lên đơn xuất NVL (Nguội: phôi BTP, Vào đá: kho NVL chính) và xác nhận giao."
        actions={
          <Stack direction="row" spacing={1}>
            <ScanQrButton />
            <Button variant="outlined" onClick={() => void tickets.refetch()} loading={tickets.isFetching}>
              Làm mới
            </Button>
          </Stack>
        }
      />

      {tickets.isLoading ? (
        <>
          <CardGroupSkeleton count={2} media />
          <CardGroupSkeleton count={2} media />
        </>
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
                queued={queued.get(item.ticketCode)}
                status={
                  item.state === 'CLAIMED'
                    ? `Đã nhận lúc ${formatDateShort(item.claimedAt)} — chờ người lên đơn xuất NVL và xác nhận giao`
                    : item.state === 'SUBMITTED'
                      ? `Đã báo xong lúc ${formatDateShort(item.submittedAt)} — chờ KCS cân lại`
                      : `Đang làm từ ${formatDateShort(item.handedAt)} · người giao ${item.handedByName ?? '—'}`
                }
                action={
                  item.state === 'CLAIMED' ? (
                    <Button
                      size="small"
                      color="inherit"
                      disabled={queued.has(item.ticketCode)}
                      loading={sending(item, 'unclaim')}
                      onClick={() => unclaim.mutate(vars(item))}
                    >
                      Huỷ nhận
                    </Button>
                  ) : item.state === 'WORKING' ? (
                    <Button
                      size="small"
                      variant="contained"
                      disabled={queued.has(item.ticketCode)}
                      loading={sending(item, 'submit')}
                      onClick={() => submit.mutate(vars(item))}
                    >
                      Đã làm xong
                    </Button>
                  ) : item.state === 'SUBMITTED' ? (
                    <Button
                      size="small"
                      color="inherit"
                      disabled={queued.has(item.ticketCode)}
                      loading={sending(item, 'unsubmit')}
                      onClick={() => unsubmit.mutate(vars(item))}
                    >
                      Bỏ báo xong
                    </Button>
                  ) : null
                }
              />
            ))}
          </Group>

          <Group
            title="Chờ nhận"
            empty="Chưa có phiếu nào đang mở khâu."
            count={tickets.data.available.length}
          >
            {tickets.data.available.map((item) => (
              <TicketCard
                key={item.ticketCode}
                item={item}
                queued={queued.get(item.ticketCode)}
                status={`Mở khâu lúc ${formatDateShort(item.pendingAt)}`}
                action={
                  <Button
                    variant="contained"
                    disabled={queued.has(item.ticketCode)}
                    loading={sending(item, 'claim')}
                    onClick={() => claim.mutate(vars(item))}
                  >
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
                }${
                  item.silverLoss != null
                    ? ` · hao hụt ${formatQty(item.silverLoss)} g${item.silverLossPercent != null ? ` (${formatQty(item.silverLossPercent)}%)` : ''}`
                    : ''
                }`}
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

function TicketCard({
  item,
  status,
  action,
  queued,
}: {
  item: MyTicketItem
  status: string
  action?: ReactNode
  /** Thao tác thợ đã bấm nhưng chưa chốt được với máy chủ. */
  queued?: QueuedSubTicketAction
}) {
  return (
    <Paper sx={{ p: 1.5, display: 'flex', gap: 1.5, minWidth: 0 }}>
      <Box
        sx={{
          width: 72,
          height: 72,
          flexShrink: 0,
          borderRadius: 1,
          border: '1px solid #ded3c3',
          bgcolor: '#f8f3eb',
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
          {/* Trạng thái bên trên vẫn là cái máy chủ đang giữ — chip này chỉ nói thao tác
              của thợ chưa lên tới nơi, không được hiểu là đã nhận / đã xong. */}
          {queued ? (
            <Chip size="small" color="warning" label={queuedLabel(queued)} sx={{ borderRadius: 1 }} />
          ) : null}
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
        {item.issuedLines?.length ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            {issuedSummary(item)}
          </Typography>
        ) : null}
        {item.pendingRequests ? (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', fontWeight: 600 }}>
            {item.pendingRequests} yêu cầu xin thêm đang chờ kho xuất
          </Typography>
        ) : null}
        <Typography variant="caption" color="text.secondary">
          {status}
        </Typography>
        {action ? <Box sx={{ pt: 0.5 }}>{action}</Box> : null}
      </Stack>
    </Paper>
  )
}

/** "Nhận: 00001 2 chiếc (1.000 g) · xin thêm: 00001 1 chiếc (500 g)". */
function issuedSummary(item: MyTicketItem) {
  const text = (atHandover: boolean) =>
    item.issuedLines
      .filter((line) => line.atHandover === atHandover)
      .map(
        (line) =>
          `${line.sku || line.name} ${formatQty(line.qty ?? '0')} ${line.unit}${line.weight ? ` (${formatQty(line.weight)} g)` : ''}`,
      )
      .join(', ')
  return [
    text(true) ? `Nhận: ${text(true)}` : '',
    text(false) ? `xin thêm: ${text(false)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
