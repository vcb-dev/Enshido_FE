import { describe, expect, it } from 'vitest'
import { pathFromScan } from './qrScan'

describe('pathFromScan — thợ quét QR trên phiếu giấy', () => {
  it('QR phiếu con đưa thẳng tới phiếu đó', () => {
    expect(pathFromScan('https://enshido.vercel.app/tickets/A012-1')).toBe('/tickets/A012-1')
  })

  it('QR phiếu mẹ đã in có ?tab=production — bỏ query, giữ đường dẫn', () => {
    expect(pathFromScan('https://enshido.vercel.app/orders/A012?tab=production')).toBe(
      '/orders/A012',
    )
  })

  it('QR bản cũ /don-hang vẫn dùng được', () => {
    // Phiếu in từ trước khi đổi đường dẫn sang tiếng Anh vẫn còn ngoài xưởng.
    expect(pathFromScan('https://enshido.vercel.app/don-hang/A012')).toBe('/orders/A012')
  })

  it('quét được mỗi mã phiếu, không phải URL', () => {
    expect(pathFromScan('A012-2')).toBe('/tickets/A012-2')
    expect(pathFromScan('a012-2')).toBe('/tickets/A012-2')
    expect(pathFromScan('A012')).toBe('/orders/A012')
  })

  it('bỏ khoảng trắng thừa hai đầu', () => {
    expect(pathFromScan('  A012-1  ')).toBe('/tickets/A012-1')
  })

  it('trả null với mã không thuộc hệ thống — không điều hướng bừa', () => {
    expect(pathFromScan('https://google.com')).toBeNull()
    expect(pathFromScan('https://enshido.vercel.app/users')).toBeNull()
    expect(pathFromScan('xin chào')).toBeNull()
    expect(pathFromScan('')).toBeNull()
  })

  it('không nhận đường dẫn sâu hơn một cấp', () => {
    // /orders/A012/print là trang in, không phải đích của QR.
    expect(pathFromScan('https://enshido.vercel.app/orders/A012/print')).toBeNull()
    expect(pathFromScan('https://enshido.vercel.app/tickets/A012-1/abc')).toBeNull()
  })
})
