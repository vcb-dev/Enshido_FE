import { describe, expect, it } from 'vitest'
import { bucketLabel, changePercent, periodDays, presetPeriod, rangeLabel } from './overviewPeriod'

describe('kỳ xem màn Tổng quan', () => {
  const today = '2026-10-22' // thứ Năm

  it('các mốc chọn nhanh', () => {
    expect(presetPeriod('today', today)).toEqual({ from: today, to: today, groupBy: 'day' })
    expect(presetPeriod('last7', today)).toEqual({ from: '2026-10-16', to: today, groupBy: 'day' })
    expect(presetPeriod('thisWeek', today)).toEqual({ from: '2026-10-19', to: today, groupBy: 'day' })
    expect(presetPeriod('lastWeek', today)).toEqual({ from: '2026-10-12', to: '2026-10-18', groupBy: 'day' })
    expect(presetPeriod('thisMonth', today)).toEqual({ from: '2026-10-01', to: today, groupBy: 'day' })
    expect(presetPeriod('lastMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30', groupBy: 'day' })
    expect(presetPeriod('thisYear', today)).toEqual({ from: '2026-01-01', to: today, groupBy: 'month' })
    expect(presetPeriod('custom', today)).toBeNull()
  })

  it('số ngày và nhãn kỳ', () => {
    expect(periodDays('2026-10-16', today)).toBe(7)
    expect(rangeLabel(today, today)).toBe('22/10/2026')
    expect(rangeLabel('2026-10-16', today)).toBe('16/10 – 22/10/2026')
    expect(bucketLabel('2026-10-01', 'month')).toBe('T10/26')
  })

  it('so với kỳ trước', () => {
    expect(changePercent(120, 100)).toBe(20)
    expect(changePercent(50, 100)).toBe(-50)
    expect(changePercent(5, 0)).toBeNull()
  })
})
