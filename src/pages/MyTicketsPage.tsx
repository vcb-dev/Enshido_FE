import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EventIcon from '@mui/icons-material/Event'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import InboxIcon from '@mui/icons-material/Inbox'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import RefreshIcon from '@mui/icons-material/Refresh'
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined'
import ScaleIcon from '@mui/icons-material/Scale'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  getMyTicketsApi,
  getSubTicketOrderApi,
  type MyCastingSlipItem,
  type MyTicketItem,
  type MyTickets,
  type SubTicketState,
} from '../api/productionOrders'
import {
  startCastingSlipApi,
  submitCastingSlipResultApi,
  type CastingSlipResultPayload,
  type CastingSlipStatus,
} from '../api/castingSlips'
import { CastingSlipResultDialog } from '../intake/CastingSlipResultDialog'
import { formatQty } from '../api/inventory'
import { applyCastingSlipUpdate } from '../casting/castingSlipsCache'
import { CardGroupSkeleton } from '../components/ui'
import { formatDateShort, STAGE_LABEL } from '../orders/catalog'
import { SubTicketStateChip } from '../orders/OrderChips'
import { useQueuedSubTickets, useSubTicketAction } from '../orders/subTicketActions'
import { queuedLabel, type QueuedSubTicketAction, type SubTicketAction } from '../orders/subTicketQueue'
import { dueInfo, EmptyState, MetaItem, TicketThumb } from '../worker/WorkerUi'

type TabKey = 'mine' | 'available' | 'recent'

/** Thứ tự việc đang giữ: đang làm lên đầu, rồi chờ giao, cuối cùng là đã báo xong. */
const MINE_ORDER: Partial<Record<SubTicketState, number>> = { WORKING: 0, CLAIMED: 1, SUBMITTED: 2 }

const CASTING_MINE_ORDER: Partial<Record<CastingSlipStatus, number>> = {
  CASTING: 0,
  PENDING_CONFIRMATION: 1,
  PENDING_ISSUE: 2,
}

const CASTING_SLIP_STATUS_LABEL: Record<CastingSlipStatus, string> = {
  PENDING_ISSUE: 'Chờ cấp vật tư',
  WAIT_CASTING: 'Chờ đúc',
  CASTING: 'Đang đúc',
  PENDING_CONFIRMATION: 'Chờ thủ kho xác nhận',
  DONE: 'Đúc xong',
  CAST_FAILED: 'Lỗi đúc',
}

