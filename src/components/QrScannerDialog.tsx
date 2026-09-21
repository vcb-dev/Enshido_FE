import { useEffect, useId, useRef, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { Html5Qrcode } from 'html5-qrcode'
import { cameraErrorMessage, pathFromScan } from './qrScan'

/**
 * stop() ném lỗi ĐỒNG BỘ khi camera chưa chạy (đang khởi động, hoặc bị từ chối quyền) —
 * .catch() không bắt được, lọt ra cleanup của effect là sập cả app.
 */
function stopQuietly(scanner: Html5Qrcode) {
  try {
    scanner.stop().catch(() => undefined)
  } catch {
    // Không có camera nào đang chạy để tắt.
  }
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
  // Dialog của MUI gắn nội dung qua Portal ở lượt vẽ SAU lượt mở: effect chạy ngay theo
  // `open` sẽ gặp lúc ô camera chưa có trong DOM, Html5Qrcode ném lỗi và sập trắng cả app.
  // Nên chờ chính ô đó xuất hiện (callback ref) rồi mới bật camera.
  const [region, setRegion] = useState<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Giữ callback trong ref: cha thường truyền hàm inline, để nó vào deps của effect
  // thì mỗi lần cha vẽ lại là camera tắt rồi bật lại.
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    if (!open || !region) return
    let cancelled = false
    setError(null)

    const scanner = new Html5Qrcode(region.id)
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
          onResultRef.current(path)
        },
        () => {
          // Mỗi khung hình không đọc được đều gọi vào đây — bỏ qua, không báo lỗi.
        },
      )
      .then(() => {
        // Đóng hộp thoại khi camera còn đang khởi động: stop() ở cleanup hụt, tắt ở đây
        // kẻo đèn camera sáng mãi.
        if (cancelled) stopQuietly(scanner)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(cameraErrorMessage(err))
      })

    return () => {
      cancelled = true
      // Camera chưa kịp khởi động thì nhánh then ở trên sẽ tắt sau.
      stopQuietly(scanner)
    }
  }, [open, region])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Quét mã QR trên phiếu</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Box
          ref={setRegion}
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
