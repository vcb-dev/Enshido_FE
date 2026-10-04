import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import { DialogForm, FormTextField } from '../components/ui'

type NoteValues = { note: string }

/** Báo lỗi khâu đang làm của một phiếu con — lý do bắt buộc, QC cân lại hàng sau đó. */
export function DefectDialog({
  open,
  ticketCode,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  ticketCode: string
  saving: boolean
  onClose: () => void
  onSave: (note: string) => void
}) {
  const form = useForm<NoteValues>({ defaultValues: { note: '' } })
  const note = useWatch({ control: form.control, name: 'note' })

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ transition: { onExited: () => form.reset({ note: '' }) } }}
    >
      <DialogTitle>Báo lỗi — phiếu {ticketCode}</DialogTitle>
      <DialogForm form={form} onSubmit={(values) => onSave(values.note.trim())}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
          <FormTextField<NoteValues>
            name="note"
            label="Lý do lỗi"
            required
            rules={{ validate: (value) => (value.trim() ? true : 'Nhập lý do lỗi') }}
            multiline
            minRows={3}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="error"
            disabled={!note.trim()}
            loading={saving}
            loadingPosition="start"
          >
            Báo lỗi
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}

/** Chốt hàng đạt từ cột "Hoàn thiện" của một phiếu con: số của phiếu vào kho thành phẩm ngay. */
export function FinishDialog({
  open,
  ticketCode,
  qty,
  scope = 'ticket',
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  ticketCode: string
  qty: number
  scope?: 'ticket' | 'order'
  saving: boolean
  onClose: () => void
  onSave: (note: string | undefined) => void
}) {
  const form = useForm<NoteValues>({ defaultValues: { note: '' } })

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ transition: { onExited: () => form.reset({ note: '' }) } }}
    >
      <DialogTitle>Hoàn thiện — {scope === 'order' ? 'đơn' : 'phiếu'} {ticketCode}</DialogTitle>
      <DialogForm form={form} onSubmit={(values) => onSave(values.note.trim() || undefined)}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
          <Typography variant="body2" color="text.secondary">
            {/* Số lượng lấy đúng số QC nhận lại ở khâu cuối, không phải số đặt hàng. */}
            {qty} sản phẩm chuyển kho thành phẩm.
          </Typography>
          <FormTextField<NoteValues>
            name="note"
            label="Ghi chú"
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" loading={saving} loadingPosition="start">
            Hoàn thiện
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