/** Màn của thợ: nhận phiếu đang mở ở khâu của mình, theo dõi việc đang giữ và vừa nộp. */
export function MyTicketsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const tickets = useQuery({
    queryKey: ['my-tickets'],
    queryFn: getMyTicketsApi,
    staleTime: 45_000,
    // API my-tickets nặng (nhiều truy vấn) — tránh poll quá dày.
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })

  // Prefetch tối đa vài phiếu — prefetch hàng loạt sau my-tickets làm nghẽn API.
  useEffect(() => {
    if (!tickets.data) return
    const queue = [...tickets.data.available, ...tickets.data.mine].slice(0, 4)
    if (queue.length === 0) return
    for (const item of queue) {
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

  const data = tickets.data
  const mine = useMemo(
    () =>
      [...(data?.mine ?? [])].sort(
        (a, b) => (MINE_ORDER[a.state ?? 'IDLE'] ?? 9) - (MINE_ORDER[b.state ?? 'IDLE'] ?? 9),
      ),
    [data?.mine],
  )
  // Phiếu sắp tới hạn lên trước để thợ nhận đúng việc gấp.
  const available = useMemo(
    () =>
      [...(data?.available ?? [])].sort(
        (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || (a.pendingAt ?? '').localeCompare(b.pendingAt ?? ''),
      ),
    [data?.available],
  )
  const recent = data?.recent ?? []
  const castingMine = useMemo(
    () =>
      [...(data?.castingMine ?? [])].sort(
        (a, b) => (CASTING_MINE_ORDER[a.status] ?? 9) - (CASTING_MINE_ORDER[b.status] ?? 9),
      ),
    [data?.castingMine],
  )
  const castingAvailable = data?.castingAvailable ?? []
  const castingRecent = data?.castingRecent ?? []

  const [resultSlip, setResultSlip] = useState<MyCastingSlipItem | null>(null)
  const [startingId, setStartingId] = useState<string | null>(null)

  function patchMyTickets(patch: (prev: MyTickets) => MyTickets) {
    queryClient.setQueryData<MyTickets>(['my-tickets'], (prev) => (prev ? patch(prev) : prev))
  }

  const startCasting = useMutation({
    mutationFn: (id: string) => startCastingSlipApi(id),
    onMutate: async (id) => {
      setStartingId(id)
      await queryClient.cancelQueries({ queryKey: ['my-tickets'] })
      const prev = queryClient.getQueryData<MyTickets>(['my-tickets'])
      const moved = prev?.castingAvailable?.find((row) => row.id === id)
      if (prev && moved) {
        const now = new Date().toISOString()
        patchMyTickets((data) => ({
          ...data,
          castingAvailable: (data.castingAvailable ?? []).filter((row) => row.id !== id),
          castingMine: [{ ...moved, status: 'CASTING', startedAt: now }, ...(data.castingMine ?? [])],
        }))
      }
      return { prev }
    },
    onSuccess: (slip) => {
      toast.success(`Phiếu ${slip.code}: đã nhận — đang đúc`)
      patchMyTickets((data) => ({
        ...data,
        castingMine: (data.castingMine ?? []).map((row) =>
          row.id === slip.id
            ? {
                ...row,
                status: 'CASTING',
                startedAt: slip.startedAt ?? row.startedAt,
              }
            : row,
        ),
      }))
    },
    onError: (error: Error, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['my-tickets'], ctx.prev)
      toast.error(error.message)
    },
    onSettled: () => setStartingId(null),
  })

  const submitCastingResult = useMutation({
    mutationFn: (vars: { id: string; payload: CastingSlipResultPayload }) =>
      submitCastingSlipResultApi(vars.id, vars.payload),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['my-tickets'] })
      const prev = queryClient.getQueryData<MyTickets>(['my-tickets'])
      const held = prev?.castingMine?.find((row) => row.id === id)
      if (prev && held) {
        patchMyTickets((data) => ({
          ...data,
          castingMine: (data.castingMine ?? []).map((row) =>
            row.id === id ? { ...row, status: 'PENDING_CONFIRMATION' } : row,
          ),
        }))
      }
      return { prev }
    },
    onSuccess: (slip) => {
      setResultSlip(null)
      applyCastingSlipUpdate(queryClient, slip)
      toast.success(`Phiếu ${slip.code}: đã gửi kết quả — chờ thủ kho xác nhận`)
    },
    onError: (error: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['my-tickets'], ctx.prev)
      toast.error(error.message)
    },
  })

  function openCastingResult(item: MyCastingSlipItem) {
    setResultSlip(item)
  }

  const [tab, setTab] = useState<TabKey | null>(null)
  // Lần đầu vào: đang giữ việc thì mở tab việc của tôi, chưa có thì mở tab chờ nhận.
  const activeTab: TabKey =
    tab ??
    (data &&
    mine.length === 0 &&
    castingMine.length === 0 &&
    available.length + castingAvailable.length > 0
      ? 'available'
      : 'mine')

  const availableCount = available.length + castingAvailable.length
  const mineCount = mine.length + castingMine.length
  const recentCount = recent.length + castingRecent.length

  const count = (state: SubTicketState) => mine.filter((item) => item.state === state).length

  const sending = (item: MyTicketItem, action: SubTicketAction) => {
    const entry = queued.get(item.ticketCode)
    return entry?.action === action && !entry.waiting
  }
  const vars = (item: MyTicketItem) => ({ orderCode: item.orderCode, no: item.no, ticketCode: item.ticketCode })

  const actionFor = (item: MyTicketItem): ReactNode => {
    const busy = queued.has(item.ticketCode)
    if (activeTab === 'available') {
      return (
        <Button
          variant="contained"
          disabled={busy}
          loading={sending(item, 'claim')}
          onClick={() => claim.mutate(vars(item))}
          sx={{ minWidth: 132 }}
        >
          Nhận phiếu
        </Button>
      )
    }
    if (item.state === 'WORKING') {
      return (
        <Button
          variant="contained"
          disabled={busy}
          loading={sending(item, 'submit')}
          onClick={() => submit.mutate(vars(item))}
          sx={{ minWidth: 132 }}
        >
          Đã làm xong
        </Button>
      )
    }
    if (item.state === 'CLAIMED') {
      return (
        <Button
          variant="outlined"
          color="inherit"
          disabled={busy}
          loading={sending(item, 'unclaim')}
          onClick={() => unclaim.mutate(vars(item))}
        >
          Huỷ nhận
        </Button>
      )
    }
    if (item.state === 'SUBMITTED') {
      return (
        <Button
          variant="outlined"
          color="inherit"
          disabled={busy}
          loading={sending(item, 'unsubmit')}
          onClick={() => unsubmit.mutate(vars(item))}
        >
          Bỏ báo xong
        </Button>
      )
    }
    return null
  }

  const list = activeTab === 'mine' ? mine : activeTab === 'available' ? available : recent
  const castingList =
    activeTab === 'mine'
      ? castingMine
      : activeTab === 'available'
        ? castingAvailable
        : activeTab === 'recent'
          ? castingRecent
          : []

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.35rem', md: '1.6rem' } }}>
            Phiếu của tôi
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ mt: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              {user?.fullName ? `${user.fullName} · ` : ''}Khâu của bạn:
            </Typography>
            {(data?.stages ?? []).map((stage) => (
              <Chip
                key={stage}
                size="small"
                label={STAGE_LABEL[stage]}
                sx={{ borderRadius: 1, bgcolor: 'action.selected', color: 'primary.dark', fontWeight: 600 }}
              />
            ))}
          </Stack>
        </Box>
        <Tooltip title={tickets.dataUpdatedAt ? `Cập nhật lúc ${formatDateShort(new Date(tickets.dataUpdatedAt).toISOString())}` : 'Làm mới'}>
          <IconButton
            aria-label="Làm mới"
            onClick={() => void tickets.refetch()}
            loading={tickets.isFetching}
            sx={{ border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {tickets.isLoading ? (
        <CardGroupSkeleton count={3} media />
      ) : !data ? (
        <Alert severity="error">{tickets.error instanceof Error ? tickets.error.message : 'Không tải được phiếu'}</Alert>
      ) : (
        <>
          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
            <StatTile
              label="Đang làm"
              value={count('WORKING')}
              icon={<AccessTimeIcon />}
              accent="#6c5ce7"
              onClick={() => setTab('mine')}
            />
            <StatTile
              label="Chờ giao bạc"
              value={count('CLAIMED')}
              icon={<HourglassEmptyIcon />}
              accent="#1565c0"
              onClick={() => setTab('mine')}
            />
            <StatTile
              label="Chờ KCS cân"
              value={count('SUBMITTED')}
              icon={<AssignmentTurnedInIcon />}
              accent="#8a6100"
              onClick={() => setTab('mine')}
            />
            <StatTile
              label="Phiếu chờ nhận"
              value={availableCount}
              icon={<InboxIcon />}
              accent="#6b4513"
              highlight={availableCount > 0}
              onClick={() => setTab('available')}
            />
          </Box>

          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              bgcolor: 'background.default',
              mx: { xs: -2, md: 0 },
              px: { xs: 2, md: 0 },
              pt: { xs: 0.5, md: 0 },
            }}
          >
            <Tabs
              value={activeTab}
              onChange={(_, value: TabKey) => setTab(value)}
              variant="fullWidth"
              sx={{
                minHeight: 44,
                borderBottom: '1px solid',
                borderColor: 'divider',
                maxWidth: { md: 560 },
                '& .MuiTab-root': { minHeight: 44, fontWeight: 600, textTransform: 'none', px: 1 },
              }}
            >
              <Tab value="mine" label={<TabLabel text="Đang giữ" count={mineCount} />} />
              <Tab value="available" label={<TabLabel text="Chờ nhận" count={availableCount} />} />
              <Tab value="recent" label={<TabLabel text="Đã nộp" count={recentCount} />} />
            </Tabs>
          </Box>

          {list.length === 0 && castingList.length === 0 ? (
            activeTab === 'mine' ? (
              <EmptyState
                icon={<AssignmentTurnedInIcon />}
                title="Bạn chưa giữ phiếu nào"
                description={
                  availableCount
                    ? `Có ${availableCount} phiếu đang chờ nhận ở khâu của bạn.`
                    : 'Khi người giao mở khâu của bạn, phiếu sẽ hiện ở tab Chờ nhận.'
                }
              />
            ) : activeTab === 'available' ? (
              <EmptyState
                icon={<InboxIcon />}
                title="Chưa có phiếu nào chờ nhận"
                description="Chỉ hiện phiếu đang mở ở khâu của bạn. Màn tự làm mới mỗi 10 giây."
              />
            ) : (
              <EmptyState icon={<HistoryOutlinedIcon />} title="Chưa có phiếu nào được KCS nhận lại" />
            )
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: { xs: 1.25, md: 1.5 },
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
              }}
            >
              {castingList.map((item) => (
                <CastingSlipCard
                  key={`casting-${item.code}`}
                  item={item}
                  tab={activeTab}
                  starting={startingId === item.id && startCasting.isPending}
                  onStart={() => {
                    setStartingId(item.id)
                    startCasting.mutate(item.id)
                  }}
                  onEnterResult={() => void openCastingResult(item)}
                />
              ))}
              {list.map((item) => (
                <TicketCard
                  key={`${item.ticketCode}-${item.stage}-${item.state}-${item.returnedAt ?? ''}`}
                  item={item}
                  queued={queued.get(item.ticketCode)}
                  status={statusLine(item, activeTab)}
                  action={activeTab === 'recent' ? null : actionFor(item)}
                />
              ))}
            </Box>
          )}
        </>
      )}
      <CastingSlipResultDialog
        slip={resultSlip}
        saving={submitCastingResult.isPending}
        onClose={() => setResultSlip(null)}
        onSave={(payload) => resultSlip && submitCastingResult.mutate({ id: resultSlip.id, payload })}
      />
    </Stack>
  )
}

