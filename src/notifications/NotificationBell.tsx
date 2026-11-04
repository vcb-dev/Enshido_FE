import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import AssignmentIcon from '@mui/icons-material/Assignment'
import ConstructionIcon from '@mui/icons-material/Construction'
import WhatshotIcon from '@mui/icons-material/Whatshot'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import PanToolIcon from '@mui/icons-material/PanTool'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getUnreadNotificationCountApi,
  listNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  type AppNotification,
} from '../api/notifications'
import { enablePush, pushState, syncPush, type PushState } from './push'

const UNREAD_KEY = ['notifications', 'unread'] as const
const LIST_KEY = ['notifications', 'list'] as const
const PAGE_SIZE = 20

const ICONS: Record<string, ReactNode> = {
  INTAKE_PENDING: <AssignmentIcon />,
  INTAKE_APPROVED: <TaskAltIcon />,
  INTAKE_REJECTED: <ReportProblemOutlinedIcon />,
  MODEL3D_NEEDED: <ConstructionIcon />,
  WAX_INJECT_NEEDED: <ConstructionIcon />,
  WAX_TREE_NEEDED: <ConstructionIcon />,
  CASTING_SLIP_NEEDED: <WhatshotIcon />,
  CASTING_READY: <WhatshotIcon />,
  CASTING_SUBMITTED: <WhatshotIcon />,
  CASTING_REJECTED: <ReportProblemOutlinedIcon />,
  STAGE_WAITING: <PanToolIcon />,
  STAGE_HANDOVER_NEEDED: <AssignmentIcon />,
  STAGE_ASSIGNED: <PanToolIcon />,
  STAGE_SUBMITTED: <FactCheckIcon />,
  STAGE_CONFIRM_NEEDED: <FactCheckIcon />,
  TICKET_DEFECT: <ReportProblemOutlinedIcon />,
  ORDER_PLATED: <Inventory2Icon />,
  MATERIAL_REQUESTED: <Inventory2Icon />,
  MATERIAL_ISSUED: <TaskAltIcon />,
  MATERIAL_REJECTED: <ReportProblemOutlinedIcon />,
  SHIPMENT_PENDING: <LocalShippingIcon />,
  SHIPMENT_APPROVED: <LocalShippingIcon />,
}

/** "vừa xong", "5 phút trước", "3 giờ trước", quá 1 tuần thì ngày giờ cụ thể. */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function setAppBadge(count: number) {
  // Số trên biểu tượng app đã cài (Android / iOS / desktop có hỗ trợ). Không có thì thôi.
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  const call = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.()
  void call?.catch(() => undefined)
}

const PUSH_HINT: Partial<Record<PushState, ReactNode>> = {
  'needs-install': (
    <>
      Trên iPhone / iPad, thêm Enshido vào <b>màn hình chính</b> rồi mở từ đó mới nhận được
      thông báo khi đóng app.
    </>
  ),
  denied: (
    <>
      Thông báo ngoài app đang bị chặn — mở cài đặt trình duyệt / điện thoại, cho phép thông báo
      của Enshido.
    </>
  ),
}

