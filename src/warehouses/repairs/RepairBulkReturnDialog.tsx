import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { confirmRepairSlipApi, type RepairConfirmShared, type RepairItem } from '../../api/repairs'
import { DateField } from '../../components/ui'
import { useIsMobile } from '../../hooks/useBreakpoint'
import { vnToday } from '../warehousePeriod'

/**
 * Thủ kho đánh dấu nhanh các mã đã trả — tick trên bảng rồi bấm một lần, như đánh dấu trên Excel.
 * SL trả = SL gửi từng mã, ngày trả mặc định hôm nay; người sửa / người trả / người lấy hàng nhập
 * một lần, bỏ trống thì giữ nguyên giá trị đang có của từng dòng. Trả thiếu (SL trả < SL gửi) thì
 * dùng nút Trả hàng trên dòng.
 */
export function RepairBulkReturnDialog({
  rows,
  onClose,
  onDone,
}: {
  rows: RepairItem[] | null
  onClose: () => void
  onDone: () => void
}) {
  const fullScreen = useIsMobile()
  const queryClient = useQueryClient()
  const today = vnToday()
  const [returnedAt, setReturnedAt] = useState(today)
  const [repairedBy, setRepairedBy] = useState('')
  const [returnedBy, setReturnedBy] = useState('')
  const [receiverName, setReceiverName] = useState('')

  useEffect(() => {
    if (!rows) return
    setReturnedAt(vnToday())
    setRepairedBy('')
    setReturnedBy('')
    setReceiverName('')
  }, [rows])

  const list = rows ?? []
  const beforeReceived = Boolean(returnedAt) && list.some((row) => returnedAt < row.receivedAt)

  const save = useMutation({
    mutationFn: () => {
      // Ô bỏ trống không gửi — BE giữ người sửa / người trả / người nhận đang có của từng dòng.
      const shared: RepairConfirmShared = { returnedAt }
      if (repairedBy.trim()) shared.repairedBy = repairedBy.trim()
      if (returnedBy.trim()) shared.returnedBy = returnedBy.trim()
      if (receiverName.trim()) shared.receiverName = receiverName.trim()
      return confirmRepairSlipApi({
        ...shared,
        lines: list.map((row) => ({ id: row.id, returnedQty: row.qty })),
      })
    },
    onSuccess: () => {
      toast.success(`Đã đánh dấu trả ${list.length} mã`)
      void queryClient.invalidateQueries({ queryKey: ['repairs'] })
      onDone()
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const text = (label: string, value: string, set: (next: string) => void) => (
    <TextField
      size="small"
      label={label}
      value={value}
      onChange={(event) => set(event.target.value)}
      helperText="Bỏ trống = giữ như đang ghi"
      slotProps={{ htmlInput: { maxLength: 100 } }}
    />
  )

  return (
    <Dialog open={rows != null} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle>Đã trả {list.length} mã</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box
            component="ul"
            sx={{ m: 0, pl: 2.5, maxHeight: 180, overflow: 'auto', color: 'text.secondary', typography: 'body2' }}
          >
            {list.map((row) => (
              <li key={row.id}>
                {[row.ticketCode, row.productCode ?? row.productName].filter(Boolean).join(' · ')} — trả đủ {row.qty}
              </li>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <DateField
              size="small"
              label="Ngày trả"
              required
              value={returnedAt}
              onChange={(next) => setReturnedAt(next ?? '')}
              error={beforeReceived}
              helperText={beforeReceived ? 'Trước ngày khách gửi của một mã' : undefined}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
            />
            {text('Người sửa', repairedBy, setRepairedBy)}
            {text('Người trả', returnedBy, setReturnedBy)}
            {text('Người nhận (người lấy hàng)', receiverName, setReceiverName)}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Trả thiếu (SL trả ít hơn SL gửi) thì bấm Trả hàng trên dòng đó.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button
          variant="contained"
          disabled={!list.length || !returnedAt || beforeReceived || save.isPending}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Đánh dấu đã trả
        </Button>
      </DialogActions>
    </Dialog>
  )
}
