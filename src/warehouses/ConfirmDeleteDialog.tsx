import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  deleting,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  deleting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onClose={deleting ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{description}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>
          Hủy
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={deleting}>
          Xóa
        </Button>
      </DialogActions>
    </Dialog>
  )
}

