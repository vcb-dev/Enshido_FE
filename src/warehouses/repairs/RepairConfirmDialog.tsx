import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  confirmRepairSlipApi,
  REPAIR_STAGE_LABEL,
  type RepairConfirmShared,
  type RepairItem,
} from '../../api/repairs'
import { DateField } from '../../components/ui'
import { useIsMobile } from '../../hooks/useBreakpoint'
import { vnToday } from '../warehousePeriod'

const digitsOf = (raw: string) => raw.replace(/\D/g, '')
const textOrNull = (raw: string) => raw.trim() || null

/** Ngày YYYY-MM-DD → dd/mm/yyyy. */
function fullDate(value: string | null) {
  if (!value) return ''
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/**
 * Hai bước của thủ kho, theo đúng lúc biết thông tin:
 * - `receive` — nhận hàng khách gửi: người xác nhận chuyển hàng sửa chữa, người lập phiếu, note;
 * - `return` — sửa xong trả hàng: ngày trả, SL trả từng mã, người sửa, người trả, người nhận.
 */
export type RepairConfirmMode = 'receive' | 'return'

type SharedKey = keyof RepairConfirmShared
const MODE_KEYS: Record<RepairConfirmMode, SharedKey[]> = {
  receive: ['transferConfirmedBy', 'issuerName'],
  return: ['returnedAt', 'repairedBy', 'returnedBy', 'receiverName'],
}
const SHARED_LABEL: Record<SharedKey, string> = {
  returnedAt: 'Ngày trả',
  transferConfirmedBy: 'Người xác nhận chuyển hàng sửa chữa',
  issuerName: 'Người lập phiếu',
  repairedBy: 'Người sửa',
  returnedBy: 'Người trả',
  receiverName: 'Người nhận (người lấy hàng)',
}

type Field = { value: string; mixed: boolean; touched: boolean }
type SharedState = Partial<Record<SharedKey, Field>>
type LineState = { selected: boolean; returnedQty: string; note: string }

const MIXED_HINT = 'Các mã đang khác nhau — để trống là giữ nguyên'

/** Ô chung: các dòng cùng giá trị thì điền sẵn; khác nhau thì để trống, không gõ là giữ của từng dòng. */
function sharedOf(rows: RepairItem[], mode: RepairConfirmMode): SharedState {
  return Object.fromEntries(
    MODE_KEYS[mode].map((key) => {
      const values = new Set(rows.map((row) => row[key] ?? ''))
      const mixed = values.size > 1
      let value = mixed ? '' : (rows[0]?.[key] ?? '')
      // Trả hàng thường là hôm nay.
      if (key === 'returnedAt' && !mixed && !value) value = vnToday()
      return [key, { value, mixed, touched: false }]
    }),
  )
}

/** Trả hàng: mặc định tick các mã chưa trả đủ; cả phiếu đã trả hết (sửa lại) thì tick hết. */
function defaultReturnRows(rows: RepairItem[]) {
  const pending = rows.filter((row) => row.status !== 'RETURNED')
  return pending.length > 0 ? pending : rows
}

function linesOf(rows: RepairItem[]): Record<string, LineState> {
  const picked = new Set(defaultReturnRows(rows).map((row) => row.id))
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        selected: picked.has(row.id),
        returnedQty: String(row.returnedQty ?? row.qty),
        note: row.note ?? '',
      },
    ]),
  )
}

/**
 * Thủ kho xác nhận một phiếu sửa — mọi dòng cùng số phiếu sửa (dòng không có số phiếu thì chỉ
 * dòng đó), tách hai bước Nhận hàng / Trả hàng. Ô chung nhập một lần cho cả phiếu; SL trả và note
 * theo từng mã như phiếu giấy. Trả hàng chỉ ghi các mã được tick — mã chưa sửa xong để lần sau.
 */
