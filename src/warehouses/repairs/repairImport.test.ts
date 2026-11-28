import { describe, expect, it } from 'vitest'
import { parseRepairImport, REPAIR_IMPORT_HEADERS } from './repairImport'

describe('parseRepairImport — file Excel hàng gửi sửa', () => {
  it('file mẫu: đọc từng mã, SL trống = 1, bỏ dòng trống', () => {
    const result = parseRepairImport([
      [...REPAIR_IMPORT_HEADERS],
      ['NH01', 'Nhẫn bạc', '2', 'Sửa size 5'],
      [],
      ['', 'Lắc tay', '', ' Xi lại '],
    ])
    expect(result.errors).toEqual([])
    expect(result.lines).toEqual([
      { productCode: 'NH01', productName: 'Nhẫn bạc', qty: 2, content: 'Sửa size 5' },
      { productCode: '', productName: 'Lắc tay', qty: 1, content: 'Xi lại' },
    ])
  })

  it('tiêu đề gõ khác (không dấu, *, thứ tự khác) và có dòng tiêu đề phụ phía trên', () => {
    const result = parseRepairImport([
      ['DANH SÁCH HÀNG GỬI SỬA'],
      ['STT', 'Noi dung sua *', 'SL', 'Ma SP'],
      ['1', 'Gắn đá', '3', 'B-7'],
    ])
    expect(result.lines).toEqual([{ productCode: 'B-7', productName: '', qty: 3, content: 'Gắn đá' }])
  })

  it('dòng lỗi báo theo số dòng Excel và không lấy dòng nào', () => {
    const result = parseRepairImport([
      [...REPAIR_IMPORT_HEADERS],
      ['NH01', '', '2', 'Sửa size'],
      ['', '', '1', 'Xi'],
      ['NH02', '', '1,5', ''],
    ])
    expect(result.lines).toEqual([])
    expect(result.errors).toEqual([
      'Dòng 3: thiếu mã hoặc tên sản phẩm',
      'Dòng 4: số lượng phải là số nguyên lớn hơn 0, thiếu chi tiết sửa',
    ])
  })

  it('không có dòng tiêu đề / chỉ có tiêu đề → báo lỗi', () => {
    expect(parseRepairImport([['a', 'b']]).errors[0]).toMatch(/Không thấy dòng tiêu đề/)
    expect(parseRepairImport([[...REPAIR_IMPORT_HEADERS]]).errors).toEqual([
      'File chưa có mã sản phẩm nào dưới dòng tiêu đề',
    ])
  })
})
