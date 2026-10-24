import { ChartLegend, GroupedBarChart } from '../components/ui'
import type { ProductionOverview } from '../api/productionOrders'
import { bucketLabel, rangeLabel } from './overviewPeriod'
import { fmt, OverviewCard, OVERVIEW_COLOR } from './overviewShared'

const SERIES = [
  { key: 'actual', label: 'Thực tế', color: OVERVIEW_COLOR.actual },
  { key: 'plan', label: 'Kế hoạch', color: OVERVIEW_COLOR.plan },
  { key: 'previousActual', label: 'Kỳ trước', color: '#c9b79c' },
]

const GROUP_WORD = { day: 'ngày', week: 'tuần', month: 'tháng' } as const

/**
 * Thành phẩm kho nhận theo từng mốc của kỳ (ngày / tuần / tháng), so với kế hoạch (SL các lệnh hạn
 * giao trong mốc) và thực tế mốc cùng vị trí ở kỳ trước.
 */
export function FinishedTrendChart({
  trend,
  period,
}: {
  trend: ProductionOverview['trend']
  period: ProductionOverview['period']
}) {
  const buckets = trend.map((bucket) => ({
    key: bucket.key,
    label: bucketLabel(bucket.key, period.groupBy),
    title: [
      `${period.groupBy === 'day' ? 'Ngày' : period.groupBy === 'week' ? 'Tuần' : 'Tháng'} ${rangeLabel(bucket.start, bucket.end)}`,
      bucket.qcTotal ? `QC đạt lần đầu ${fmt(bucket.qcPassed)}/${fmt(bucket.qcTotal)}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    values: { actual: bucket.actual, plan: bucket.plan, previousActual: bucket.previousActual },
    caption: `${fmt(bucket.actual)} / ${fmt(bucket.plan)}`,
  }))
  return (
    <OverviewCard
      title="Thành phẩm nhập kho"
      subtitle={`${rangeLabel(period.from, period.to)} · theo ${GROUP_WORD[period.groupBy]} · Đơn vị: sản phẩm · Kế hoạch theo hạn giao đơn`}
      action={<ChartLegend series={SERIES} />}
    >
      <GroupedBarChart buckets={buckets} series={SERIES} height={180} />
    </OverviewCard>
  )
}
