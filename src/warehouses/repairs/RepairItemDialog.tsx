import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'
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
import { downloadXlsx } from '../../dashboard/xlsx'
import { readXlsxRows, XlsxReadError } from '../../dashboard/xlsxRead'
import { parseRepairImport, repairImportTemplate, type ImportedRepairLine } from './repairImport'
import { keeperPartOf } from './repairKeeperPart'
import { useIsMobile } from '../../hooks/useBreakpoint'
import { vnToday } from '../warehousePeriod'

const digitsOf = (raw: string) => raw.replace(/\D/g, '')
const textOrNull = (raw: string) => raw.trim() || null

/** Tối đa số mã trên một phiếu — khớp giới hạn BE. */
const MAX_LINES = 200

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

/** Dòng còn y như lúc thêm (chưa gõ gì) — nhập file thì thay bằng dòng trong file. */
const isBlankLine = (line: Line) =>
  !line.productCode.trim() && !line.productName.trim() && !line.content.trim() && line.qty === '1'

function lineErrors(line: Line) {
  const missingProduct = line.productCode.trim() === '' && line.productName.trim() === ''
  const badQty = !(Number(line.qty) > 0)
  const missingContent = line.content.trim() === ''
  return { missingProduct, badQty, missingContent, ok: !missingProduct && !badQty && !missingContent }
}

const cellInputSx = {
  '& .MuiInputBase-root': { fontSize: 14, bgcolor: 'background.paper' },
  '& .MuiInputBase-input': { py: 0.75, px: 1 },
  // Ô nhiều dòng (Chi tiết sửa): lề nằm ở root — gom về như ô một dòng cho các dòng cao bằng nhau.
  '& .MuiInputBase-multiline': { py: 0.75, px: 1 },
  '& .MuiInputBase-multiline .MuiInputBase-input': { p: 0 },
} as const

type LineField = 'productCode' | 'productName' | 'qty' | 'content'

/**
 * Một dòng của bảng — memo để gõ ở một ô chỉ vẽ lại dòng đó (phiếu tới 200 mã, vẽ lại cả bảng mỗi
 * phím thì gõ bị trễ). onChange / onRemove phải giữ nguyên tham chiếu (useCallback ở hộp thoại).
 */
const RepairLineRow = memo(function RepairLineRow({
  line,
  index,
  onChange,
  onRemove,
}: {
  line: Line
  index: number
  onChange: (key: number, patch: Partial<Line>) => void
  onRemove: (key: number) => void
}) {
  const errors = lineErrors(line)
  const input = (
    field: LineField,
    label: string,
    error: boolean,
    extra: { maxLength?: number; numeric?: boolean; multiline?: boolean } = {},
  ) => (
    <TextField
      size="small"
      hiddenLabel
      fullWidth
      placeholder={label}
      value={line[field]}
      error={error}
      multiline={extra.multiline}
      maxRows={extra.multiline ? 3 : undefined}
      onChange={(event) =>
        onChange(line.key, { [field]: extra.numeric ? digitsOf(event.target.value) : event.target.value })
      }
      slotProps={{
        htmlInput: {
          maxLength: extra.maxLength,
          inputMode: extra.numeric ? 'numeric' : undefined,
          'aria-label': `${label} dòng ${index + 1}`,
          style: extra.numeric ? { textAlign: 'right' } : undefined,
        },
      }}
      sx={cellInputSx}
    />
  )
  return (
    <TableRow sx={{ verticalAlign: 'top' }}>
      <TableCell align="center" sx={{ color: 'text.secondary', pt: 1.5 }}>
        {index + 1}
      </TableCell>
      <TableCell>{input('productCode', 'Mã sản phẩm', errors.missingProduct, { maxLength: 100 })}</TableCell>
      <TableCell>{input('productName', 'Tên sản phẩm', errors.missingProduct, { maxLength: 300 })}</TableCell>
      <TableCell>{input('qty', 'Số lượng', errors.badQty, { numeric: true })}</TableCell>
      <TableCell>{input('content', 'Chi tiết sửa', errors.missingContent, { maxLength: 1000, multiline: true })}</TableCell>
      <TableCell align="center">
        <IconButton size="small" title="Bỏ mã này" aria-label={`Bỏ mã ${index + 1}`} onClick={() => onRemove(line.key)}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  )
})

/**
 * Phiếu nhiều mã (thêm tay hoặc nhập từ file Excel): bảng gọn mỗi mã một dòng, sửa thẳng trên ô.
 * Ô thiếu / sai tô đỏ; đầu bảng đếm số dòng còn thiếu để khách biết vì sao chưa Gửi được.
 */
