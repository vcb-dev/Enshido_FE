import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import type { FieldValues, SubmitHandler, UseFormReturn } from 'react-hook-form'
import { useIsMobile } from '../../../hooks/useBreakpoint'
import type { CrudDialogKind } from '../../../hooks/useCrudDialog'
import { EditReasonBlock, type EditLogTarget } from './EditReasonBlock'
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
  /** Sửa thông tin: bắt buộc lý do và hiện lịch sử các lần trước. */
  editLog?: EditLogTarget
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
  editLog,
  children,
}: CrudDialogShellProps<T>) {
  const fullScreen = useIsMobile()
  const [busy, setBusy] = useState(false)
  const [editReason, setEditReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const submitted = useRef(false)
  const pending = saving || busy
  const needsReason = Boolean(editLog && kind === 'edit')

  useEffect(() => {
    if (!open) {
      setBusy(false)
      submitted.current = false
      setEditReason('')
      setReasonError('')
    }
  }, [open])

  // Nơi gọi thường truyền `mutation.mutate(...)` vào onSubmit — hàm đó không ném lỗi, lỗi đi
  // thẳng vào toast, nên nhánh catch bên dưới không bao giờ chạy. Không nhả ở đây thì
  // mutation hỏng xong nút vẫn quay vòng mãi và nút Hủy cũng khoá theo. Dựa vào `saving`:
  // vừa từ true về false mà hộp thoại còn mở thì là lỗi (thành công thì nơi gọi đã đóng).
  const wasSaving = useRef(false)
  /** Lượt bấm lưu hiện tại có thật sự gọi mutation không (saving từng bật). */
  const savingSeen = useRef(false)
  useEffect(() => {
    if (saving) {
      wasSaving.current = true
      savingSeen.current = true
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
          if (needsReason && !editReason.trim()) {
            setReasonError('Nhập lý do chỉnh sửa')
            submitted.current = false
            setBusy(false)
            return
          }
          submitted.current = true
          savingSeen.current = false
          setBusy(true)
          try {
            await onSubmit({ ...values, editReason: editReason.trim() })
          } catch {
            submitted.current = false
            setBusy(false)
            return
          }
          // onSubmit dừng giữa chừng mà không lưu (người dùng bấm "Quay lại sửa" ở hộp kiểm tra
          // số liệu, hay tự chặn lỗi): không có mutation nào để nhả nút — mở khoá lại ở đây.
          // Đợi một nhịp để `saving` của mutation vừa gọi (nếu có) kịp bật.
          setTimeout(() => {
            if (savingSeen.current || !submitted.current) return
            submitted.current = false
            setBusy(false)
          }, 0)
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
            pt: 2,
            overflow: 'visible',
            // Dấu * chỉ để báo ô phải điền — chế độ xem không điền gì nên ẩn đi.
            '& .MuiFormLabel-asterisk':
              kind === 'view' ? { display: 'none' } : { color: 'error.main' },
          }}
        >
          {children}
          {editLog && (kind === 'edit' || kind === 'view') ? (
            <EditReasonBlock
              entityType={editLog.entityType}
              entityId={editLog.entityId}
              reason={editReason}
              onReasonChange={(value) => {
                setEditReason(value)
                if (value.trim()) setReasonError('')
              }}
              required={kind === 'edit'}
              error={kind === 'edit' ? reasonError : undefined}
              readOnly={kind === 'view'}
            />
          ) : null}
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
                disabled={pending || submitDisabled}
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
