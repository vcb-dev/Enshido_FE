import { describe, expect, it } from 'vitest'
import { castFailToast } from './castingSlipsCache'

describe('câu báo sau khi báo lỗi đúc', () => {
  it('lô SX SLL ghi lệnh bù, đơn thường ghi về Chờ SX · Đã có 3D', () => {
    expect(
      castFailToast([
        { orderCode: 'A121', intakeCode: 'DH104', qty: 100, reworkCode: 'A151' },
        { orderCode: 'A009', intakeCode: 'DH009', qty: 2, reworkCode: null },
      ]),
    ).toBe(
      'Đã báo lỗi đúc, cây hỏng nhập kho NVL — đi lại từ bước sáp: DH104 100 sp → lệnh bù A151; DH009 về Chờ SX · Đã có 3D.',
    )
  })

  it('máy chủ cũ không trả danh sách thì chỉ báo đã đi lại từ bước sáp', () => {
    expect(castFailToast(undefined)).toBe(
      'Đã báo lỗi đúc, cây hỏng nhập kho NVL — đi lại từ bước sáp.',
    )
  })
})
