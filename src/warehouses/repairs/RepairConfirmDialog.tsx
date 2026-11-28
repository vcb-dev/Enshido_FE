import { useEffect, useState, type ReactNode } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { REPAIR_STAGE_LABEL, updateRepairItemApi, type RepairItem } from '../../api/repairs'
import { DateField } from '../../components/ui'
import { useIsMobile } from '../../hooks/useBreakpoint'
import { customerPartOf } from './repairKeeperPart'

const digitsOf = (raw: string) => raw.replace(/\D/g, '')
const textOrNull = (raw: string) => raw.trim() || null

/** Ngày YYYY-MM-DD → dd/mm/yyyy. */
function fullDate(value: string | null) {
  if (!value) return ''
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
        {children || '—'}
      </Typography>
    </Box>
  )
}

/**
 * Thủ kho xác nhận một món hàng sửa: SL trả, ngày trả, các người ký trên phiếu giấy, note. Phần khách
 * gửi chỉ xem ở đây (sửa ở nút Sửa). Ghi bất kỳ ô nào là dòng thành "Đang sửa" và khách hết sửa / xoá.
 */
export function RepairConfirmDialog({ item, onClose }: { item: RepairItem | null; onClose: () => void }) {
  const fullScreen = useIsMobile()
  const queryClient = useQueryClient()
  const [returnedQty, setReturnedQty] = useState('')
  const [returnedAt, setReturnedAt] = useState('')
  const [transferConfirmedBy, setTransferConfirmedBy] = useState('')
  const [issuerName, setIssuerName] = useState('')
  const [repairedBy, setRepairedBy] = useState('')
  const [returnedBy, setReturnedBy] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!item) return
    setReturnedQty(item.returnedQty != null ? String(item.returnedQty) : '')
    setReturnedAt(item.returnedAt ?? '')
    setTransferConfirmedBy(item.transferConfirmedBy ?? '')
    setIssuerName(item.issuerName ?? '')
    setRepairedBy(item.repairedBy ?? '')
    setReturnedBy(item.returnedBy ?? '')
    setReceiverName(item.receiverName ?? '')
    setNote(item.note ?? '')
  }, [item])

  const returnedNumber = returnedQty === '' ? null : Number(returnedQty)
  const returnedTooMany = item != null && returnedNumber !== null && returnedNumber > item.qty
  const returnedBeforeReceived = item != null && Boolean(returnedAt) && returnedAt < item.receivedAt

  const save = useMutation({
    mutationFn: (row: RepairItem) =>
      updateRepairItemApi(row.id, {
        ...customerPartOf(row),
        source: row.source,
        returnedQty: returnedNumber,
        returnedAt: returnedAt || null,
        transferConfirmedBy: textOrNull(transferConfirmedBy),
        issuerName: textOrNull(issuerName),
        repairedBy: textOrNull(repairedBy),
        returnedBy: textOrNull(returnedBy),
        receiverName: textOrNull(receiverName),
        note: textOrNull(note),
      }),
    onSuccess: () => {
      toast.success('Đã lưu xác nhận của thủ kho')
      void queryClient.invalidateQueries({ queryKey: ['repairs'] })
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const text = (label: string, value: string, set: (next: string) => void, maxLength = 100) => (
    <TextField
      size="small"
      label={label}
      value={value}
      onChange={(event) => set(event.target.value)}
      slotProps={{ htmlInput: { maxLength } }}
    />
  )

  return (
    <Dialog open={item != null} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle>Thủ kho xác nhận</DialogTitle>
      <DialogContent dividers>
        {item ? (
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">
              Khách gửi sửa
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' } }}>
              <Info label="Ngày">{fullDate(item.receivedAt)}</Info>
              <Info label="Số phiếu sửa">{item.ticketCode}</Info>
              <Info label="Hàng của">
                Hàng {item.source} · {REPAIR_STAGE_LABEL[item.stage]}
              </Info>
              <Info label="Mã sản phẩm">{item.productCode}</Info>
              <Info label="Tên sản phẩm">{item.productName}</Info>
              <Info label="Số lượng">{item.qty}</Info>
            </Box>
            <Info label="Chi tiết sửa">{item.content}</Info>
            <Info label="Người gửi sửa">{item.senderName}</Info>

            <Divider />
            <Typography variant="subtitle2" color="text.secondary">
              Thủ kho
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
              <TextField
                size="small"
                label="SL trả"
                value={returnedQty}
                onChange={(event) => setReturnedQty(digitsOf(event.target.value))}
                error={returnedTooMany}
                helperText={returnedTooMany ? `Lớn hơn số lượng gửi (${item.qty})` : 'Trống = chưa trả'}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              />
              <DateField
                size="small"
                label="Ngày trả"
                value={returnedAt}
                onChange={(next) => setReturnedAt(next ?? '')}
                error={returnedBeforeReceived}
                helperText={returnedBeforeReceived ? 'Trước ngày gửi' : undefined}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
            {text('Người xác nhận chuyển hàng sửa chữa', transferConfirmedBy, setTransferConfirmedBy)}
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {text('Người lập phiếu', issuerName, setIssuerName)}
              {text('Người sửa', repairedBy, setRepairedBy)}
              {text('Người trả', returnedBy, setReturnedBy)}
              {text('Người nhận', receiverName, setReceiverName)}
            </Box>
            <TextField
              size="small"
              label="Note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
            <Typography variant="caption" color="text.secondary">
              Lưu xác nhận thì khách không sửa / xoá dòng này được nữa.
            </Typography>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button
          variant="contained"
          disabled={!item || returnedTooMany || returnedBeforeReceived || save.isPending}
          loading={save.isPending}
          onClick={() => item && save.mutate(item)}
        >
          Lưu xác nhận
        </Button>
      </DialogActions>
    </Dialog>
  )
}
