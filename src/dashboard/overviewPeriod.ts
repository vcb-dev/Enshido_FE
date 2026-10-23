import type { OverviewGroup } from '../api/productionOrders'
import { addDays, todayKey, weekStart } from './lossReport'

export type PeriodPreset =
  | 'today'
  | 'last7'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last30'
  | 'last90'
  | 'thisYear'
  | 'custom'

export type OverviewPeriod = { preset: PeriodPreset; from: string; to: string; groupBy: OverviewGroup }

export const PRESET_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'last7', label: '7 ngày gần nhất' },
  { value: 'thisWeek', label: 'Tuần này' },
  { value: 'lastWeek', label: 'Tuần trước' },
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
  { value: 'last30', label: '30 ngày gần nhất' },
  { value: 'last90', label: '90 ngày gần nhất' },
  { value: 'thisYear', label: 'Năm nay' },
  { value: 'custom', label: 'Tuỳ chọn' },
]

export const GROUP_OPTIONS: { value: OverviewGroup; label: string }[] = [
  { value: 'day', label: 'Ngày' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
]

/** Xem theo ngày tối đa ngần này ngày (khớp giới hạn mốc của server). */
export const MAX_DAY_BUCKETS = 92

function monthStart(key: string) {
  return `${key.slice(0, 8)}01`
}

/** Kỳ của một mốc chọn nhanh, kèm đơn vị gom số hợp lý. `custom` giữ nguyên kỳ đang có. */
export function presetPeriod(preset: PeriodPreset, today = todayKey()): Omit<OverviewPeriod, 'preset'> | null {
  switch (preset) {
    case 'today':
      return { from: today, to: today, groupBy: 'day' }
    case 'last7':
      return { from: addDays(today, -6), to: today, groupBy: 'day' }
    case 'thisWeek':
      return { from: weekStart(today), to: today, groupBy: 'day' }
    case 'lastWeek': {
      const start = addDays(weekStart(today), -7)
      return { from: start, to: addDays(start, 6), groupBy: 'day' }
    }
    case 'thisMonth':
      return { from: monthStart(today), to: today, groupBy: 'day' }
    case 'lastMonth': {
      const end = addDays(monthStart(today), -1)
      return { from: monthStart(end), to: end, groupBy: 'day' }
    }
    case 'last30':
      return { from: addDays(today, -29), to: today, groupBy: 'day' }
    case 'last90':
      return { from: addDays(today, -89), to: today, groupBy: 'week' }
    case 'thisYear':
      return { from: `${today.slice(0, 4)}-01-01`, to: today, groupBy: 'month' }
    case 'custom':
      return null
  }
}

export function defaultPeriod(): OverviewPeriod {
  return { preset: 'last7', ...presetPeriod('last7')! }
}

/** Số ngày trong kỳ, tính cả hai đầu. */
export function periodDays(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
}

/** "16/10/2026" */
export function dateLabel(key: string) {
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

/** "16/10 – 22/10/2026" hoặc một ngày. */
export function rangeLabel(from: string, to: string) {
  if (from === to) return dateLabel(from)
  const [y, m, d] = from.split('-')
  const [ty, tm, td] = to.split('-')
  return y === ty ? `${d}/${m} – ${td}/${tm}/${ty}` : `${d}/${m}/${y} – ${td}/${tm}/${ty}`
}

/** Nhãn ngắn dưới trục x của một mốc. */
export function bucketLabel(key: string, groupBy: OverviewGroup) {
  const [y, m, d] = key.split('-')
  if (groupBy === 'month') return `T${Number(m)}/${y.slice(2)}`
  if (groupBy === 'week') return `${Number(d)}/${Number(m)}`
  return `${Number(d)}/${Number(m)}`
}

/** Thay đổi so với kỳ trước, % làm tròn; kỳ trước 0 thì không so được. */
export function changePercent(current: number, previous: number) {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}
