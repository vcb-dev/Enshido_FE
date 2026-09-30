import { describe, expect, it } from 'vitest'
import { ratioWarning } from './weightSanity'

const silverVsWax = { min: 1, max: 100 }

describe('kiểm tra chéo số gram', () => {
  it('bạc gấp ~11 lần sáp là bình thường', () => {
    expect(ratioWarning(110, 'Tổng giao', 9.899, 'sáp giao', silverVsWax)).toBeNull()
  })
  it('nhầm dấu chấm làm lệch 1.000 lần thì cảnh báo', () => {
    expect(ratioWarning(110000, 'Tổng giao', 9.899, 'sáp giao', silverVsWax)).toContain('gấp')
    expect(ratioWarning(0.11, 'Tổng giao', 9.899, 'sáp giao', silverVsWax)).toContain('chỉ bằng')
  })
  it('thiếu một trong hai số thì bỏ qua', () => {
    expect(ratioWarning(110, 'Tổng giao', 0, 'sáp giao', silverVsWax)).toBeNull()
  })
  it('hao hụt trên 50% thì cảnh báo', () => {
    expect(ratioWarning(40, 'Cây', 100, 'bạc đã dùng', { min: 0.5, max: 1 })).not.toBeNull()
    expect(ratioWarning(98, 'Cây', 100, 'bạc đã dùng', { min: 0.5, max: 1 })).toBeNull()
  })
})
