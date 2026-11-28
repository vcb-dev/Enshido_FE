import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { keeperPartOf } from './repairKeeperPart'
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
}

const emptyLine = (key: number): Line => ({
  key,
  productCode: '',
  productName: '',
  qty: '1',
  content: '',
})

function lineErrors(line: Line) {
  const missingProduct = line.productCode.trim() === '' && line.productName.trim() === ''
  return {
    missingProduct,
    ok: !missingProduct && Number(line.qty) > 0 && line.content.trim() !== '',
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
 * Khách gửi lên sửa — thêm / sửa phần khách. Thêm mới là một phiếu sửa: ngày, loại hàng, số phiếu
 * sửa, người gửi dùng chung, bấm "+" để gom nhiều mã sản phẩm — lưu ra mỗi mã một dòng cùng số
 * phiếu. Sửa thì chỉ một dòng. Phần thủ kho tách riêng ở RepairConfirmDialog. Khách không chọn
 * VPC / VCB — lấy theo tài khoản; thủ kho nhập hộ thì chọn.
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
          }
        : emptyLine(0),
    ])
    // defaults (bộ lọc đang chọn) chỉ lấy lúc mở hộp thoại, không theo dõi.
  }, [open, item, customerSource])

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  const addLine = () => setLines((current) => [...current, emptyLine(nextKey.current++)])
  const removeLine = (key: number) => setLines((current) => current.filter((line) => line.key !== key))

  // Phần thủ kho đã nhập không có ô ở đây: thủ kho sửa phần khách phải gửi lại nguyên, không thì
  // BE ghi trống. Đổi ngày gửi sang sau ngày trả thì BE báo lỗi.
  const ready =
    Boolean(receivedAt) &&
    Boolean(stage) &&
    Boolean(source) &&
    lines.length > 0 &&
    lines.every((line) => lineErrors(line).ok)

  const payloadOf = (line: Line): RepairItemPayload => ({
    receivedAt,
    stage: stage as RepairStage,
    ticketCode: textOrNull(ticketCode),
    productCode: textOrNull(line.productCode),
    productName: textOrNull(line.productName),
    qty: Number(line.qty),
    content: line.content.trim(),
    senderName: textOrNull(senderName),
    ...(keeper ? { source: source as RepairSource, ...(item ? keeperPartOf(item) : {}) } : {}),
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

  const multi = lines.length > 1

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle>
        {item ? 'Sửa phần khách gửi sửa' : keeper ? 'Khách gửi sửa — thủ kho nhập hộ' : 'Gửi hàng sửa chữa'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
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
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1.6fr 0.7fr' }}>
                  <TextField
                    size="small"
                    label="Mã sản phẩm"
                    value={line.productCode}
                    onChange={(event) => setLine(line.key, { productCode: event.target.value })}
                    error={errors.missingProduct}
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

          <TextField
            size="small"
            label="Người gửi sửa"
            value={senderName}
            onChange={(event) => setSenderName(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <Typography variant="caption" color="text.secondary">
            {keeper
              ? 'Phần thủ kho (SL trả, ngày trả, người ký, note) nhập ở nút Xác nhận trên từng dòng.'
              : 'Sau khi thủ kho nhận hàng thì không sửa / xoá được nữa.'}
          </Typography>
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
