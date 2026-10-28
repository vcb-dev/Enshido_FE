import { describe, expect, it } from 'vitest'
import { isReceiptStage, isSelfTakeStage, skipsStone, subTicketStateLabel, usesReceiptFlow } from './catalog'

describe('luồng thợ xác nhận', () => {
  it('bỏ Vào đá khi không khai TL đá ở 3D hoặc đơn đã được đánh dấu bỏ đá', () => {
    expect(skipsStone({ stoneCount: null, stoneWeight: null })).toBe(true)
    expect(skipsStone({ stoneCount: 0, stoneWeight: '0.0000' })).toBe(true)
    expect(skipsStone({ stoneCount: 10, stoneWeight: '2', stoneSkipped: true })).toBe(true)
    expect(skipsStone({ stoneCount: null, stoneWeight: '0.5' })).toBe(false)
    expect(skipsStone({ stoneCount: 10, stoneWeight: null })).toBe(false)
  })
  it.each(['FILING', 'STONE_SETTING', 'ENGRAVING', 'POLISHING', 'PLATING'])('%s: phiếu mẹ đã lưu giao và phiếu con dùng Xác nhận', (stage) => {
    expect(usesReceiptFlow(stage, null, true)).toBe(true)
    expect(usesReceiptFlow(stage, 1)).toBe(true)
    expect(subTicketStateLabel('CLAIMED', stage)).toBe('Chờ thợ nhận')
    expect(subTicketStateLabel('WORKING', stage)).toBe('Đang làm')
  })

  it.each(['FILING', 'STONE_SETTING', 'ENGRAVING'])('%s: phiếu mẹ nhận kiểu cũ chưa có nội dung giao thì chưa xác nhận được', (stage) => {
    expect(usesReceiptFlow(stage, null)).toBe(false)
    expect(usesReceiptFlow(stage, null, false)).toBe(false)
    expect(subTicketStateLabel('CLAIMED')).toBe('Thợ đã nhận')
  })

  it('chưa mở khâu nào thì không có gì để xác nhận', () => {
    expect(usesReceiptFlow(null, null, true)).toBe(false)
    expect(usesReceiptFlow(null, 1)).toBe(false)
  })

  it('chỉ Nguội / Vào đá chờ thủ kho xác nhận sau QC; Khắc / Đánh bóng / Xi thợ tự nhận', () => {
    expect(['FILING', 'STONE_SETTING', 'ENGRAVING', 'POLISHING', 'PLATING'].filter(isReceiptStage)).toEqual([
      'FILING',
      'STONE_SETTING',
    ])
    expect(['FILING', 'STONE_SETTING', 'ENGRAVING', 'POLISHING', 'PLATING', null].filter(isSelfTakeStage)).toEqual([
      'ENGRAVING',
      'POLISHING',
      'PLATING',
    ])
  })
})