function castingSlipStatusLine(item: MyCastingSlipItem, tab: TabKey) {
  if (tab === 'recent') {
    return item.confirmedAt
      ? `Thủ kho xác nhận ${formatDateShort(item.confirmedAt)}`
      : 'Đã hoàn tất'
  }
  if (tab === 'available') {
    return `Ngày phiếu ${formatDateShort(item.slipDate)} · bấm Nhận phiếu để bắt đầu đúc`
  }
  if (item.startedAt) return `Bắt đầu đúc ${formatDateShort(item.startedAt)}`
  return `Ngày phiếu ${formatDateShort(item.slipDate)} · ${CASTING_SLIP_STATUS_LABEL[item.status]}`
}

function CastingSlipCard({
  item,
  tab,
  starting,
  onStart,
  onEnterResult,
}: {
  item: MyCastingSlipItem
  tab: TabKey
  starting: boolean
  onStart: () => void
  onEnterResult: () => void
}) {
  const status = castingSlipStatusLine(item, tab)
  const action =
    tab === 'available' && item.status === 'WAIT_CASTING' ? (
      <Button size="small" variant="contained" loading={starting} onClick={onStart} sx={{ minWidth: 132 }}>
        Nhận phiếu
      </Button>
    ) : tab === 'mine' && item.status === 'CASTING' ? (
      <Button size="small" variant="contained" onClick={onEnterResult} sx={{ minWidth: 132 }}>
        Nhập kết quả đúc
      </Button>
    ) : null

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        transition: 'box-shadow .15s',
        '&:hover': { boxShadow: '0 4px 16px rgba(62,42,14,.08)' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          p: 1.5,
          flex: 1,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            flexShrink: 0,
            borderRadius: 1.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'action.selected',
            color: 'primary.dark',
          }}
        >
          <LocalFireDepartmentOutlinedIcon />
        </Box>
        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 800, letterSpacing: '.01em' }}>{item.code}</Typography>
            <Chip
              size="small"
              label="Phiếu đúc"
              sx={{ height: 22, borderRadius: 1, bgcolor: 'action.selected', color: 'primary.dark', fontWeight: 600 }}
            />
            <Box sx={{ flex: 1 }} />
            <Chip
              size="small"
              label={CASTING_SLIP_STATUS_LABEL[item.status]}
              sx={{ height: 22, borderRadius: 1, fontWeight: 600 }}
            />
          </Stack>
          <Typography
            variant="body2"
            sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {item.batchOrderCodes}
          </Typography>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', pt: 0.25 }}>
            <MetaItem icon={<Inventory2OutlinedIcon />}>{item.orderCount} đơn</MetaItem>
            <MetaItem icon={<ScaleIcon />}>{formatQty(item.waxWeightGram)} g sáp</MetaItem>
            <MetaItem icon={<EventIcon />}>{formatDateShort(item.slipDate)}</MetaItem>
          </Stack>
        </Stack>
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          px: 1.5,
          py: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
          minHeight: 52,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {status}
        </Typography>
        {action}
      </Stack>
    </Paper>
  )
}