/** Chuông thông báo trên thanh trên cùng: đếm chưa đọc, danh sách, bật thông báo ngoài app. */
export function NotificationBell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [push, setPush] = useState<PushState>(pushState)
  const [enabling, setEnabling] = useState(false)
  const lastCount = useRef<number | null>(null)

  const unread = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: getUnreadNotificationCountApi,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  })
  const count = unread.data?.unreadCount ?? 0

  const list = useInfiniteQuery({
    queryKey: LIST_KEY,
    queryFn: ({ pageParam }) => listNotificationsApi({ before: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.hasMore ? page.items[page.items.length - 1]?.createdAt : undefined,
    enabled: anchor != null,
    staleTime: 0,
  })
  const items = list.data?.pages.flatMap((page) => page.items) ?? []

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const open = (item: Pick<AppNotification, 'id' | 'url'>, wasUnread = true) => {
    setAnchor(null)
    if (wasUnread) {
      void markNotificationReadApi(item.id)
        .then((res) => queryClient.setQueryData(UNREAD_KEY, res))
        .catch(() => undefined)
        .finally(refresh)
    }
    if (item.url) navigate(item.url)
  }

  // Máy đã cho phép thì gắn lại endpoint vào người đang đăng nhập.
  useEffect(() => {
    void syncPush()
  }, [])

  useEffect(() => setAppBadge(count), [count])

  // Có thông báo mới mà máy chưa bật thông báo ngoài app: báo nhanh bằng toast trong app.
  useEffect(() => {
    if (unread.data == null) return
    const prev = lastCount.current
    lastCount.current = count
    if (prev == null || count <= prev || push === 'granted') return
    if (document.visibilityState !== 'visible') return
    void listNotificationsApi({ limit: 1 })
      .then(({ items: [latest] }) => {
        if (!latest || latest.readAt) return
        toast(latest.title, {
          description: latest.body ?? undefined,
          action: { label: 'Xem', onClick: () => open(latest) },
        })
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, unread.data])

  // Service worker: push vừa tới → làm mới chuông; bấm thông báo ngoài app → chuyển màn.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent<{ type?: string; id?: string; url?: string }>) => {
      if (event.data?.type === 'enshido-notification') refresh()
      if (event.data?.type === 'enshido-open') {
        if (event.data.id) open({ id: event.data.id, url: event.data.url ?? null })
        else if (event.data.url) navigate(event.data.url)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mở app từ thông báo khi app đang đóng: service worker gắn ?notification=<id>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('notification')
    if (!id) return
    params.delete('notification')
    const qs = params.toString()
    navigate(`${window.location.pathname}${qs ? `?${qs}` : ''}`, { replace: true })
    void markNotificationReadApi(id).catch(() => undefined).finally(refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onEnablePush() {
    setEnabling(true)
    try {
      const next = await enablePush()
      setPush(next)
      if (next === 'granted') toast.success('Đã bật thông báo trên máy này')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không bật được thông báo')
    } finally {
      setEnabling(false)
    }
  }

  async function onReadAll() {
    const res = await markAllNotificationsReadApi().catch(() => null)
    if (res) queryClient.setQueryData(UNREAD_KEY, res)
    refresh()
  }

  return (
    <>
      <Tooltip title="Thông báo">
        <IconButton
          color="primary"
          aria-label={count ? `Thông báo, ${count} chưa đọc` : 'Thông báo'}
          onClick={(event) => {
            setPush(pushState())
            setAnchor(event.currentTarget)
          }}
        >
          <Badge color="error" badgeContent={count} max={99}>
            {count ? <NotificationsActiveIcon /> : <NotificationsNoneIcon />}
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={anchor != null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxWidth: 'calc(100vw - 16px)',
              maxHeight: 'min(560px, calc(100vh - 80px))',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: 'center', px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 700 }}>
            Thông báo
          </Typography>
          <Button
            size="small"
            startIcon={<DoneAllIcon />}
            disabled={count === 0}
            onClick={() => void onReadAll()}
          >
            Đọc hết
          </Button>
        </Stack>

        {push === 'default' ? (
          <Alert
            severity="info"
            sx={{ m: 1.5, mb: 0.5 }}
            action={
              <Button color="inherit" size="small" loading={enabling} onClick={() => void onEnablePush()}>
                Bật
              </Button>
            }
          >
            Bật thông báo để nhận việc mới cả khi đã đóng app.
          </Alert>
        ) : PUSH_HINT[push] ? (
          <Alert severity="warning" sx={{ m: 1.5, mb: 0.5 }}>
            {PUSH_HINT[push]}
          </Alert>
        ) : null}

        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {list.isPending ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : list.isError ? (
            <Typography color="error" variant="body2" sx={{ p: 2 }}>
              Không tải được thông báo — kiểm tra kết nối rồi mở lại.
            </Typography>
          ) : items.length === 0 ? (
            <Typography color="text.secondary" variant="body2" sx={{ p: 3, textAlign: 'center' }}>
              Chưa có thông báo nào.
            </Typography>
          ) : (
            <List disablePadding>
              {items.map((item) => (
                <ListItemButton
                  key={item.id}
                  onClick={() => open(item, !item.readAt)}
                  sx={{
                    alignItems: 'flex-start',
                    gap: 0.5,
                    bgcolor: item.readAt ? undefined : 'action.hover',
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.5, color: item.readAt ? 'text.disabled' : 'primary.main' }}>
                    {ICONS[item.type] ?? <NotificationsNoneIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    secondary={
                      <>
                        {item.body ? (
                          <Box component="span" sx={{ display: 'block' }}>
                            {item.body}
                          </Box>
                        ) : null}
                        <Box component="span" sx={{ display: 'block', mt: 0.25, fontSize: '0.75rem' }}>
                          {timeAgo(item.createdAt)}
                        </Box>
                      </>
                    }
                    slotProps={{
                      primary: { variant: 'body2', sx: { fontWeight: item.readAt ? 400 : 600 } },
                      secondary: { variant: 'body2', component: 'span' },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
          {list.hasNextPage ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
              <Button size="small" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Xem thêm
              </Button>
            </Box>
          ) : null}
        </Box>
      </Popover>
    </>
  )
}
