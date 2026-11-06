import { useSyncExternalStore } from 'react'

/** Kỳ xem kho theo ngày Việt Nam, cả hai đầu tính trọn ngày (YYYY-MM-DD). */
export type WarehousePeriod = { from: string; to: string }

const STORAGE_KEY = 'enshido.warehouse-period'
const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Ngày (YYYY-MM-DD) theo giờ Việt Nam của một mốc ISO; chuỗi chỉ có ngày thì giữ nguyên. */
export function vnDayOf(value: string | null | undefined) {
  if (!value) return ''
  if (!value.includes('T')) return value.slice(0, 10)
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return value.slice(0, 10)
  return new Date(time + VN_OFFSET_MS).toISOString().slice(0, 10)
}

export function vnToday() {
  return vnDayOf(new Date().toISOString())
}

/** Tháng YYYY-MM → ngày đầu / cuối tháng. */
export function monthPeriod(month: string): WarehousePeriod {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

/** Kỳ đúng trọn một tháng thì trả về tháng đó (để ô Tháng hiện đúng), không thì ''. */
export function periodMonth(period: WarehousePeriod) {
  const month = period.from.slice(0, 7)
  const full = monthPeriod(month)
  return full.from === period.from && full.to === period.to ? month : ''
}

export function currentMonthPeriod() {
  return monthPeriod(vnToday().slice(0, 7))
}

export function inPeriod(day: string, period: WarehousePeriod) {
  return Boolean(day) && day >= period.from && day <= period.to
}

export function isValidPeriod(period: WarehousePeriod) {
  return YMD.test(period.from) && YMD.test(period.to) && period.from <= period.to
}

function readStored(): WarehousePeriod | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WarehousePeriod>
    const period = { from: String(parsed.from ?? ''), to: String(parsed.to ?? '') }
    return isValidPeriod(period) ? period : null
  } catch {
    return null
  }
}

// Kỳ dùng chung cho mọi kho và các mục Tồn / Nhập / Xuất — đổi tab vẫn giữ kỳ đang xem.
// Lưu theo phiên trình duyệt: mở lại trang mới thì về tháng hiện tại.
let current: WarehousePeriod = readStored() ?? currentMonthPeriod()
const listeners = new Set<() => void>()

export function setWarehousePeriod(next: WarehousePeriod) {
  if (!isValidPeriod(next)) return
  if (next.from === current.from && next.to === current.to) return
  current = next
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Trình duyệt chặn lưu — vẫn đổi kỳ trong phiên đang mở.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getWarehousePeriod() {
  return current
}

export function useWarehousePeriod() {
  return useSyncExternalStore(subscribe, () => current)
}
