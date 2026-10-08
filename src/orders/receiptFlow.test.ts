import { describe, expect, it } from 'vitest'
import { isReceiptStage, skipsStone, subTicketStateLabel, usesReceiptFlow } from './catalog'

describe('luồng thợ xác nhận', () => {
  it('bỏ Vào đá khi số đá bằng 0 hoặc thủ kho đã đánh dấu bỏ đá', () => {
    expect(skipsStone({ stoneCount: 0 })).toBe(true)
    expect(skipsStone({ stoneCount: 10, stoneSkipped: true })).toBe(true)
    expect(skipsStone({ stoneCount: null })).toBe(false)
    expect(skipsStone({ stoneCount: 10 })).toBe(false)
  })
  it.each(['FILING', 'STONE_SETTING'])('%s: phiếu mẹ đã lưu giao và phiếu con dùng Xác nhận', (stage) => {
    expect(usesReceiptFlow(stage, null, true)).toBe(true)
    expect(usesReceiptFlow(stage, 1)).toBe(true)
    expect(subTicketStateLabel('CLAIMED', stage)).toBe('Chờ thợ nhận')
    expect(subTicketStateLabel('WORKING', stage)).toBe('Đang làm')
  })

  it.each(['FILING', 'STONE_SETTING'])('%s: phiếu mẹ cũ vẫn chờ người giao xác nhận', (stage) => {
    expect(usesReceiptFlow(stage, null)).toBe(false)
    expect(usesReceiptFlow(stage, null, false)).toBe(false)
    expect(subTicketStateLabel('CLAIMED')).toBe('Thợ đã nhận')
  })

  it.each(['ENGRAVING', 'POLISHING', 'PLATING', null])('%s: giữ luồng nhận phiếu rồi xác nhận giao', (stage) => {
    expect(isReceiptStage(stage)).toBe(false)
    expect(usesReceiptFlow(stage, null, true)).toBe(false)
    expect(usesReceiptFlow(stage, 1)).toBe(false)
  })
})
