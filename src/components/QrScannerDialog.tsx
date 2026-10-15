import { Suspense, lazy } from 'react'
import { CircularProgress, Dialog, DialogContent } from '@mui/material'

const QrScannerCamera = lazy(() =>
  import('./QrScannerCamera').then((module) => ({ default: module.QrScannerCamera })),
)

type Props = {
  open: boolean
  onClose: () => void
  onResult: (path: string) => void
}

/**
 * Vỏ của hộp thoại quét QR. Thư viện camera chỉ tải về lúc mở — trước đây nó nằm trong
 * chunk chính nên mọi người đều tải ~108 KB gzip dù không bao giờ quét.
 */
export function QrScannerDialog({ open, onClose, onResult }: Props) {
  if (!open) return null
  return (
    <Suspense
      fallback={
        <Dialog open onClose={onClose} fullWidth maxWidth="xs">
          <DialogContent sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </DialogContent>
        </Dialog>
      }
    >
      <QrScannerCamera open onClose={onClose} onResult={onResult} />
    </Suspense>
  )
}
