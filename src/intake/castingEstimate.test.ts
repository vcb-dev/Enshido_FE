import { describe, expect, it } from 'vitest'
import { silverEstimateFromWax } from './castingEstimate'

describe('ước tính bạc cho phiếu đúc', () => {
  it('nửa tổng là S925, nửa còn lại chia thành S999 và hội pha', () => {
    const estimate = silverEstimateFromWax(10)
    expect(estimate.total).toBe(240)
    expect(estimate.s925).toBe(120)
    expect(estimate.s999).toBe(111)
    expect(estimate.masterAlloy).toBe(9)
  })

  it('ba dòng cộng lại đúng bằng tổng', () => {
    const estimate = silverEstimateFromWax('3.7')
    expect(estimate.s999 + estimate.masterAlloy + estimate.s925).toBeCloseTo(
      estimate.total,
      4,
    )
  })

  it('chưa có trọng lượng sáp thì để 0', () => {
    expect(silverEstimateFromWax(0).total).toBe(0)
    expect(silverEstimateFromWax(null).s999).toBe(0)
    expect(silverEstimateFromWax('').s925).toBe(0)
  })
})
