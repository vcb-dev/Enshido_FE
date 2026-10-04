import { describe, expect, it } from 'vitest'
import { ctToGram, formatCt, gramToCt, isStoneMaterial } from './inventory'

describe('quy đổi TL đá g ↔ ct (1 ct = 0,2 g)', () => {
  it('g từ API ra ct để điền ô nhập', () => {
    expect(gramToCt('0.2')).toBe('1')
    expect(gramToCt('0.3')).toBe('1.5')
    expect(gramToCt('17.0000')).toBe('85')
    expect(gramToCt(null)).toBe('')
    expect(gramToCt('')).toBe('')
  })

  it('ct nhập vào ra g gửi API, giữ 4 số lẻ', () => {
    expect(ctToGram('1')).toBe('0.2')
    expect(ctToGram('1.25')).toBe('0.25')
    expect(ctToGram('0.001')).toBe('0.0002')
    expect(ctToGram('')).toBe('')
  })

  it('đi vòng g → ct → g không lệch', () => {
    for (const gram of ['0.0002', '0.1234', '12.5', '480']) {
      expect(Number(ctToGram(gramToCt(gram)))).toBe(Number(gram))
    }
  })

  it('hiện kèm đơn vị ct', () => {
    expect(formatCt('0.25')).toBe('1,25 ct')
    expect(formatCt(null)).toBe('—')
  })

  it('nhận diện đá theo loại hoặc đơn vị viên / ct', () => {
    expect(isStoneMaterial({ unit: 'gram', metalKind: 'STONE' })).toBe(true)
    expect(isStoneMaterial({ unit: 'viên', metalKind: 'SILVER' })).toBe(true)
    expect(isStoneMaterial({ unit: 'ct', metalKind: null })).toBe(true)
    expect(isStoneMaterial({ unit: 'gram', metalKind: 'SILVER' })).toBe(false)
    expect(isStoneMaterial({ unit: 'bảng', metalKind: 'SILVER' })).toBe(false)
  })
})
