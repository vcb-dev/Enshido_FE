import { describe, expect, it } from 'vitest'
import { caretInQtyFormat, formatQtyInput, gramReadout, parseQtyInput, pastedQtyText } from './inventory'

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

describe('hiển thị ô số lượng', () => {
  it('chia nhóm nghìn trên chuỗi, số dài không bị làm tròn', () => {
    expect(formatQtyInput('12345678901234567890')).toBe('12.345.678.901.234.567.890')
    expect(formatQtyInput('1250.5')).toBe('1.250,5')
    expect(formatQtyInput('007')).toBe('7')
    expect(formatQtyInput('0.')).toBe('0,')
  })
})

describe('con trỏ sau khi format', () => {
  it('giữ sau đúng chữ số vừa gõ khi thêm dấu chấm nghìn', () => {
    // 999 → chèn 1 sau số đầu → "9.199", con trỏ sau "9.1"
    expect(caretInQtyFormat('9.199', { intDigits: 2, decDigits: null })).toBe(3)
    expect(caretInQtyFormat('9.199', { intDigits: 0, decDigits: null })).toBe(0)
  })
  it('đang ở phần thập phân thì đếm sau dấu phẩy', () => {
    expect(caretInQtyFormat('1.250,75', { intDigits: 0, decDigits: 1 })).toBe(7)
    expect(caretInQtyFormat('0,5', { intDigits: 0, decDigits: 0 })).toBe(2)
  })
})
