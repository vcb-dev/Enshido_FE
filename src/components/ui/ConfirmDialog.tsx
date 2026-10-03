import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'

export type ConfirmOptions = {
  title: string
  /** Đoạn mô tả phía trên danh sách. */
  message?: ReactNode
  /** Các ý cần người dùng soát lại — hiện thành danh sách trong khung cảnh báo. */
  items?: string[]
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'warning' | 'error' | 'info'
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

let open: ((request: Pending) => void) | null = null

/**
 * Hộp xác nhận theo giao diện của hệ thống, thay cho `window.confirm`. Gọi ở bất cứ đâu:
 * `if (!(await confirmDialog({ ... }))) return`. Cần `<ConfirmDialogHost />` gắn một lần ở gốc app.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!open) {
      // Chưa gắn host (test / trang in) — không chặn người dùng.
      resolve(true)
      return
    }
    open({ ...options, resolve })
  })
}

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null)

  useEffect(() => {
    open = (request) =>
      setPending((current) => {
        // Đang có hộp khác mở: hộp cũ coi như huỷ.
        current?.resolve(false)
        return request
      })
    return () => {
      open = null
    }
  }, [])

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  const tone = pending?.tone ?? 'warning'
  return (
    <Dialog open={pending != null} onClose={() => close(false)} fullWidth maxWidth="xs">
      <DialogTitle>{pending?.title}</DialogTitle>
      <DialogContent>
        {pending?.message ? (
          <Typography variant="body2" sx={{ mb: pending.items?.length ? 1.5 : 0 }}>
            {pending.message}
          </Typography>
        ) : null}
        {pending?.items?.length ? (
          <Alert severity={tone} icon={false} sx={{ py: 0.5 }}>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {pending.items.map((item) => (
                <Typography component="li" variant="body2" key={item} sx={{ '& + &': { mt: 0.5 } }}>
                  {item}
                </Typography>
              ))}
            </Box>
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => close(false)}>{pending?.cancelLabel ?? 'Quay lại sửa'}</Button>
        <Button variant="contained" color={tone === 'error' ? 'error' : 'primary'} onClick={() => close(true)} autoFocus>
          {pending?.confirmLabel ?? 'Vẫn lưu'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
