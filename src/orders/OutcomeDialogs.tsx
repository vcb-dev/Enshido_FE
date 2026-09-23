import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { TextInput } from '../components/ui'

/** Ghi lỗi từ cột "Lỗi" của một phiếu con — lý do bắt buộc, phiếu đó dừng ở nhánh lỗi. */
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
  const [note, setNote] = useState('')

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ transition: { onExited: () => setNote('') } }}
    >
      <DialogTitle>Ghi lỗi — phiếu {ticketCode}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary">
          Riêng phiếu này dừng ở nhánh Lỗi; lý do hiện ở cột Lỗi cuối phiếu. Các phiếu con khác vẫn làm
          tiếp. Đơn chỉ chuyển Sản xuất lỗi khi mọi phiếu con đều lỗi.
        </Typography>
        <TextInput
          label="Lý do lỗi"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          required
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
          variant="contained"
          color="error"
          disabled={!note.trim()}
          loading={saving}
          loadingPosition="start"
          onClick={() => onSave(note.trim())}
        >
          Ghi lỗi
        </Button>
      </DialogActions>
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
  const [note, setNote] = useState('')

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ transition: { onExited: () => setNote('') } }}
    >
      <DialogTitle>Hoàn thiện — {scope === 'order' ? 'đơn' : 'phiếu'} {ticketCode}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary">
          {scope === 'order'
            ? `Hàng đạt, đơn kết thúc: ${qty} sản phẩm vào kho thành phẩm. Người xác nhận lấy từ tài khoản đang đăng nhập.`
            : `Hàng đạt, phiếu này kết thúc: ${qty} sản phẩm vào kho thành phẩm ngay, không chờ các phiếu con khác. Số lượng lấy đúng số KCS nhận lại ở khâu cuối; người xác nhận lấy từ tài khoản đang đăng nhập.`}
        </Typography>
        <TextInput
          label="Ghi chú"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          multiline
          minRows={2}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button
          variant="contained"
          loading={saving}
          loadingPosition="start"
          onClick={() => onSave(note.trim() || undefined)}
        >
          Hoàn thiện
        </Button>
      </DialogActions>
    </Dialog>
  )
}
