import { ChartLegend, GroupedBarChart } from '../components/ui'
import type { ProductionOverview } from '../api/productionOrders'
import { dayLabel, fmt, OverviewCard, OVERVIEW_COLOR } from './overviewShared'

const SERIES = [
  { key: 'actual', label: 'Thực tế', color: OVERVIEW_COLOR.actual },
  { key: 'plan', label: 'Kế hoạch', color: OVERVIEW_COLOR.plan },
]

/** Thành phẩm kho nhận 7 ngày gần nhất, so với kế hoạch (SL các lệnh hạn giao ngày đó). */
export function FinishedTrendChart({ trend }: { trend: ProductionOverview['finishedTrend'] }) {
  const buckets = trend.map((day) => {
    const [y, m, d] = day.date.split('-')
    return {
      key: day.date,
      label: dayLabel(day.date),
      title: `Ngày ${d}/${m}/${y}`,
      values: { actual: day.actual, plan: day.plan },
      caption: `${fmt(day.actual)} / ${fmt(day.plan)}`,
    }
  })
  return (
    <OverviewCard
      title="Thành phẩm nhập kho"
      subtitle="7 ngày gần nhất · Đơn vị: sản phẩm · Kế hoạch theo hạn giao đơn"
      action={<ChartLegend series={SERIES} />}
    >
      <GroupedBarChart buckets={buckets} series={SERIES} height={180} />
    </OverviewCard>
  )
}
