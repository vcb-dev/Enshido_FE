import { Alert, Box, Paper, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material'
import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { can, canAny, isWorkerOnly, Permission } from '../auth/permissions'
import { getProductionOverviewApi, type ProductionOverview } from '../api/productionOrders'
import { PageHeader } from '../components/ui'
import { FinishedTrendChart } from '../dashboard/FinishedTrendChart'
import { LossReportPanel } from '../dashboard/LossReportPanel'
import { MaterialControlCard } from '../dashboard/MaterialControlCard'
import { OverviewKpis } from '../dashboard/OverviewKpis'
import { OverviewPeriodBar } from '../dashboard/OverviewPeriodBar'
import { defaultPeriod } from '../dashboard/overviewPeriod'
import { StageBoard } from '../dashboard/StageBoard'
import { WatchTicketsTable } from '../dashboard/WatchTicketsTable'
import { WorkerPerformancePanel } from '../dashboard/WorkerPerformancePanel'
import { LIVE_REFRESH_MS, liveRefresh } from '../hooks/liveRefresh'

type DashboardTab = 'overview' | 'workers' | 'loss'

const TAB_SUBTITLE: Record<DashboardTab, string> = {
  overview: 'Tiến độ · Công đoạn · Chất lượng · Vật tư',
  workers: 'Số đơn / sản phẩm mỗi thợ làm xong ở từng khâu',
  loss: 'Hao hụt bạc mỗi thợ ở từng khâu theo tuần',
}

export function DashboardPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const allowed = Boolean(user && can(user, Permission.SCREEN_DASHBOARD) && !isWorkerOnly(user))
  // Báo cáo hao hụt: chỉ thủ kho, kế toán, admin — QC không xem.
  const canSeeLoss = canAny(user, Permission.WAREHOUSE_KEEPER, Permission.ACCOUNTING_APPROVE)
  const tabParam = searchParams.get('tab')
  const tab: DashboardTab =
    tabParam === 'workers' ? 'workers' : tabParam === 'loss' && canSeeLoss ? 'loss' : 'overview'
  const [period, setPeriod] = useState(defaultPeriod)
  const overview = useQuery({
    queryKey: ['production-orders', 'overview', period.from, period.to, period.groupBy],
    queryFn: () => getProductionOverviewApi({ from: period.from, to: period.to, groupBy: period.groupBy }),
    enabled: allowed && tab === 'overview',
    placeholderData: keepPreviousData,
    ...liveRefresh(LIVE_REFRESH_MS.background),
  })
  const data = overview.data

  if (!allowed) {
    return (
      <Stack spacing={2}>
        <PageHeader title="Tổng quan" />
        <Typography variant="body2" color="text.secondary">
          Tài khoản chưa được cấp quyền xem báo cáo Tổng quan.
        </Typography>
      </Stack>
    )
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Tổng quan sản xuất"
        subtitle={TAB_SUBTITLE[tab]}
        actions={
          tab === 'overview' && data ? (
            <Paper variant="outlined" sx={{ px: 1.5, py: 0.75 }}>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                Cập nhật{' '}
                {new Date(data.generatedAt).toLocaleString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
            </Paper>
          ) : null
        }
      />
      <Tabs
        value={tab}
        onChange={(_, value: DashboardTab) =>
          setSearchParams(value === 'overview' ? {} : { tab: value }, { replace: true })
        }
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
      >
        <Tab value="overview" label="Tổng quan" sx={{ minHeight: 40 }} />
        <Tab value="workers" label="Hiệu suất thợ" sx={{ minHeight: 40 }} />
        {canSeeLoss ? <Tab value="loss" label="Hao hụt" sx={{ minHeight: 40 }} /> : null}
      </Tabs>

      {tab === 'workers' ? (
        <WorkerPerformancePanel />
      ) : tab === 'loss' ? (
        <LossReportPanel />
      ) : (
        <>
          <OverviewPeriodBar
            value={period}
            onChange={setPeriod}
            previous={
              data &&
              data.period.from === period.from &&
              data.period.to === period.to &&
              data.period.groupBy === period.groupBy
                ? { from: data.period.previousFrom, to: data.period.previousTo }
                : undefined
            }
          />
          {overview.isError ? (
            <Alert severity="error">Không tải được báo cáo Tổng quan: {overview.error.message}</Alert>
          ) : null}
          {data ? (
            <Stack spacing={2} sx={{ opacity: overview.isPlaceholderData ? 0.6 : 1 }}>
              <OverviewContent data={data} />
            </Stack>
          ) : overview.isError ? null : (
            <OverviewSkeleton />
          )}
        </>
      )}
    </Stack>
  )
}

function OverviewContent({ data }: { data: ProductionOverview }) {
  return (
    <>
      <OverviewKpis kpis={data.kpis} />
      <StageBoard stages={data.stages} />
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <FinishedTrendChart trend={data.trend} period={data.period} />
        <MaterialControlCard materials={data.materials} />
      </Box>
      <WatchTicketsTable data={data} />
    </>
  )
}

/** Khung chờ phần nội dung tab Tổng quan (tiêu đề và tab đã hiện sẵn). */
function OverviewSkeleton() {
  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={120} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={300} />
      <Skeleton variant="rounded" height={300} />
    </>
  )
}
