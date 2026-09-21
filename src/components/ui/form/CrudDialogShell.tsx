import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import type { FieldValues, SubmitHandler, UseFormReturn } from 'react-hook-form'
import { useIsMobile } from '../../../hooks/useBreakpoint'
import type { CrudDialogKind } from '../../../hooks/useCrudDialog'
import { Form } from './Form'

export type CrudDialogShellProps<T extends FieldValues> = {
  open: boolean
  kind: CrudDialogKind
  titles: Record<CrudDialogKind, string>
  form: UseFormReturn<T>
  onSubmit: SubmitHandler<T>
  saving: boolean
  /** Điều kiện khoá thêm cho nút Lưu/Thêm ngoài `saving` (vd: hết hàng để xuất). Không ảnh hưởng nút Hủy. */
  submitDisabled?: boolean
  onClose: () => void
  onExited: () => void
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Ghi đè nhãn nút submit (mặc định "Thêm" / "Lưu" theo `kind`). */
  submitLabel?: string
  /**
   * Nhãn nút lúc đang gửi. Mặc định "Đang lên đơn…" / "Đang lưu…" theo `kind` — hộp thoại
   * nào đổi `submitLabel` sang việc khác (giao thợ, xác nhận…) thì nên đổi cả nhãn này.
   */
  pendingLabel?: string
  children: ReactNode
}

/**
 * Khung Dialog dùng chung cho form Thêm / Sửa / Xem: tiêu đề theo `kind`,
 * layout DialogContent xếp cột đều nhau, và cụm nút Đóng (xem) hoặc Hủy +
 * Lưu/Thêm (tạo/sửa). Chỉ cần truyền field content vào `children`.
 */
export function CrudDialogShell<T extends FieldValues>({
  open,
  kind,
  titles,
  form,
  onSubmit,
  saving,
  submitDisabled,
  onClose,
  onExited,
  maxWidth = 'md',
  submitLabel,
  pendingLabel,
  children,
}: CrudDialogShellProps<T>) {
  const fullScreen = useIsMobile()
  const [busy, setBusy] = useState(false)
  const submitted = useRef(false)
  const pending = saving || busy

  useEffect(() => {
    if (!open) {
      setBusy(false)
      submitted.current = false
    }
  }, [open])

  // Nơi gọi thường truyền `mutation.mutate(...)` vào onSubmit — hàm đó không ném lỗi, lỗi đi
  // thẳng vào toast, nên nhánh catch bên dưới không bao giờ chạy. Không nhả ở đây thì
  // mutation hỏng xong nút vẫn quay vòng mãi và nút Hủy cũng khoá theo. Dựa vào `saving`:
  // vừa từ true về false mà hộp thoại còn mở thì là lỗi (thành công thì nơi gọi đã đóng).
  const wasSaving = useRef(false)
  useEffect(() => {
    if (saving) {
      wasSaving.current = true
      return
    }
    if (!wasSaving.current) return
    wasSaving.current = false
    submitted.current = false
    setBusy(false)
  }, [saving])

  return (
    <Dialog
      open={open}
      onClose={pending ? undefined : onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth={maxWidth}
      slotProps={{ transition: { onExited } }}
    >
      <Form
        form={form}
        onSubmit={async (values) => {
          if (submitted.current) return
          submitted.current = true
          setBusy(true)
          try {
            await onSubmit(values)
          } catch {
            submitted.current = false
            setBusy(false)
          }
        }}
        onSubmitInvalid={() => {
          submitted.current = false
          setBusy(false)
        }}
      >
        <DialogTitle>{titles[kind]}</DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            pt: 1,
            // Dấu * chỉ để báo ô phải điền — chế độ xem không điền gì nên ẩn đi.
            '& .MuiFormLabel-asterisk':
              kind === 'view' ? { display: 'none' } : { color: 'error.main' },
          }}
        >
          {children}
        </DialogContent>
        <DialogActions>
          {kind === 'view' ? (
            <Button onClick={onClose} variant="contained">
              Đóng
            </Button>
          ) : (
            <>
              <Button onClick={onClose} disabled={pending}>
                Hủy
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={saving || submitDisabled}
                onPointerDown={() => {
                  if (saving || submitDisabled || submitted.current) return
                  setBusy(true)
                }}
                startIcon={pending ? <CircularProgress color="inherit" size={16} /> : undefined}
              >
                {pending
                  ? (pendingLabel ?? (kind === 'edit' ? 'Đang lưu…' : 'Đang lên đơn…'))
                  : (submitLabel ?? (kind === 'edit' ? 'Lưu' : 'Thêm'))}
              </Button>
            </>
          )}
        </DialogActions>
      </Form>
    </Dialog>
  )
}
