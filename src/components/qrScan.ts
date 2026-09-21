/**
 * Mã QR trên phiếu giấy là URL tuyệt đối — tách ra đường dẫn trong app.
 * Tách khỏi QrScannerDialog để test được mà không phải dựng camera.
 */
export function pathFromScan(text: string): string | null {
  const raw = text.trim()
  let path = raw
  try {
    path = new URL(raw).pathname
  } catch {
    // Không phải URL đầy đủ: có thể thợ quét được mỗi mã phiếu, vd "A012-1".
    if (/^[A-Za-z]\d+-\d+$/.test(raw)) return `/tickets/${raw.toUpperCase()}`
    if (/^[A-Za-z]\d+$/.test(raw)) return `/orders/${raw.toUpperCase()}`
  }
  if (/^\/tickets\/[^/]+$/.test(path)) return path
  // QR trên phiếu mẹ đã in trỏ /orders/:code (kèm ?tab=production) và bản cũ /don-hang/:code.
  const order = /^\/(?:orders|don-hang)\/([^/]+)$/.exec(path)
  if (order) return `/orders/${order[1]}`
  return null
}

/**
 * Html5Qrcode báo lỗi bằng chuỗi ("Error getting userMedia, error = NotAllowedError: …"),
 * không phải Error — dò tên lỗi trong chuỗi để nói cho thợ biết phải làm gì.
 */
export function cameraErrorMessage(err: unknown): string {
  const text = String(err)
  if (/NotAllowedError|Permission/i.test(text)) {
    return 'Chưa được phép dùng camera. Bật quyền camera cho trang này rồi thử lại.'
  }
  // Không có navigator.mediaDevices: trình duyệt nhúng trong Zalo/Messenger, hoặc trang http.
  if (/not supported/i.test(text)) {
    return 'Trình duyệt này không mở được camera. Mở trang bằng Chrome hoặc Safari rồi thử lại.'
  }
  if (/NotReadableError|TrackStartError/i.test(text)) {
    return 'Camera đang bị ứng dụng khác dùng. Tắt ứng dụng đó rồi thử lại.'
  }
  return 'Không mở được camera trên thiết bị này.'
}
