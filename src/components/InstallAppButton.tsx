import { useState, type ReactNode } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import InstallMobileIcon from '@mui/icons-material/InstallMobile'
import IosShareIcon from '@mui/icons-material/IosShare'
import type { InstallHint } from '../pwa/installHint'
import { promptInstall, useInstallHint } from '../pwa/installPrompt'

const STEPS: Record<Exclude<InstallHint, 'none' | 'prompt'>, ReactNode[]> = {
  ios: [
    <>
      Bấm nút <b>Chia sẻ</b>{' '}
      <IosShareIcon fontSize="inherit" sx={{ verticalAlign: 'text-bottom' }} /> — trên Chrome
      nằm ở góc phải thanh địa chỉ, trên Safari ở thanh dưới hoặc trong menu <b>•••</b>.
    </>,
    <>
      Kéo xuống, chọn <b>Thêm vào MH chính</b>.
    </>,
    <>
      Bấm <b>Thêm</b> — biểu tượng Enshido hiện trên màn hình chính, mở từ đó như app.
    </>,
  ],
  'in-app': [
    <>
      Bấm <b>⋯</b> ở góc trên của Zalo/Messenger.
    </>,
    <>
      Chọn <b>Mở bằng trình duyệt</b> (Chrome hoặc Safari).
    </>,
    <>Trong trình duyệt, bấm lại icon cài app này.</>,
  ],
  manual: [
    <>
      Bấm menu <b>⋮</b> ở góc trên bên phải trình duyệt.
    </>,
    <>
      Chọn <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào màn hình chính</b>.
    </>,
    <>
      Bấm <b>Cài đặt</b> — biểu tượng Enshido hiện trên màn hình chính.
    </>,
  ],
}

/**
 * Icon cài app cố định trên thanh trên cùng — banner nhắc cài tắt đi rồi vẫn tìm lại được.
 * Android đã sẵn sàng thì mở thẳng hộp thoại cài của trình duyệt; còn lại (iPhone, Zalo,
 * trình duyệt chưa cho cài tự động) thì chỉ từng bước.
 */
export function InstallAppButton() {
  const hint = useInstallHint()
  const [open, setOpen] = useState(false)
  if (hint === 'none') return null

  const onClick = () => {
    if (hint === 'prompt') void promptInstall()
    else setOpen(true)
  }

  return (
    <>
      <Tooltip title="Cài app lên điện thoại">
        <IconButton color="primary" aria-label="Cài app lên điện thoại" onClick={onClick}>
          <InstallMobileIcon />
        </IconButton>
      </Tooltip>
      {hint === 'prompt' ? null : (
        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Cài Enshido lên điện thoại</DialogTitle>
          <DialogContent>
            <Box component="ol" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {STEPS[hint].map((step, index) => (
                <Typography key={index} component="li" variant="body2">
                  {step}
                </Typography>
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Đã hiểu</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  )
}
