import { describe, expect, it } from 'vitest'
import { invoiceComplete, missingInvoiceFields } from './invoice'

const full = { weightGram: '14.06', materialUnitPrice: '20', laborAmount: '20', stoneAmount: '20', otherAmount: '0' }

describe('missingInvoiceFields', () => {
  it('"0" là đã nhập, không tính là thiếu', () => {
    expect(missingInvoiceFields(full)).toEqual([])
    expect(invoiceComplete(full)).toBe(true)
  })

  it('chỉ ra đúng khoản còn trống, theo thứ tự cột', () => {
    expect(missingInvoiceFields({ ...full, stoneAmount: '', weightGram: '' })).toEqual(['weightGram', 'stoneAmount'])
    expect(invoiceComplete({ ...full, laborAmount: '' })).toBe(false)
  })

  it('chi phí khác để trống không tính là thiếu', () => {
    expect(missingInvoiceFields({ ...full, otherAmount: '' })).toEqual([])
    expect(invoiceComplete({ ...full, otherAmount: '' })).toBe(true)
  })
})