function RepairLinesTable({
  lines,
  onChange,
  onRemove,
}: {
  lines: Line[]
  onChange: (key: number, patch: Partial<Line>) => void
  onRemove: (key: number) => void
}) {
  const invalid = lines.filter((line) => !lineErrors(line).ok).length

  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" color={invalid ? 'error' : 'text.secondary'} sx={{ fontWeight: 600 }}>
        {lines.length} mã
        {invalid
          ? ` · ${invalid} dòng còn thiếu (mã hoặc tên, số lượng, chi tiết sửa) — ô đỏ`
          : ` · tổng SL ${lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0)}`}
      </Typography>
      <TableContainer
        sx={{ maxHeight: { xs: 'none', sm: '46vh' }, border: 1, borderColor: 'divider', borderRadius: 1 }}
      >
        <Table size="small" stickyHeader sx={{ minWidth: 640, '& td, & th': { px: 0.75 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 32 }} align="center">
                #
              </TableCell>
              <TableCell sx={{ width: 140 }}>Mã sản phẩm</TableCell>
              <TableCell>Tên sản phẩm</TableCell>
              <TableCell sx={{ width: 64 }} align="right">
                SL *
              </TableCell>
              <TableCell sx={{ width: '36%' }}>Chi tiết sửa *</TableCell>
              <TableCell sx={{ width: 36 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((line, index) => (
              <RepairLineRow key={line.key} line={line} index={index} onChange={onChange} onRemove={onRemove} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
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
  const fileInput = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    nextKey.current = 1
    setReceivedAt(item?.receivedAt ?? vnToday())
    setStage(item?.stage ?? defaults?.stage ?? '')
    setSource(item?.source ?? customerSource ?? defaults?.source ?? '')
    setTicketCode(item?.ticketCode ?? '')
    setSenderName(item?.senderName ?? '')
    setImportErrors([])
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

  // useCallback: các dòng bảng memo theo tham chiếu hàm.
  const setLine = useCallback(
    (key: number, patch: Partial<Line>) =>
      setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line))),
    [],
  )
  const addLine = () => setLines((current) => [...current, emptyLine(nextKey.current++)])
  const removeLine = useCallback(
    (key: number) => setLines((current) => current.filter((line) => line.key !== key)),
    [],
  )

  // Khách soạn sẵn file Excel (theo file mẫu) rồi tải lên một lượt — các mã điền vào phiếu để xem
  // lại trước khi bấm Gửi. Tải nhiều file thì cộng dồn; dòng trống đang có thì bỏ.
  const importFile = async (file: File) => {
    setImporting(true)
    setImportErrors([])
    try {
      if (!/\.xlsx$/i.test(file.name)) {
        throw new XlsxReadError('Chỉ nhận file Excel .xlsx — file .xls / .csv thì mở bằng Excel rồi lưu lại dạng .xlsx')
      }
      const { lines: imported, errors } = parseRepairImport(await readXlsxRows(await file.arrayBuffer()))
      if (errors.length) {
        setImportErrors(errors)
        return
      }
      const kept = lines.filter((line) => !isBlankLine(line))
      if (kept.length + imported.length > MAX_LINES) {
        setImportErrors([
          `Một lần gửi tối đa ${MAX_LINES} mã — file có ${imported.length} mã${kept.length ? `, phiếu đang có ${kept.length} mã` : ''}. Chia file ra gửi nhiều lần.`,
        ])
        return
      }
      const toLine = (row: ImportedRepairLine): Line => ({
        key: nextKey.current++,
        productCode: row.productCode,
        productName: row.productName,
        qty: String(row.qty),
        content: row.content,
      })
      setLines([...kept, ...imported.map(toLine)])
      toast.success(`Đã thêm ${imported.length} mã từ file ${file.name}`)
    } catch (error) {
      setImportErrors([
        error instanceof XlsxReadError ? error.message : 'Không đọc được file — mở bằng Excel rồi lưu lại dạng .xlsx',
      ])
    } finally {
      setImporting(false)
    }
  }

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
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth={multi ? "md" : "sm"}>
      <DialogTitle>
        {item ? 'Sửa phần khách gửi sửa' : keeper ? 'Khách gửi sửa — thủ kho nhập hộ' : 'Gửi hàng sửa chữa'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <ChoiceGroup label="Loại hàng" value={stage} options={REPAIR_STAGE_OPTIONS} onChange={setStage} />
            {keeper ? (
              <ChoiceGroup label="Khách hàng" value={source} options={REPAIR_SOURCE_OPTIONS} onChange={setSource} />
            ) : (
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Khách hàng
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

          {multi ? (
            <RepairLinesTable lines={lines} onChange={setLine} onRemove={removeLine} />
          ) : (
            lines.map((line) => {
              const errors = lineErrors(line)
              return (
                <Stack key={line.key} spacing={1.5}>
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
            })
          )}
          {creating ? (
            <Stack spacing={1}>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addLine}
                  disabled={lines.length >= MAX_LINES}
                >
                  Thêm mã sản phẩm
                </Button>
                <Button
                  size="small"
                  startIcon={<UploadFileIcon />}
                  loading={importing}
                  loadingPosition="start"
                  onClick={() => fileInput.current?.click()}
                >
                  Nhập từ file Excel
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<DownloadIcon />}
                  onClick={() => downloadXlsx('mau-gui-hang-sua-chua.xlsx', repairImportTemplate())}
                >
                  Tải file mẫu
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  hidden
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    // Cho chọn lại cùng file sau khi sửa.
                    event.target.value = ''
                    if (file) void importFile(file)
                  }}
                />
              </Stack>
              {importErrors.length ? (
                <Alert severity="error" onClose={() => setImportErrors([])}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Chưa nhập được file — sửa rồi tải lại:
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {importErrors.slice(0, 8).map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                    {importErrors.length > 8 ? <li>… và {importErrors.length - 8} dòng lỗi khác</li> : null}
                  </Box>
                </Alert>
              ) : null}
            </Stack>
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
