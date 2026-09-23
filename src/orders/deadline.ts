import type { ProductionStatus } from '../api/productionOrders'

export type DeadlineWarning = {
  daysLeft: number
  label: string
  tone: 'overdue' | 'today' | 'soon'
}

const DAY_MS = 24 * 60 * 60 * 1000

function ymdToday() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function utcDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** Cảnh báo theo ngày lịch; đơn đã hoàn thiện / đã giao không còn tính trễ hạn sản xuất. */
export function deadlineWarning(
  dueDate: string | null | undefined,
  status: ProductionStatus,
  today = ymdToday(),
): DeadlineWarning | null {
  if (!dueDate || status === 'FINISHING' || status === 'DELIVERED') return null
  const due = utcDay(dueDate)
  const current = utcDay(today)
  if (due == null || current == null) return null
  const daysLeft = Math.round((due - current) / DAY_MS)
  if (daysLeft < 0) {
    const days = Math.abs(daysLeft)
    return { daysLeft, tone: 'overdue', label: `Quá hạn ${days} ngày` }
  }
  if (daysLeft === 0) return { daysLeft, tone: 'today', label: 'Đến hạn hôm nay' }
  if (daysLeft <= 3) return { daysLeft, tone: 'soon', label: `Còn ${daysLeft} ngày` }
  return null
}