export function RepairConfirmDialog({
  rows,
  mode,
  onClose,
}: {
  rows: RepairItem[] | null
  mode: RepairConfirmMode
  onClose: () => void
}) {
  const fullScreen = useIsMobile()
  const queryClient = useQueryClient()
  const [shared, setShared] = useState<SharedState>({})
  const [lines, setLines] = useState<Record<string, LineState>>({})

  useEffect(() => {
    if (!rows) return
    // Trả đợt sau: ô chung điền theo các mã sắp trả, không lẫn ngày / người của mã đã trả trước.
    setShared(sharedOf(mode === 'return' ? defaultReturnRows(rows) : rows, mode))
    setLines(linesOf(rows))
  }, [rows, mode])

  const receive = mode === 'receive'
  const list = rows ?? []
  const first = list[0]
  const field = (key: SharedKey): Field => shared[key] ?? { value: '', mixed: false, touched: false }
  const setSharedValue = (key: SharedKey, value: string) =>
    setShared((current) => ({ ...current, [key]: { ...field(key), value, touched: true } }))
  const setLine = (id: string, patch: Partial<LineState>) =>
    setLines((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  /** Ô chung không gửi: các dòng khác nhau mà thủ kho không gõ — BE giữ của từng dòng. */
  const keeps = (key: SharedKey) => field(key).mixed && !field(key).touched

  const picked = receive ? list : list.filter((row) => lines[row.id]?.selected)
  const returnedAt = field('returnedAt').value
  const returnedBeforeReceived =
    !receive && Boolean(returnedAt) && picked.some((row) => returnedAt < row.receivedAt)
  const lineError = (row: RepairItem) => {
    if (receive || !lines[row.id]?.selected) return null
    const raw = lines[row.id]?.returnedQty ?? ''
    if (raw === '') return 'Nhập SL trả'
    return Number(raw) > row.qty ? `Lớn hơn ${row.qty}` : null
  }
  // Nhận hàng phải ghi ít nhất một người, không thì dòng vẫn "Chờ thủ kho nhận".
  const receiveNamed = MODE_KEYS.receive.some((key) => keeps(key) || field(key).value.trim() !== '')
  const ready = receive
    ? list.length > 0 && receiveNamed
    : picked.length > 0 && returnedAt !== '' && !returnedBeforeReceived && !picked.some(lineError)

  const save = useMutation({
    mutationFn: () => {
      const payload: RepairConfirmShared = {}
      for (const key of MODE_KEYS[mode]) {
        if (keeps(key)) continue
        payload[key] = key === 'returnedAt' ? field(key).value || null : textOrNull(field(key).value)
      }
      return confirmRepairSlipApi({
        ...payload,
        lines: picked.map((row) => {
          const line = lines[row.id]
          return receive
            ? { id: row.id, note: textOrNull(line?.note ?? '') }
            : { id: row.id, returnedQty: Number(line?.returnedQty ?? 0), note: textOrNull(line?.note ?? '') }
        }),
      })
    },
    onSuccess: () => {
      const count = picked.length > 1 ? ` (${picked.length} mã)` : ''
      toast.success(receive ? `Đã nhận hàng sửa${count}` : `Đã ghi trả hàng${count}`)
      void queryClient.invalidateQueries({ queryKey: ['repairs'] })
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const sharedText = (key: SharedKey) => (
    <TextField
      key={key}
      size="small"
      label={SHARED_LABEL[key]}
      value={field(key).value}
      onChange={(event) => setSharedValue(key, event.target.value)}
      helperText={keeps(key) ? MIXED_HINT : undefined}
      slotProps={{ htmlInput: { maxLength: 100 } }}
    />
  )

  const title = receive ? 'Thủ kho nhận hàng sửa' : 'Trả hàng sửa xong'

  return (
    <Dialog open={rows != null} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle>
        {title}
        {first?.ticketCode ? ` — phiếu ${first.ticketCode}` : ''}
        {list.length > 1 ? ` (${list.length} mã)` : ''}
      </DialogTitle>
      <DialogContent dividers>
        {first ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Khách gửi ngày {fullDate(first.receivedAt)} · Hàng {first.source} · {REPAIR_STAGE_LABEL[first.stage]}
              {first.senderName ? ` · Người gửi: ${first.senderName}` : ''}
            </Typography>

            <Stack spacing={1.5}>
              {list.map((row, index) => {
                const line = lines[row.id]
                const off = !receive && !line?.selected
                const error = lineError(row)
                const label = [row.productCode, row.productName].filter(Boolean).join(' · ')
                return (
                  <Box
                    key={row.id}
                    sx={{
                      display: 'grid',
                      gap: 1.5,
                      alignItems: 'start',
                      gridTemplateColumns: receive
                        ? { xs: '1fr', sm: '2.4fr 1.6fr' }
                        : { xs: '1fr 1fr', sm: '2.4fr 0.8fr 1.6fr' },
                      pb: 1.5,
                      borderBottom: index < list.length - 1 ? 1 : 0,
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ gridColumn: receive ? 'auto' : { xs: '1 / -1', sm: 'auto' }, minWidth: 0 }}>
                      {receive ? (
                        <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                          {label} — SL {row.qty}
                        </Typography>
                      ) : (
                        <FormControlLabel
                          sx={{ m: 0, alignItems: 'flex-start' }}
                          control={
                            <Checkbox
                              size="small"
                              checked={Boolean(line?.selected)}
                              onChange={(event) => setLine(row.id, { selected: event.target.checked })}
                              slotProps={{ input: { 'aria-label': `Trả lần này ${label}` } }}
                              sx={{ p: 0.5, mr: 0.5 }}
                            />
                          }
                          label={
                            <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word', pt: 0.5 }}>
                              {label} — SL {row.qty}
                              {row.status === 'RETURNED' ? ' · đã trả' : ''}
                            </Typography>
                          }
                        />
                      )}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', wordBreak: 'break-word', pl: receive ? 0 : 4 }}
                      >
                        {row.content}
                      </Typography>
                    </Box>
                    {receive ? null : (
                      <TextField
                        size="small"
                        label="SL trả"
                        disabled={off}
                        value={line?.returnedQty ?? ''}
                        onChange={(event) => setLine(row.id, { returnedQty: digitsOf(event.target.value) })}
                        error={Boolean(error)}
                        helperText={error ?? (off ? 'Chưa trả lần này' : undefined)}
                        slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `SL trả ${label}` } }}
                      />
                    )}
                    <TextField
                      size="small"
                      label="Note"
                      disabled={off}
                      value={line?.note ?? ''}
                      onChange={(event) => setLine(row.id, { note: event.target.value })}
                      slotProps={{ htmlInput: { maxLength: 1000, 'aria-label': `Note ${label}` } }}
                    />
                  </Box>
                )
              })}
            </Stack>

            <Divider />
            <Typography variant="subtitle2" color="text.secondary">
              Ghi chung{list.length > 1 ? (receive ? ' cho cả phiếu' : ' cho các mã trả lần này') : ''}
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {receive ? (
                MODE_KEYS.receive.map(sharedText)
              ) : (
                <>
                  <DateField
                    size="small"
                    label="Ngày trả"
                    required
                    value={returnedAt}
                    onChange={(next) => setSharedValue('returnedAt', next ?? '')}
                    error={returnedBeforeReceived}
                    helperText={returnedBeforeReceived ? 'Trước ngày gửi' : returnedAt === '' ? 'Chọn ngày trả' : undefined}
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: vnToday() } }}
                  />
                  {sharedText('repairedBy')}
                  {sharedText('returnedBy')}
                  {sharedText('receiverName')}
                </>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {receive
                ? 'Nhận hàng thì khách không sửa / xoá các dòng này được nữa. Sửa xong mới ghi trả hàng (ngày trả, người sửa, người lấy hàng).'
                : 'Mã chưa sửa xong thì bỏ tick — ghi trả lần sau.'}
            </Typography>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button
          variant="contained"
          disabled={!ready || save.isPending}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          {receive ? 'Xác nhận nhận hàng' : `Ghi trả hàng${picked.length > 1 ? ` (${picked.length} mã)` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
