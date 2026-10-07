import { describe, expect, it } from 'vitest'
import { stoneAmountText, stoneQtyFromCt, stoneUnitKind } from './stoneInput'

describe('stoneUnitKind — cách nhập đá theo đơn vị của mã', () => {
  it('ct / g chỉ nhập TL, viên nhập cả số viên lẫn TL', () => {
    expect(stoneUnitKind('ct')).toBe('weight')
    expect(stoneUnitKind(' Gram ')).toBe('weight')
    expect(stoneUnitKind('viên')).toBe('count')
    expect(stoneUnitKind('Viên')).toBe('count')
    expect(stoneUnitKind('chiếc')).toBeNull()
    expect(stoneUnitKind(undefined)).toBeNull()
  })
})

describe('stoneQtyFromCt — số lượng suy từ TL ô nhập (ct)', () => {
  it('mã ct bằng chính TL, mã gram đổi ra g (1 ct = 0,2 g)', () => {
    expect(stoneQtyFromCt('ct', '5')).toBe('5')
    expect(stoneQtyFromCt('g', '5')).toBe('1')
  })
})

describe('stoneAmountText — số thợ xin hiển thị', () => {
  it('đá ct hiện TL, đá viên hiện số viên kèm TL', () => {
    expect(stoneAmountText({ qty: '10', weight: '2', unit: 'ct' })).toBe('10 ct')
    expect(stoneAmountText({ qty: '20', weight: '1', unit: 'viên' })).toBe('20 viên · 5 ct')
  })

  it('không có TL (yêu cầu cũ / bạc, BTP) hiện số lượng như trước', () => {
    expect(stoneAmountText({ qty: '20', weight: null, unit: 'viên' })).toBe('20 viên')
    expect(stoneAmountText({ qty: '6.6667', weight: null, unit: 'g' })).toBe('6,6667 g')
  })
})
