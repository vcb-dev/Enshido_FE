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
