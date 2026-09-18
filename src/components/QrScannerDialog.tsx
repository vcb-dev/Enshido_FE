import { useEffect, useId, useRef, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { Html5Qrcode } from 'html5-qrcode'

/** Mã QR trên phiếu giấy là URL tuyệt đối — tách ra đường dẫn trong app. */
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
 * Quét QR trên phiếu giấy bằng camera sau của điện thoại. Camera cần HTTPS —
 * chạy được trên bản Vercel và trên localhost khi phát triển.
 */
export function QrScannerDialog({
  open,
  onClose,
  onResult,
}: {
  open: boolean
  onClose: () => void
  onResult: (path: string) => void
}) {
  const regionId = useId().replace(/:/g, '')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)

    const scanner = new Html5Qrcode(regionId)
    scannerRef.current = scanner
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          const path = pathFromScan(text)
          if (!path) {
            setError(`Mã QR không thuộc hệ thống Enshido: ${text.slice(0, 60)}`)
            return
          }
          onResult(path)
        },
        () => {
          // Mỗi khung hình không đọc được đều gọi vào đây — bỏ qua, không báo lỗi.
        },
      )
      .catch((err: unknown) => {
        if (cancelled) return
        setError(
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Chưa được phép dùng camera. Bật quyền camera cho trang này rồi thử lại.'
            : 'Không mở được camera trên thiết bị này.',
        )
      })

    return () => {
      cancelled = true
      // stop() ném lỗi nếu camera chưa kịp khởi động — không có gì để xử lý thêm.
      scanner.stop().catch(() => undefined)
      scannerRef.current = null
    }
  }, [open, regionId, onResult])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Quét mã QR trên phiếu</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Box
          id={regionId}
          sx={{ width: '100%', minHeight: 260, borderRadius: 1, overflow: 'hidden', bgcolor: '#000' }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  )
}