function TabLabel({ text, count }: { text: string; count: number }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <span>{text}</span>
      <Box
        component="span"
        sx={{
          minWidth: 22,
          px: 0.75,
          borderRadius: 99,
          fontSize: 12,
          lineHeight: '20px',
          bgcolor: count ? 'primary.main' : 'action.selected',
          color: count ? 'primary.contrastText' : 'text.secondary',
        }}
      >
        {count}
      </Box>
    </Stack>
  )
}

function StatTile({
  label,
  value,
  icon,
  accent,
  highlight,
  onClick,
}: {
  label: string
  value: number
  icon: ReactNode
  accent: string
  highlight?: boolean
  onClick: () => void
}) {
  return (
    <Paper
      component="button"
      type="button"
      onClick={onClick}
      variant="outlined"
      sx={{
        textAlign: 'left',
        font: 'inherit',
        cursor: 'pointer',
        borderRadius: 2,
        p: { xs: 1, md: 1.75 },
        display: 'flex',
        gap: 1.25,
        alignItems: 'center',
        borderColor: highlight ? accent : 'divider',
        bgcolor: 'background.paper',
        transition: 'border-color .15s, box-shadow .15s',
        '&:hover': { borderColor: accent, boxShadow: '0 2px 10px rgba(62,42,14,.08)' },
        '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: 2 },
      }}
    >
      <Box
        sx={{
          width: { xs: 30, md: 36 },
          height: { xs: 30, md: 36 },
          flexShrink: 0,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          color: accent,
          bgcolor: `${accent}14`,
          '& svg': { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.25rem', md: '1.45rem' }, lineHeight: 1.1 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {label}
        </Typography>
      </Box>
    </Paper>
  )
}

function statusLine(item: MyTicketItem, tab: TabKey) {
  if (tab === 'recent') {
    const loss =
      item.silverLoss != null
        ? ` · hao hụt ${formatQty(item.silverLoss)} g${item.silverLossPercent != null ? ` (${formatQty(item.silverLossPercent)}%)` : ''}`
        : ''
    return `KCS ${item.returnedByName ?? '—'} nhận lại ${formatDateShort(item.returnedAt)}${loss}`
  }
  if (tab === 'available') return `Mở khâu lúc ${formatDateShort(item.pendingAt)}`
  if (item.state === 'CLAIMED') return `Đã nhận ${formatDateShort(item.claimedAt)} · chờ người giao cân bạc và xác nhận`
  if (item.state === 'SUBMITTED') return `Báo xong ${formatDateShort(item.submittedAt)} · mang hàng tới KCS cân lại`
  return `Bắt đầu ${formatDateShort(item.handedAt)} · người giao ${item.handedByName ?? '—'}`
}

function TicketCard({
  item,
  status,
  action,
  queued,
}: {
  item: MyTicketItem
  status: string
  action: ReactNode
  /** Thao tác thợ đã bấm nhưng chưa chốt được với máy chủ. */
  queued?: QueuedSubTicketAction
}) {
  const due = dueInfo(item.dueDate)
  const weight = item.returnedSilverWeight ?? item.silverWeight
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        borderColor: due?.tone === 'error' ? 'error.light' : 'divider',
        transition: 'box-shadow .15s',
        '&:hover': { boxShadow: '0 4px 16px rgba(62,42,14,.08)' },
      }}
    >
      <Box
        component={RouterLink}
        to={`/tickets/${item.ticketCode}`}
        sx={{
          display: 'flex',
          gap: 1.5,
          p: 1.5,
          color: 'inherit',
          textDecoration: 'none',
          flex: 1,
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <TicketThumb url={item.imageUrl} size={64} />
        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 800, letterSpacing: '.01em' }}>{item.ticketCode}</Typography>
            {item.stage ? (
              <Chip
                size="small"
                label={STAGE_LABEL[item.stage]}
                sx={{ height: 22, borderRadius: 1, bgcolor: 'action.selected', color: 'primary.dark', fontWeight: 600 }}
              />
            ) : null}
            <Box sx={{ flex: 1 }} />
            {item.state ? <SubTicketStateChip state={item.state} /> : null}
          </Stack>
          <Typography
            variant="body2"
            sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {item.description}
          </Typography>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', pt: 0.25 }}>
            <MetaItem icon={<Inventory2OutlinedIcon />}>{item.qty} sp</MetaItem>
            {weight != null ? <MetaItem icon={<ScaleIcon />}>{formatQty(weight)} g</MetaItem> : null}
            {due ? (
              <MetaItem icon={<EventIcon />} tone={due.tone}>
                {due.label}
              </MetaItem>
            ) : null}
          </Stack>
          {item.issuedLines?.length ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {issuedSummary(item)}
            </Typography>
          ) : null}
          {item.pendingRequests ? (
            <Typography variant="caption" color="warning.main" sx={{ display: 'block', fontWeight: 600 }}>
              {item.pendingRequests} yêu cầu xin thêm đang chờ kho xuất
            </Typography>
          ) : null}
        </Stack>
        <ChevronRightIcon sx={{ color: 'text.disabled', alignSelf: 'center', display: { xs: 'none', sm: 'block' } }} />
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          px: 1.5,
          py: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
          minHeight: 52,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Trạng thái trên thẻ vẫn là cái máy chủ đang giữ — chip này chỉ nói thao tác
              của thợ chưa lên tới nơi, không được hiểu là đã nhận / đã xong. */}
          {queued ? (
            <Chip size="small" color="warning" label={queuedLabel(queued)} sx={{ borderRadius: 1, mb: 0.25 }} />
          ) : null}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {status}
          </Typography>
        </Box>
        {action}
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
  return [text(true) ? `Nhận: ${text(true)}` : '', text(false) ? `xin thêm: ${text(false)}` : '']
    .filter(Boolean)
    .join(' · ')
}
