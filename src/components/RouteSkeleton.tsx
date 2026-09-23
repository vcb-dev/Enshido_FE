import { Box, Paper, Skeleton, Stack } from '@mui/material'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isWorkerOnly } from '../auth/permissions'
import { TopProgressBar } from './ScreenLoadingBar'
import {
  CardsPageSkeleton,
  DashboardSkeleton,
  ListPageSkeleton,
  OrderDetailSkeleton,
  PageHeaderSkeleton,
  PrintSheetSkeleton,
  ShipmentDetailSkeleton,
  TabsSkeleton,
  CardGridSkeleton,
  TicketDetailSkeleton,
} from './ui/Skeletons'

/**
 * Khung chờ theo đường dẫn — dùng lúc tải mã của trang (lazy) và lúc kiểm tra phiên, khi
 * trang thật chưa dựng được. Chọn đúng bố cục của màn sắp mở để trang không nhảy khi hiện ra.
 */
export function RouteSkeleton() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  return (
    <>
      <TopProgressBar />
      <SkeletonFor pathname={pathname} workerOnly={isWorkerOnly(user)} />
    </>
  )
}

function SkeletonFor({ pathname, workerOnly }: { pathname: string; workerOnly: boolean }) {
  if (pathname === '/') return <DashboardSkeleton />
  if (pathname === '/orders') return <ListPageSkeleton tabs={2} subTabs={8} />
  // Thợ quét QR đơn mẹ vào bản chỉ-đọc, người quản lý vào màn đơn đầy đủ.
  if (/^\/orders\/[^/]+$/.test(pathname)) {
    return workerOnly ? <TicketDetailSkeleton maxWidth={820} /> : <OrderDetailSkeleton />
  }
  if (pathname.startsWith('/tickets/')) return <TicketDetailSkeleton />
  if (pathname === '/my-tickets') return <CardsPageSkeleton groups={2} count={2} media />
  if (pathname.startsWith('/finished-goods/shipments/')) return <ShipmentDetailSkeleton />
  if (pathname === '/settings/catalogs') {
    return (
      <Stack spacing={1.5}>
        <PageHeaderSkeleton actions={1} />
        <TabsSkeleton count={2} />
        <CardGridSkeleton count={6} />
      </Stack>
    )
  }
  if (/^\/warehouses\/[^/]+/.test(pathname)) return <ListPageSkeleton tabs={3} />
  return <ListPageSkeleton />
}

const DRAWER_WIDTH = 260

/**
 * Khung app lúc đang kiểm tra phiên đăng nhập: thanh trên, menu trái (từ `md`) và khung của
 * màn sắp mở — thay cho vòng xoay giữa màn hình trắng. Trang in không có khung app.
 */
export function AppBootSkeleton() {
  const { pathname } = useLocation()
  if (pathname.endsWith('/print')) return <PrintSheetSkeleton />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          height: 48,
          flexShrink: 0,
          px: 2,
          alignItems: 'center',
          bgcolor: 'background.paper',
          borderBottom: '1px solid #d5dbe0',
        }}
      >
        <Skeleton variant="text" sx={{ flex: 1, maxWidth: 220 }} />
        <Box sx={{ flex: 1 }} />
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton variant="rounded" width={88} height={30} sx={{ display: { xs: 'none', sm: 'block' } }} />
      </Stack>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Paper
          square
          sx={{
            display: { xs: 'none', md: 'block' },
            width: DRAWER_WIDTH,
            flexShrink: 0,
            border: 'none',
            borderRight: '1px solid #d5dbe0',
            p: 1,
          }}
        >
          <Stack sx={{ alignItems: 'center', py: 1.5 }}>
            <Skeleton variant="rounded" width={96} height={36} />
          </Stack>
          <Stack spacing={1} sx={{ px: 1, pt: 1 }}>
            {Array.from({ length: 7 }, (_, index) => (
              <Stack key={index} direction="row" spacing={1.5} sx={{ alignItems: 'center', height: 32 }}>
                <Skeleton variant="circular" width={20} height={20} />
                <Skeleton variant="text" width={index % 2 ? 110 : 140} />
              </Stack>
            ))}
          </Stack>
        </Paper>
        <Box sx={{ flex: 1, minWidth: 0, p: { xs: 1.5, md: 2 }, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <RouteSkeleton />
        </Box>
      </Box>
    </Box>
  )
}
