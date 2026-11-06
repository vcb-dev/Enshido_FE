import { describe, expect, it } from 'vitest'
import { inPeriod, monthPeriod, periodMonth, shiftMonth, vnDayOf } from './warehousePeriod'

describe('warehousePeriod', () => {
  it('tháng → ngày đầu / cuối, kể cả tháng 2 năm nhuận', () => {
    expect(monthPeriod('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(monthPeriod('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('lùi / tới tháng qua năm', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('nhận ra kỳ trọn tháng', () => {
    expect(periodMonth({ from: '2026-11-01', to: '2026-11-30' })).toBe('2026-11')
    expect(periodMonth({ from: '2026-11-01', to: '2026-11-15' })).toBe('')
  })

  it('ngày nhập theo giờ Việt Nam', () => {
    // 18:00 UTC ngày 31/10 = 01:00 sáng 01/11 giờ VN.
    expect(vnDayOf('2026-10-31T18:00:00.000Z')).toBe('2026-11-01')
    // Phiếu cũ chỉ có ngày (nửa đêm UTC) vẫn giữ đúng ngày.
    expect(vnDayOf('2026-10-31T00:00:00.000Z')).toBe('2026-10-31')
    expect(vnDayOf('2026-10-31')).toBe('2026-10-31')
  })

  it('lọc trọn hai đầu kỳ', () => {
    const period = { from: '2026-10-01', to: '2026-10-31' }
    expect(inPeriod('2026-10-01', period)).toBe(true)
    expect(inPeriod('2026-10-31', period)).toBe(true)
    expect(inPeriod('2026-11-01', period)).toBe(false)
    expect(inPeriod('', period)).toBe(false)
  })
})
