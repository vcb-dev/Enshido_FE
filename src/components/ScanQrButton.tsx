import { useState } from 'react'
import { Button, IconButton, Tooltip } from '@mui/material'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { canAccessPath } from '../auth/homePath'
import { QrScannerDialog } from './QrScannerDialog'

/**
 * Nút quét QR dùng chung. Đặt ở thanh trên cùng nên thợ quét được phiếu giấy từ bất kỳ
 * màn nào, không phải quay về "Phiếu của tôi" trước.
 */
export function ScanQrButton({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const onResult = (path: string) => {
    setOpen(false)
    // ProtectedRoute đá về trang chủ không kèm lý do — nói thẳng ra ở đây, vì thợ đang
    // cầm tờ phiếu trên tay và cần biết là do quyền chứ không phải quét sai.
    if (user && !canAccessPath(user, path)) {
      toast.error('Tài khoản của bạn không mở được phiếu vừa quét.')
      return
    }
    navigate(path)
  }

  return (
    <>
      {compact ? (
        <Tooltip title="Quét mã QR trên phiếu">
          <IconButton color="primary" aria-label="Quét mã QR trên phiếu" onClick={() => setOpen(true)}>
            <QrCodeScannerIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          variant="contained"
          startIcon={<QrCodeScannerIcon fontSize="small" />}
          onClick={() => setOpen(true)}
        >
          Quét mã
        </Button>
      )}
      <QrScannerDialog open={open} onClose={() => setOpen(false)} onResult={onResult} />
    </>
  )
}
