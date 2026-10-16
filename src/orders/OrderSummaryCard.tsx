import { useState } from 'react'
import {
  Box,
  Paper,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { getOrderSummaryApi, type OrderSummary } from '../api/productionOrders'
import { LIVE_REFRESH_MS, liveRefresh } from '../hooks/liveRefresh'

type Period = 'all' | 'today' | 'month' | 'lastMonth'

const PERIOD_LABEL: Record<Period, string> = {
  all: 'Tất cả',
  today: 'Hôm nay',
  month: 'Tháng này',
  lastMonth: 'Tháng trước',
}

/** Màu theo vai trò, giữ nguyên ở ô số, thanh tỉ lệ và biểu đồ cột (đã kiểm mù màu). */
const COLOR = {
  created: '#2a78d6',
  completed: '#1baf7a',
  inProgress: '#eb6834',
  stopped: '#a8a69f',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
}

/** Mốc lúc tạo đơn theo giờ máy: `from` tính cả, `to` không tính. */
function periodRange(period: Period): { from?: string; to?: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (period) {
    case 'today':
      return {
        from: new Date(y, m, now.getDate()).toISOString(),
        to: new Date(y, m, now.getDate() + 1).toISOString(),
      }
    case 'month':
      return { from: new Date(y, m, 1).toISOString(), to: new Date(y, m + 1, 1).toISOString() }
    case 'lastMonth':
      return { from: new Date(y, m - 1, 1).toISOString(), to: new Date(y, m, 1).toISOString() }
    default:
      return {}
  }
}

const fmt = (value: number) => value.toLocaleString('vi-VN')
const pct = (part: number, total: number) =>
  total ? `${Math.round((part / total) * 100).toLocaleString('vi-VN')}%` : '0%'

/** Báo cáo trên màn Tổng quan: số đơn đã tạo / hoàn thành / chưa hoàn thành, kèm biểu đồ. */
export function OrderSummaryCard() {
  const [period, setPeriod] = useState<Period>('all')
  const summary = useQuery({
    queryKey: ['production-orders', 'summary', period],
    queryFn: () => getOrderSummaryApi(periodRange(period)),
    ...liveRefresh(LIVE_REFRESH_MS.background),
  })
  const data = summary.data

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Báo cáo đơn hàng
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Theo ngày tạo đơn · không tính phiếu bù và hàng tồn đầu kỳ
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={period}
          onChange={(_, value: Period | null) => value && setPeriod(value)}
          sx={{ flexWrap: 'wrap' }}
        >
          {(Object.keys(PERIOD_LABEL) as Period[]).map((key) => (
            <ToggleButton key={key} value={key}>
              {PERIOD_LABEL[key]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {summary.isError ? (
        <Typography variant="body2" color="error">
          Không tải được báo cáo đơn hàng.
        </Typography>
      ) : (
        <Stack spacing={2.5}>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            }}
          >
            <StatTile color={COLOR.created} label="Đơn đã tạo" value={data?.created} />
            <StatTile
              color={COLOR.completed}
              label="Đã hoàn thành"
              value={data?.completed}
              note={data ? pct(data.completed, data.created) : undefined}
            />
            <StatTile
              color={COLOR.inProgress}
              label="Chưa hoàn thành"
              value={data?.inProgress}
              note={data ? pct(data.inProgress, data.created) : undefined}
            />
          </Box>
          {data ? (
            <>
              <CompositionBar data={data} />
              <TrendChart trend={data.trend} />
            </>
          ) : (
            <Skeleton variant="rounded" height={180} />
          )}
        </Stack>
      )}
    </Paper>
  )
}

function StatTile({
  color,
  label,
  value,
  note,
}: {
  color: string
  label: string
  value: number | undefined
  note?: string
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${color}`,
        borderRadius: 1,
        px: 1.5,
        py: 1.25,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {value === undefined ? <Skeleton width={64} /> : fmt(value)}
        </Typography>
        {note && (
          <Typography variant="body2" color="text.secondary">
            {note}
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="subtitle2" sx={{ mb: 1 }}>
      {children}
    </Typography>
  )
}

function Swatch({ color }: { color: string }) {
  return (
    <Box
      component="span"
      sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: color, flexShrink: 0 }}
    />
  )
}

/** Thanh tỉ lệ 100%: đơn đã tạo chia thành hoàn thành / chưa hoàn thành / dừng. */
function CompositionBar({ data }: { data: OrderSummary }) {
  const b = data.breakdown
  const parts = [
    {
      key: 'completed',
      label: 'Hoàn thành',
      value: data.completed,
      color: COLOR.completed,
      details: [
        { label: 'Đã giao', value: b.delivered },
        { label: 'Trong kho thành phẩm', value: b.finished },
      ],
    },
    {
      key: 'inProgress',
      label: 'Chưa hoàn thành',
      value: data.inProgress,
      color: COLOR.inProgress,
      details: [
        { label: 'Tạo đơn → đúc', value: b.preStage },
        { label: 'Đang ở khâu', value: b.inStage },
        { label: 'Chờ nhập kho', value: b.awaitingStock },
      ],
    },
    {
      key: 'stopped',
      label: 'Từ chối / lỗi',
      value: data.stopped,
      color: COLOR.stopped,
      details: [
        { label: 'Từ chối', value: b.rejected },
        { label: 'Sản xuất lỗi', value: b.defect },
      ],
    },
  ].filter((part) => part.key !== 'stopped' || part.value > 0)

  return (
    <Box>
      <SectionTitle>Tình trạng đơn đã tạo</SectionTitle>
      {data.created === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có đơn nào trong khoảng này.
        </Typography>
      ) : (
        <>
          <Stack
            direction="row"
            role="img"
            aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}
            sx={{ gap: '2px', height: 24 }}
          >
            {parts
              .filter((part) => part.value > 0)
              .map((part, i, shown) => (
                <Tooltip
                  key={part.key}
                  arrow
                  title={
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                        {part.label}: {fmt(part.value)} ({pct(part.value, data.created)})
                      </Typography>
                      {part.details.map((row) => (
                        <Typography key={row.label} variant="caption" sx={{ display: 'block' }}>
                          {row.label}: {fmt(row.value)}
                        </Typography>
                      ))}
                    </Box>
                  }
                >
                  <Box
                    sx={{
                      flex: `${part.value} 1 0`,
                      minWidth: 6,
                      bgcolor: part.color,
                      borderTopLeftRadius: i === 0 ? 4 : 0,
                      borderBottomLeftRadius: i === 0 ? 4 : 0,
                      borderTopRightRadius: i === shown.length - 1 ? 4 : 0,
                      borderBottomRightRadius: i === shown.length - 1 ? 4 : 0,
                      cursor: 'default',
                      '&:hover': { opacity: 0.85 },
                    }}
                  />
                </Tooltip>
              ))}
          </Stack>
          <Box
            sx={{
              mt: 1.25,
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', sm: `repeat(${parts.length}, minmax(0, 1fr))` },
            }}
          >
            {parts.map((part) => (
              <Box key={part.key} sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Swatch color={part.color} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {part.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {fmt(part.value)} · {pct(part.value, data.created)}
                  </Typography>
                </Stack>
                <Stack spacing={0.25} sx={{ mt: 0.5, pl: 2.25 }}>
                  {part.details.map((row) => (
                    <Stack
                      key={row.label}
                      direction="row"
                      sx={{ justifyContent: 'space-between', gap: 1 }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {row.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {fmt(row.value)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  )
}

/** Mốc trục y tròn (1, 2, 5 × 10ⁿ) để vạch lưới dễ đọc. */
function niceMax(value: number) {
  if (value <= 4) return 4
  const step = 10 ** Math.floor(Math.log10(value / 4))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * step * 4 >= value) return m * step * 4
  }
  return value
}

function bucketLabel(key: string, unit: 'day' | 'month') {
  if (unit === 'day') {
    const [, m, d] = key.split('-')
    return `${d}/${m}`
  }
  const [y, m] = key.split('-')
  return `${m}/${y.slice(2)}`
}

function bucketTitle(key: string, unit: 'day' | 'month') {
  if (unit === 'day') {
    const [y, m, d] = key.split('-')
    return `Ngày ${d}/${m}/${y}`
  }
  const [y, m] = key.split('-')
  return `Tháng ${Number(m)}/${y}`
}

const PLOT_HEIGHT = 160

/** Cột đôi theo ngày / tháng: đơn tạo mới và đơn hoàn thành. */
function TrendChart({ trend }: { trend: OrderSummary['trend'] }) {
  const { unit, buckets } = trend
  if (buckets.length < 2) return null
  const max = niceMax(Math.max(...buckets.map((b) => Math.max(b.created, b.completed))))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  // Nhãn trục x thưa để không chồng nhau: tối đa ~12 nhãn.
  const labelEvery = Math.ceil(buckets.length / 12)
  const series = [
    { key: 'created' as const, label: 'Tạo mới', color: COLOR.created },
    { key: 'completed' as const, label: 'Hoàn thành', color: COLOR.completed },
  ]

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ mb: 1, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
      >
        <Typography variant="subtitle2">
          Đơn tạo mới và hoàn thành theo {unit === 'day' ? 'ngày' : 'tháng'}
        </Typography>
        <Stack direction="row" spacing={1.5}>
          {series.map((s) => (
            <Stack key={s.key} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Swatch color={s.color} />
              <Typography variant="caption" color="text.secondary">
                {s.label}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>

      <Box sx={{ display: 'flex', gap: 1 }}>
        {/* Trục y */}
        <Box sx={{ position: 'relative', width: 28, height: PLOT_HEIGHT, flexShrink: 0 }}>
          {ticks.map((tick) => (
            <Typography
              key={tick}
              variant="caption"
              color="text.secondary"
              sx={{
                position: 'absolute',
                right: 0,
                bottom: `${(tick / max) * 100}%`,
                transform: 'translateY(50%)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmt(tick)}
            </Typography>
          ))}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ position: 'relative', height: PLOT_HEIGHT }}>
            {ticks.map((tick) => (
              <Box
                key={tick}
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: `${(tick / max) * 100}%`,
                  borderTop: `1px solid ${tick === 0 ? COLOR.axis : COLOR.grid}`,
                }}
              />
            ))}
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex' }}>
              {buckets.map((bucket) => (
                <Tooltip
                  key={bucket.key}
                  arrow
                  placement="top"
                  title={
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                        {bucketTitle(bucket.key, unit)}
                      </Typography>
                      {series.map((s) => (
                        <Stack key={s.key} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          <Swatch color={s.color} />
                          <Typography variant="caption">
                            {s.label}: {fmt(bucket[s.key])}
                          </Typography>
                        </Stack>
                      ))}
                    </Box>
                  }
                >
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      gap: '2px',
                      px: '12%',
                      '&:hover': { bgcolor: 'rgba(11,11,11,0.04)' },
                    }}
                  >
                    {series.map((s) => (
                      <Box
                        key={s.key}
                        sx={{
                          flex: 1,
                          maxWidth: 24,
                          height: `${(bucket[s.key] / max) * 100}%`,
                          minHeight: bucket[s.key] > 0 ? 2 : 0,
                          bgcolor: s.color,
                          borderRadius: '4px 4px 0 0',
                        }}
                      />
                    ))}
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Box>
          {/* Trục x */}
          <Box sx={{ display: 'flex', mt: 0.5 }}>
            {buckets.map((bucket, i) => (
              <Typography
                key={bucket.key}
                variant="caption"
                color="text.secondary"
                sx={{ flex: 1, minWidth: 0, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}
              >
                {i % labelEvery === 0 ? bucketLabel(bucket.key, unit) : ''}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
