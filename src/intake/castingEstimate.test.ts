import { describe, expect, it } from 'vitest'
import { goldEstimateFromWax, goldKaratFromLabel, silverEstimateFromWax } from './castingEstimate'

describe('ước tính bạc cho phiếu đúc', () => {
  it('nửa tổng là S925, nửa còn lại chia thành S999 và hội pha', () => {
    const estimate = silverEstimateFromWax(10)
    expect(estimate.total).toBe(140)
    expect(estimate.s925).toBe(70)
    expect(estimate.s999).toBe(64.75)
    expect(estimate.masterAlloy).toBe(5.25)
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

describe('ước tính vàng theo K của mã NVL', () => {
  it('đọc đúng 10k / 14k / 18k / 24k', () => {
    expect(goldKaratFromLabel('vang-10k')).toBe('10')
    expect(goldKaratFromLabel('Vàng 14K')).toBe('14')
    expect(goldKaratFromLabel('A001 · Vàng nguyên liệu 18k')).toBe('18')
    expect(goldKaratFromLabel('vang_24k')).toBe('24')
  })

  it('tên lẫn nhiều K thì không đoán', () => {
    expect(goldKaratFromLabel('Hội vàng 10k/14K')).toBeNull()
  })

  it('sáp × hệ số theo K', () => {
    expect(goldEstimateFromWax(4, '10')).toBe(44)
    expect(goldEstimateFromWax(4, '14')).toBe(52)
    expect(goldEstimateFromWax(4, '18')).toBe(64)
    expect(goldEstimateFromWax(4, '24')).toBe(72)
    expect(goldEstimateFromWax(4, null)).toBe(0)
  })
})
