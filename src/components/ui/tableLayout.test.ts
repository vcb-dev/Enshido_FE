import { describe, expect, it } from 'vitest'
import { fixedLayoutMinWidth } from './tableLayout'

describe('fixedLayoutMinWidth — bảng cột cố định không bị bóp đè chữ', () => {
  const columns = [{ width: 110 }, { width: 190 }, {}, { width: '20%' }, { width: 300 }]

  it('không hẹp hơn tổng width, cột không khai width tính chỗ tối thiểu', () => {
    // 110 + 190 + 140 + 140 + 300 + cột đầu 44
    expect(fixedLayoutMinWidth(columns, 44, 900)).toBe(924)
    expect(fixedLayoutMinWidth(columns, 0, undefined)).toBe(880)
  })

  it('minWidth khai lớn hơn thì giữ minWidth', () => {
    expect(fixedLayoutMinWidth(columns, 0, 1730)).toBe(1730)
    expect(fixedLayoutMinWidth(columns, 0, '100%')).toBe('max(100%, 880px)')
  })
})
