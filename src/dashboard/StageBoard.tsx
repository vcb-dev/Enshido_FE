import { Box, Typography } from '@mui/material'
import { ChartLegend } from '../components/ui'
import type { ProductionOverview } from '../api/productionOrders'
import { fmt, OverviewCard, OVERVIEW_COLOR, SplitBar } from './overviewShared'

const SERIES = [
  { key: 'waiting', label: 'Chờ xử lý', color: OVERVIEW_COLOR.waiting },
  { key: 'working', label: 'Đang xử lý', color: OVERVIEW_COLOR.working },
]

/** Sản phẩm đang nằm ở từng công đoạn, chia chờ / đang làm. */
export function StageBoard({ stages }: { stages: ProductionOverview['stages'] }) {
  return (
    <OverviewCard
      title="Sản phẩm tại từng công đoạn"
      subtitle="Tồn tại thời điểm xem · Mỗi sản phẩm chỉ tính một lần"
      action={<ChartLegend series={SERIES} />}
    >
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
            lg: 'repeat(5, minmax(0, 1fr))',
          },
        }}
      >
        {stages.map((stage) => {
          const total = stage.waiting + stage.working
          return (
            <Box
              key={stage.key}
              sx={{
                minWidth: 0,
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                px: 1.5,
                py: 1.25,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {stage.label}
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  mt: 1,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: total ? 'text.primary' : 'text.disabled',
                }}
              >
                {fmt(total)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                sản phẩm
              </Typography>
              <Box sx={{ my: 1 }}>
                <SplitBar
                  parts={[
                    { value: stage.waiting, color: OVERVIEW_COLOR.waiting },
                    { value: stage.working, color: OVERVIEW_COLOR.working },
                  ]}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmt(stage.waiting)} chờ · {fmt(stage.working)} đang làm
              </Typography>
            </Box>
          )
        })}
      </Box>
    </OverviewCard>
  )
}
