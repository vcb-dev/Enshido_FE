import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cameraErrorMessage, pathFromScan } from './qrScan'
import { canAccessPath } from '../auth/homePath'
import { parseSubTicketCode } from '../api/productionOrders'
import { orderTicketUrl, subTicketUrl } from '../orders/catalog'

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

describe('cameraErrorMessage — Html5Qrcode báo lỗi bằng chuỗi', () => {
  it('bị từ chối quyền camera (Chrome và Safari)', () => {
    const msg = 'Chưa được phép dùng camera. Bật quyền camera cho trang này rồi thử lại.'
    expect(cameraErrorMessage('Error getting userMedia, error = NotAllowedError: Permission denied')).toBe(msg)
    expect(
      cameraErrorMessage(
        'Error getting userMedia, error = NotAllowedError: The request is not allowed by the user agent',
      ),
    ).toBe(msg)
  })

  it('trình duyệt không có camera API — Zalo/Messenger hoặc http', () => {
    expect(cameraErrorMessage('Camera streaming not supported by the browser.')).toMatch(/Chrome hoặc Safari/)
  })

  it('camera đang bị ứng dụng khác giữ', () => {
    expect(
      cameraErrorMessage('Error getting userMedia, error = NotReadableError: Could not start video source'),
    ).toMatch(/ứng dụng khác/)
  })

  it('lỗi lạ vẫn ra câu chung, không ném', () => {
    expect(cameraErrorMessage(undefined)).toBe('Không mở được camera trên thiết bị này.')
    expect(cameraErrorMessage(new Error('boom'))).toBe('Không mở được camera trên thiết bị này.')
  })
})

/**
 * Cả chuỗi thợ đi qua khi cầm tờ phiếu: QR in trên giấy → quét ra đường dẫn → quyền của
 * tài khoản → mã phiếu mà trang phiếu con dùng để gọi API. Ba mảnh này ở ba file khác
 * nhau nên dễ lệch, buộc chúng khớp nhau ở đây.
 */
describe('QR in ra rồi quét lại', () => {
  const ORIGIN = 'https://enshido.vercel.app'
  const worker = { roleCode: 'WORKER', permissions: ['production.worker'] }

  beforeAll(() => {
    // subTicketUrl/orderTicketUrl lấy window.location.origin; bộ test chạy môi trường node.
    globalThis.window = { location: { origin: ORIGIN } } as unknown as Window & typeof globalThis
  })
  afterAll(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('QR phiếu con → trang phiếu con, thợ vào được, tách đúng đơn và số phiếu', () => {
    const path = pathFromScan(subTicketUrl('A001-1'))

    expect(path).toBe('/tickets/A001-1')
    expect(canAccessPath(worker, path!)).toBe(true)
    expect(parseSubTicketCode('A001-1')).toEqual({ orderCode: 'A001', no: 1 })
  })

  it('QR phiếu mẹ → trang đơn tham khảo, thợ vẫn vào được', () => {
    const path = pathFromScan(orderTicketUrl('A001'))

    expect(path).toBe('/orders/A001')
    expect(canAccessPath(worker, path!)).toBe(true)
  })

  it('thợ quét phải phiếu ngoài quyền thì ScanQrButton chặn trước khi điều hướng', () => {
    // canAccessPath là đúng cái ScanQrButton hỏi; trang in không dành cho thợ.
    expect(canAccessPath(worker, '/orders/A001/print')).toBe(false)
  })
})
