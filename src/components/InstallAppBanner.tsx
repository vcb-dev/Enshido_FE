import { useState } from 'react'
import { Alert, Button, IconButton, Stack } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { installHint } from '../pwa/installHint'
import { isStandalone, promptInstall, useCanPromptInstall } from '../pwa/installPrompt'

const DISMISS_KEY = 'enshido_install_hint_dismissed_at'
const DISMISS_FOR = 7 * 24 * 60 * 60_000

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return at > 0 && Date.now() - at < DISMISS_FOR
  } catch {
    return false
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    // Trình duyệt chặn lưu trữ: lần sau mở lại thì nhắc lại, không sao.
  }
}

/**
 * Nhắc thợ cài Enshido lên màn hình chính. Không có lời nhắc này thì iPhone không bao giờ
 * tự mời cài, còn Android chỉ mời khi Chrome thấy "đủ tương tác" — thợ không biết là cài được.
 * Tắt thì ẩn 7 ngày.
 */
export function InstallAppBanner({ sx }: { sx?: SxProps<Theme> }) {
  const canPrompt = useCanPromptInstall()
  const [dismissed, setDismissed] = useState(dismissedRecently)
  const hint = installHint({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: isStandalone(),
    canPrompt,
  })
  if (hint === 'none' || dismissed) return null

  const dismiss = () => {
    rememberDismiss()
    setDismissed(true)
  }

  const closeButton = (
    <IconButton aria-label="Để sau" color="inherit" size="small" onClick={dismiss}>
      <CloseIcon fontSize="small" />
    </IconButton>
  )

  if (hint === 'in-app') {
    return (
      <Alert severity="warning" action={closeButton} sx={sx}>
        Đang mở trong Zalo/Messenger nên không cài được app, camera quét mã cũng có thể bị chặn.
        Bấm <b>⋯</b> ở góc trên → <b>Mở bằng trình duyệt</b> (Chrome/Safari).
      </Alert>
    )
  }

  if (hint === 'ios') {
    return (
      <Alert severity="info" action={closeButton} sx={sx}>
        Cài Enshido lên màn hình chính: bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) rồi chọn{' '}
        <b>Thêm vào MH chính</b>.
      </Alert>
    )
  }

  return (
    <Alert
      severity="info"
      action={
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Button color="inherit" size="small" onClick={() => void promptInstall()}>
            Cài đặt
          </Button>
          {closeButton}
        </Stack>
      }
      sx={sx}
    >
      Cài Enshido lên điện thoại để mở nhanh như ứng dụng.
    </Alert>
  )
}
