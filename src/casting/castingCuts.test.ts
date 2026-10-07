import { describe, expect, it } from 'vitest'
import type { CastingSlip } from '../api/castingSlips'
import { canCutCastingSlip, getCastingSlipCutBlockedReason, hasCastingSlipCutData, slipJourneyStatuses } from './castingCuts'

function slip(overrides: Partial<CastingSlip> = {}): CastingSlip {
  return {
    status: 'DONE', restWeightGram: null, castTreeWeightGram: '89999',
    orders: [{ code: 'DH001', status: 'CAST_DONE', productionOrderCode: null }],
    ...overrides,
  } as CastingSlip
}

describe('điều kiện cắt cây của phiếu cũ', () => {
  it('cho chọn phiếu đúc xong chưa cắt', () => {
    expect(canCutCastingSlip(slip())).toBe(true)
    expect(hasCastingSlipCutData(slip())).toBe(false)
  })

  it('nhận diện phôi cũ dù thiếu trọng lượng cây còn lại và liên kết lệnh sản xuất', () => {
    const legacy = slip({ orders: [{ ...slip().orders[0], status: 'WAIT_COOLING',
      blankQty: 1000, blankWeightGram: '70000' }] })
    expect(hasCastingSlipCutData(legacy)).toBe(true)
    expect(canCutCastingSlip(legacy)).toBe(false)
    expect(getCastingSlipCutBlockedReason(legacy)).toBe('Phiếu đã cắt cây, không thể cắt lại.')
  })

  it('nhận diện phần cây còn lại bằng 0 là đã cắt', () => {
    expect(hasCastingSlipCutData(slip({ restWeightGram: '0' }))).toBe(true)
    expect(canCutCastingSlip(slip({ restWeightGram: '0' }))).toBe(false)
  })

  it('không suy ra đã cắt chỉ từ trạng thái đơn chuyển bước', () => {
    const moved = slip({ orders: [{ ...slip().orders[0], status: 'WAIT_COOLING' }] })
    expect(hasCastingSlipCutData(moved)).toBe(false)
    expect(canCutCastingSlip(moved)).toBe(false)
    expect(getCastingSlipCutBlockedReason(moved)).toMatch(/đã chuyển bước/)
  })

  it('sau cắt hiện lộ trình từ Chờ nguội, không giữ Đúc xong', () => {
    const cut = slip({
      restWeightGram: '100',
      orders: [
        { ...slip().orders[0], status: 'WAIT_COOLING', orderStatus: 'WAIT_FILING', productionOrderCode: 'A001' },
        { ...slip().orders[0], code: 'DH002', status: 'WAIT_COOLING', orderStatus: 'FILING', productionOrderCode: 'A002' },
      ],
    })
    expect(slipJourneyStatuses(cut)).toEqual(['WAIT_FILING', 'FILING'])
  })
})
