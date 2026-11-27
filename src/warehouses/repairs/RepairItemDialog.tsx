import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createRepairItemApi,
  REPAIR_SOURCE_OPTIONS,
  REPAIR_STAGE_OPTIONS,
  updateRepairItemApi,
  type RepairItem,
  type RepairItemPayload,
  type RepairSource,
  type RepairStage,
} from '../../api/repairs'
import { DateField } from '../../components/ui'
import { useIsMobile } from '../../hooks/useBreakpoint'
import { vnToday } from '../warehousePeriod'

const digitsOf = (raw: string) => raw.replace(/\D/g, '')
const textOrNull = (raw: string) => raw.trim() || null

function ChoiceGroup<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: V | ''
  options: Array<{ value: V; label: string }>
  onChange: (value: V) => void
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label} *
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        fullWidth
        value={value}
        onChange={(_, next: V | null) => next && onChange(next)}
      >
        {options.map((option) => (
          <ToggleButton key={option.value} value={option.value}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  )
}

/**
 * Thêm / sửa một món hàng sửa chữa. Phần khách (ngày, loại hàng, mã / tên sản phẩm, số lượng, chi
 * tiết sửa, người gửi sửa) ai cũng nhập được; phần thủ kho (mã số phiếu, SL trả, ngày trả, các người
 * ký, note) chỉ hiện với thủ kho. Khách không chọn VPC / VCB — lấy theo tài khoản.
 */
export function RepairItemDialog({
  open,
  item,
  customerSource,
  defaults,
  onClose,
}: {
  open: boolean
  /** null = thêm mới. */
  item: RepairItem | null
  /** Tài khoản khách: hàng của khách (VCB / VPC). null = thủ kho. */
  customerSource: RepairSource | null
  /** Thêm mới: chọn sẵn theo bộ lọc đang chọn. */
  defaults?: { stage?: RepairStage | ''; source?: RepairSource | '' }
  onClose: () => void
}) {
  const fullScreen = useIsMobile()
  const queryClient = useQueryClient()
  const keeper = customerSource === null
  const today = vnToday()
  // Phần khách
  const [receivedAt, setReceivedAt] = useState(today)
  const [stage, setStage] = useState<RepairStage | ''>('')
  const [source, setSource] = useState<RepairSource | ''>('')
  const [productCode, setProductCode] = useState('')
  const [productName, setProductName] = useState('')
  const [qty, setQty] = useState('1')
  const [content, setContent] = useState('')
  const [senderName, setSenderName] = useState('')
  // Phần thủ kho
  const [ticketCode, setTicketCode] = useState('')
  const [returnedQty, setReturnedQty] = useState('')
  const [returnedAt, setReturnedAt] = useState('')
  const [transferConfirmedBy, setTransferConfirmedBy] = useState('')
  const [issuerName, setIssuerName] = useState('')
  const [repairedBy, setRepairedBy] = useState('')
  const [returnedBy, setReturnedBy] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setReceivedAt(item?.receivedAt ?? vnToday())
    setStage(item?.stage ?? defaults?.stage ?? '')
    setSource(item?.source ?? customerSource ?? defaults?.source ?? '')
    setProductCode(item?.productCode ?? '')
    setProductName(item?.productName ?? '')
    setQty(item ? String(item.qty) : '1')
    setContent(item?.content ?? '')
    setSenderName(item?.senderName ?? '')
    setTicketCode(item?.ticketCode ?? '')
    setReturnedQty(item?.returnedQty != null ? String(item.returnedQty) : '')
    setReturnedAt(item?.returnedAt ?? '')
    setTransferConfirmedBy(item?.transferConfirmedBy ?? '')
    setIssuerName(item?.issuerName ?? '')
    setRepairedBy(item?.repairedBy ?? '')
    setReturnedBy(item?.returnedBy ?? '')
    setReceiverName(item?.receiverName ?? '')
    setNote(item?.note ?? '')
    // defaults (bộ lọc đang chọn) chỉ lấy lúc mở hộp thoại, không theo dõi.
  }, [open, item, customerSource])

  const qtyNumber = Number(qty)
  const returnedNumber = returnedQty === '' ? null : Number(returnedQty)
  const returnedTooMany = returnedNumber !== null && qtyNumber > 0 && returnedNumber > qtyNumber
  const returnedBeforeReceived = Boolean(returnedAt) && returnedAt < receivedAt
  const missingProduct = productCode.trim() === '' && productName.trim() === ''
  const ready =
    Boolean(receivedAt) &&
    Boolean(stage) &&
    Boolean(source) &&
    !missingProduct &&
    qtyNumber > 0 &&
    content.trim() !== '' &&
    !returnedTooMany &&
    !returnedBeforeReceived

  const save = useMutation({
    mutationFn: () => {
      const payload: RepairItemPayload = {
        receivedAt,
        stage: stage as RepairStage,
        productCode: textOrNull(productCode),
        productName: textOrNull(productName),
        qty: qtyNumber,
        content: content.trim(),
        senderName: textOrNull(senderName),
        ...(keeper
          ? {
              source: source as RepairSource,
              ticketCode: textOrNull(ticketCode),
              returnedQty: returnedNumber,
              returnedAt: returnedAt || null,
              transferConfirmedBy: textOrNull(transferConfirmedBy),
              issuerName: textOrNull(issuerName),
              repairedBy: textOrNull(repairedBy),
              returnedBy: textOrNull(returnedBy),
              receiverName: textOrNull(receiverName),
              note: textOrNull(note),
            }
          : {}),
      }
      return item ? updateRepairItemApi(item.id, payload) : createRepairItemApi(payload)
    },
    onSuccess: () => {
      toast.success(item ? 'Đã lưu hàng sửa chữa' : keeper ? 'Đã thêm hàng sửa chữa' : 'Đã gửi hàng sửa chữa')
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
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle>{item ? 'Sửa hàng sửa chữa' : keeper ? 'Thêm hàng sửa chữa' : 'Gửi hàng sửa chữa'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {keeper ? (
            <Typography variant="subtitle2" color="text.secondary">
              Khách gửi sửa
            </Typography>
          ) : null}
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <ChoiceGroup label="Loại hàng" value={stage} options={REPAIR_STAGE_OPTIONS} onChange={setStage} />
            {keeper ? (
              <ChoiceGroup label="Hàng của" value={source} options={REPAIR_SOURCE_OPTIONS} onChange={setSource} />
            ) : (
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Hàng của
                </Typography>
                <Box>
                  <Chip variant="outlined" label={`Hàng ${customerSource}`} />
                </Box>
              </Stack>
            )}
          </Box>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', sm: '1.2fr 1.3fr 0.8fr' } }}>
            <DateField
              size="small"
              label="Ngày"
              required
              value={receivedAt}
              onChange={(next) => next && setReceivedAt(next)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
            />
            <TextField
              size="small"
              label="Mã sản phẩm"
              value={productCode}
              onChange={(event) => setProductCode(event.target.value)}
              error={missingProduct}
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
            <TextField
              size="small"
              label="Số lượng"
              required
              value={qty}
              onChange={(event) => setQty(digitsOf(event.target.value))}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
          </Box>
          <TextField
            size="small"
            label="Tên sản phẩm"
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            error={missingProduct}
            helperText={missingProduct ? 'Nhập mã sản phẩm hoặc tên sản phẩm' : undefined}
            slotProps={{ htmlInput: { maxLength: 300 } }}
          />
          <TextField
            size="small"
            label="Chi tiết sửa"
            required
            placeholder="Vd: Sửa thành size 5 và xi lại"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            multiline
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
          {text('Người gửi sửa', senderName, setSenderName)}

          {keeper ? (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">
                Thủ kho
              </Typography>
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', sm: '1.2fr 0.8fr 1.2fr' } }}>
                <TextField
                  size="small"
                  label="Mã số phiếu"
                  value={ticketCode}
                  onChange={(event) => setTicketCode(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 50 } }}
                />
                <TextField
                  size="small"
                  label="SL trả"
                  value={returnedQty}
                  onChange={(event) => setReturnedQty(digitsOf(event.target.value))}
                  error={returnedTooMany}
                  helperText={returnedTooMany ? 'Lớn hơn số lượng' : 'Trống = chưa trả'}
                  slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                />
                <DateField
                  size="small"
                  label="Ngày trả"
                  value={returnedAt}
                  onChange={(next) => setReturnedAt(next ?? '')}
                  error={returnedBeforeReceived}
                  helperText={returnedBeforeReceived ? 'Trước ngày gửi' : undefined}
                  sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
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
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Sau khi thủ kho nhận hàng thì không sửa / xoá được nữa.
            </Typography>
          )}
          {item ? (
            <Typography variant="caption" color="text.secondary">
              Tạo bởi: {item.createdByName}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="contained" disabled={!ready || save.isPending} loading={save.isPending} onClick={() => save.mutate()}>
          {item ? 'Lưu' : keeper ? 'Thêm' : 'Gửi'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
