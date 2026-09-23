import { describe, expect, it } from 'vitest'
import { capAt, lossOf } from './StageDialogs'

describe('capAt — KCS không nhập quá số đã giao', () => {
  it('cắt số lượng vượt về đúng số giao', () => {
    expect(capAt(200)('203')).toBe('200')
  })

  it('cắt trọng lượng vượt về đúng TL giao', () => {
    expect(capAt(1900)('20000')).toBe('1900')
  })

  it('giữ nguyên số trong mức và ô trống', () => {
    expect(capAt(200)('190')).toBe('190')
    expect(capAt(200)('')).toBe('')
  })

  it('khâu cũ chưa ghi số giao thì không chặn', () => {
    expect(capAt(null)('99999')).toBe('99999')
  })
})

describe('lossOf — hao tổn theo số lượng và khối lượng', () => {
  it('thiếu 10/200 sp là 5%', () => {
    expect(lossOf(200, 190)).toEqual({ value: 10, percent: 5 })
  })

  it('bạc về đủ thì hao hụt 0', () => {
    expect(lossOf(1900, 1900)).toEqual({ value: 0, percent: 0 })
  })

  it('bạc thu hồi được tính vào phần trả lại', () => {
    // giao 2.000, nhận lại 1.880 + thu hồi 100 → hao hụt 20 g (1%)
    expect(lossOf(2000, 1880 + 100)).toEqual({ value: 20, percent: 1 })
  })

  it('khâu Vào đá: đá cộng vào vế giao, % vẫn tính trên bạc giao', () => {
    // giao 2.000 g bạc, gắn 80 g đá, cân cả cụm 2.060 g → hao 20 g = 1% của bạc giao
    expect(lossOf(2000 + 80, 2060, 2000)).toEqual({ value: 20, percent: 1 })
  })
})
