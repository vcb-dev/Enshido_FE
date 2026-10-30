import { useEffect } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material'
import { useAppForm } from '../components/ui/form/useAppForm'
import { DialogForm, FormTextField } from '../components/ui'

type Values = { note: string }

/** Đơn đang sửa ghi chú: `label` là mã hiện trên tiêu đề (mã SX). */
export type OrderNoteTarget = { id: string; label: string; note: string | null }

type OrderNoteDialogProps = {
  target: OrderNoteTarget | null
  saving: boolean
  onClose: () => void
  onConfirm: (note: string) => void
}

/** Ghi đè cả ghi chú của lệnh; để trống rồi lưu là xoá ghi chú. */
export function OrderNoteDialog({ target, saving, onClose, onConfirm }: OrderNoteDialogProps) {
  const form = useAppForm<Values>({ defaultValues: { note: '' } })

  useEffect(() => {
    if (target) form.reset({ note: target.note ?? '' })
  }, [target, form])

  return (
    <Dialog open={Boolean(target)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Ghi chú lệnh {target?.label ?? ''}</DialogTitle>
      <DialogForm form={form} onSubmit={(values) => onConfirm(values.note.trim())}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <FormTextField<Values>
              name="note"
              label="Ghi chú"
              multiline
              minRows={3}
              maxRows={8}
              size="small"
              fullWidth
              autoFocus
              disabled={saving}
              rules={{ maxLength: { value: 1000, message: 'Tối đa 1000 ký tự' } }}
              placeholder="Để trống rồi lưu để xoá ghi chú"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={saving || !target}>
            {saving ? 'Đang lưu…' : 'Lưu ghi chú'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
