import { describe, expect, it } from 'vitest'
import { isCompleteDate } from './DateField'

describe('isCompleteDate', () => {
  it('nhận ngày đủ', () => {
    expect(isCompleteDate('2026-11-12')).toBe(true)
  })

  it('bỏ qua năm đang gõ dở và chuỗi trống', () => {
    for (const value of ['0002-11-15', '0020-11-15', '0202-11-15', '', '2026-11']) {
      expect(isCompleteDate(value)).toBe(false)
    }
  })
})
