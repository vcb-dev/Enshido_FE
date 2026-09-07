import type { ReactNode } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import type { FieldValues, SubmitHandler, UseFormReturn } from 'react-hook-form'
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
  children,
}: CrudDialogShellProps<T>) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={maxWidth}
      slotProps={{ transition: { onExited } }}
    >
      <Form form={form} onSubmit={onSubmit}>
        <DialogTitle>{titles[kind]}</DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            pt: 1,
            '& .MuiFormLabel-asterisk': { color: 'error.main' },
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
              <Button onClick={onClose} disabled={saving}>
                Hủy
              </Button>
              <Button type="submit" variant="contained" disabled={saving || submitDisabled}>
                {kind === 'edit' ? 'Lưu' : 'Thêm'}
              </Button>
            </>
          )}
        </DialogActions>
      </Form>
    </Dialog>
  )
}
