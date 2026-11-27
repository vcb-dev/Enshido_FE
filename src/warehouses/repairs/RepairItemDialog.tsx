import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createRepairItemApi,
  createRepairItemsApi,
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

/** Tối đa số mã trên một phiếu — khớp giới hạn BE. */
const MAX_LINES = 50

/** Một mã sản phẩm trên phiếu sửa. */
type Line = {
  key: number
  productCode: string
  productName: string
  qty: string
  content: string
  /** Thủ kho: SL trả của riêng mã này. */
  returnedQty: string
}

const emptyLine = (key: number): Line => ({
  key,
  productCode: '',
  productName: '',
  qty: '1',
  content: '',
  returnedQty: '',
})

function lineErrors(line: Line) {
  const qty = Number(line.qty)
  const returned = line.returnedQty === '' ? null : Number(line.returnedQty)
  const missingProduct = line.productCode.trim() === '' && line.productName.trim() === ''
  const returnedTooMany = returned !== null && qty > 0 && returned > qty
  return {
    missingProduct,
    returnedTooMany,
    ok: !missingProduct && qty > 0 && line.content.trim() !== '' && !returnedTooMany,
  }
}

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
 * Thêm / sửa hàng sửa chữa. Thêm mới là một phiếu sửa: ngày, loại hàng, số phiếu sửa, người gửi dùng
 * chung, bấm "+" để gom nhiều mã sản phẩm — lưu ra mỗi mã một dòng cùng số phiếu. Sửa thì chỉ một
 * dòng. Phần thủ kho (SL trả từng mã, ngày trả, các người ký, note) chỉ hiện với thủ kho. Khách
 * không chọn VPC / VCB — lấy theo tài khoản.
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
  const creating = item === null
  const today = vnToday()
  const nextKey = useRef(1)
  // Phần khách — chung cho cả phiếu
  const [receivedAt, setReceivedAt] = useState(today)
  const [stage, setStage] = useState<RepairStage | ''>('')
  const [source, setSource] = useState<RepairSource | ''>('')
  const [ticketCode, setTicketCode] = useState('')
  const [senderName, setSenderName] = useState('')
  const [lines, setLines] = useState<Line[]>([emptyLine(0)])
  // Phần thủ kho — chung cho cả phiếu (SL trả nằm theo từng mã)
  const [returnedAt, setReturnedAt] = useState('')
  const [transferConfirmedBy, setTransferConfirmedBy] = useState('')
  const [issuerName, setIssuerName] = useState('')
  const [repairedBy, setRepairedBy] = useState('')
  const [returnedBy, setReturnedBy] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    nextKey.current = 1
    setReceivedAt(item?.receivedAt ?? vnToday())
    setStage(item?.stage ?? defaults?.stage ?? '')
    setSource(item?.source ?? customerSource ?? defaults?.source ?? '')
    setTicketCode(item?.ticketCode ?? '')
    setSenderName(item?.senderName ?? '')
    setLines([
      item
        ? {
            key: 0,
            productCode: item.productCode ?? '',
            productName: item.productName ?? '',
            qty: String(item.qty),
            content: item.content,
            returnedQty: item.returnedQty != null ? String(item.returnedQty) : '',
          }
        : emptyLine(0),
    ])
    setReturnedAt(item?.returnedAt ?? '')
    setTransferConfirmedBy(item?.transferConfirmedBy ?? '')
    setIssuerName(item?.issuerName ?? '')
    setRepairedBy(item?.repairedBy ?? '')
    setReturnedBy(item?.returnedBy ?? '')
    setReceiverName(item?.receiverName ?? '')
    setNote(item?.note ?? '')
    // defaults (bộ lọc đang chọn) chỉ lấy lúc mở hộp thoại, không theo dõi.
  }, [open, item, customerSource])

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  const addLine = () => setLines((current) => [...current, emptyLine(nextKey.current++)])
  const removeLine = (key: number) => setLines((current) => current.filter((line) => line.key !== key))

  const returnedBeforeReceived = Boolean(returnedAt) && returnedAt < receivedAt
  const ready =
    Boolean(receivedAt) &&
    Boolean(stage) &&
    Boolean(source) &&
    lines.length > 0 &&
    lines.every((line) => lineErrors(line).ok) &&
    !returnedBeforeReceived

  const payloadOf = (line: Line): RepairItemPayload => ({
    receivedAt,
    stage: stage as RepairStage,
    ticketCode: textOrNull(ticketCode),
    productCode: textOrNull(line.productCode),
    productName: textOrNull(line.productName),
    qty: Number(line.qty),
    content: line.content.trim(),
    senderName: textOrNull(senderName),
    ...(keeper
      ? {
          source: source as RepairSource,
          returnedQty: line.returnedQty === '' ? null : Number(line.returnedQty),
          returnedAt: returnedAt || null,
          transferConfirmedBy: textOrNull(transferConfirmedBy),
          issuerName: textOrNull(issuerName),
          repairedBy: textOrNull(repairedBy),
          returnedBy: textOrNull(returnedBy),
          receiverName: textOrNull(receiverName),
          note: textOrNull(note),
        }
      : {}),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (item) {
        await updateRepairItemApi(item.id, payloadOf(lines[0]))
        return 1
      }
      // Một mã vẫn đi đường cũ — BE chưa lên bản có /batch thì vẫn gửi được.
      if (lines.length === 1) {
        await createRepairItemApi(payloadOf(lines[0]))
        return 1
      }
      const rows = await createRepairItemsApi(lines.map(payloadOf))
      return rows.length
    },
    onSuccess: (count) => {
      const suffix = count > 1 ? ` (${count} mã)` : ''
      toast.success(
        item ? 'Đã lưu hàng sửa chữa' : keeper ? `Đã thêm hàng sửa chữa${suffix}` : `Đã gửi hàng sửa chữa${suffix}`,
      )
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

  const multi = lines.length > 1

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
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
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
              label="Số phiếu sửa"
              value={ticketCode}
              onChange={(event) => setTicketCode(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 50 } }}
            />
          </Box>

          {lines.map((line, index) => {
            const errors = lineErrors(line)
            return (
              <Stack
                key={line.key}
                spacing={1.5}
                sx={
                  multi
                    ? { border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, pt: 1 }
                    : undefined
                }
              >
                {multi ? (
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Mã {index + 1}
                    </Typography>
                    <Tooltip title="Bỏ mã này">
                      <IconButton size="small" aria-label={`Bỏ mã ${index + 1}`} onClick={() => removeLine(line.key)}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ) : null}
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: keeper ? { xs: '1fr 1fr', sm: '1.6fr 0.7fr 0.7fr' } : '1.6fr 0.7fr',
                  }}
                >
                  <TextField
                    size="small"
                    label="Mã sản phẩm"
                    value={line.productCode}
                    onChange={(event) => setLine(line.key, { productCode: event.target.value })}
                    error={errors.missingProduct}
                    sx={keeper ? { gridColumn: { xs: '1 / -1', sm: 'auto' } } : undefined}
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                  />
                  <TextField
                    size="small"
                    label="Số lượng"
                    required
                    value={line.qty}
                    onChange={(event) => setLine(line.key, { qty: digitsOf(event.target.value) })}
                    slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                  />
                  {keeper ? (
                    <TextField
                      size="small"
                      label="SL trả"
                      value={line.returnedQty}
                      onChange={(event) => setLine(line.key, { returnedQty: digitsOf(event.target.value) })}
                      error={errors.returnedTooMany}
                      helperText={errors.returnedTooMany ? 'Lớn hơn số lượng' : 'Trống = chưa trả'}
                      slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                    />
                  ) : null}
                </Box>
                <TextField
                  size="small"
                  label="Tên sản phẩm"
                  value={line.productName}
                  onChange={(event) => setLine(line.key, { productName: event.target.value })}
                  error={errors.missingProduct}
                  helperText={errors.missingProduct ? 'Nhập mã sản phẩm hoặc tên sản phẩm' : undefined}
                  slotProps={{ htmlInput: { maxLength: 300 } }}
                />
                <TextField
                  size="small"
                  label="Chi tiết sửa"
                  required
                  placeholder="Vd: Sửa thành size 5 và xi lại"
                  value={line.content}
                  onChange={(event) => setLine(line.key, { content: event.target.value })}
                  multiline
                  slotProps={{ htmlInput: { maxLength: 1000 } }}
                />
              </Stack>
            )
          })}
          {creating ? (
            <Box>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={addLine}
                disabled={lines.length >= MAX_LINES}
              >
                Thêm mã sản phẩm
              </Button>
            </Box>
          ) : null}

          {text('Người gửi sửa', senderName, setSenderName)}

          {keeper ? (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">
                Thủ kho{multi ? ' — ghi chung cho cả phiếu' : ''}
              </Typography>
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <DateField
                  size="small"
                  label="Ngày trả"
                  value={returnedAt}
                  onChange={(next) => setReturnedAt(next ?? '')}
                  error={returnedBeforeReceived}
                  helperText={returnedBeforeReceived ? 'Trước ngày gửi' : undefined}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                {text('Người xác nhận chuyển hàng sửa chữa', transferConfirmedBy, setTransferConfirmedBy)}
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
          {creating && multi ? ` ${lines.length} mã` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
