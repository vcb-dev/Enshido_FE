import { describe, expect, it } from 'vitest'
import { gramReadout, parseQtyInput, pastedQtyText } from './inventory'

describe('dán số vào ô gram', () => {
  it('một dấu chấm, không phẩy → chấm là thập phân', () => {
    expect(parseQtyInput(pastedQtyText('12.5'))).toBe('12.5')
    expect(parseQtyInput(pastedQtyText('100.000'))).toBe('100.000')
    expect(Number(parseQtyInput(pastedQtyText('100.000')))).toBe(100)
  })
  it('có dấu phẩy thì giữ kiểu vi-VN', () => {
    expect(parseQtyInput(pastedQtyText('1.250,5'))).toBe('1250.5')
    expect(parseQtyInput(pastedQtyText('12,5'))).toBe('12.5')
  })
  it('nhiều dấu chấm là ngăn nghìn', () => {
    expect(parseQtyInput(pastedQtyText('1.250.000'))).toBe('1250000')
  })
  it('bỏ khoảng trắng', () => {
    expect(parseQtyInput(pastedQtyText(' 9 899 '))).toBe('9899')
  })
})

describe('đọc lại số gram', () => {
  it('dưới 1.000 g không cần quy đổi', () => {
    expect(gramReadout('999.5')).toBe('')
    expect(gramReadout('')).toBe('')
  })
  it('từ 1.000 g kèm kg', () => {
    expect(gramReadout('100000')).toContain('100 kg')
  })
})
