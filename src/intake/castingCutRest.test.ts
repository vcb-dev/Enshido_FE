import { describe, expect, it } from 'vitest'
import { restFromBlanks } from './CastingSlipCutDialog'

describe('phần cây còn lại khi cắt cây thông', () => {
  it('= TL cây sau đúc − tổng TL phôi, làm tròn 4 số', () => {
    expect(restFromBlanks(1000, ['49.6973', '300.1', '450.2027'])).toBe(200)
    expect(restFromBlanks(97.5, ['40.12345', '50'])).toBe(7.3766)
  })

  it('chưa nhập đủ TL phôi thì chưa tính', () => {
    expect(restFromBlanks(1000, ['400', ''])).toBeNull()
    expect(restFromBlanks(1000, ['400', '0'])).toBeNull()
  })

  it('phôi vượt cây hoặc cây chưa có TL thì không tự điền', () => {
    expect(restFromBlanks(100, ['60', '50'])).toBeNull()
    expect(restFromBlanks(0, ['10'])).toBeNull()
  })

  it('phôi bằng đúng cây thì phần còn lại 0', () => {
    expect(restFromBlanks(100, ['60', '40'])).toBe(0)
  })
})
