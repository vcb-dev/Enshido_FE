import { describe, expect, it } from 'vitest'
import { caretAfterMoneyFormat, formatMoneyInput, moneyDigitsFromInput } from './inventory'

describe('formatMoneyInput — không nhảy số lúc gõ', () => {
  it('thêm chấm nghìn mà không đi qua Number', () => {
    expect(formatMoneyInput('1000')).toBe('1.000')
    expect(formatMoneyInput('1000000')).toBe('1.000.000')
    expect(formatMoneyInput('1.000')).toBe('1.000')
  })

  it('Number("1.000") = 1 nhưng ô nhập vẫn giữ một nghìn', () => {
    expect(Number('1.000')).toBe(1)
    expect(formatMoneyInput('1.000')).toBe('1.000')
    expect(moneyDigitsFromInput('1.000')).toBe('1000')
  })

  it('ô trống và 0', () => {
    expect(formatMoneyInput('')).toBe('')
    expect(formatMoneyInput('0')).toBe('0')
  })
})

describe('caretAfterMoneyFormat', () => {
  it('gõ thêm số ở cuối 1000 → 1.000 thì caret sau chữ số cuối', () => {
    expect(caretAfterMoneyFormat('1.000', 4)).toBe(5)
  })

  it('chèn giữa 1|000 thành 12.000 thì caret sau chữ 2', () => {
    expect(caretAfterMoneyFormat('12.000', 2)).toBe(2)
  })
})
