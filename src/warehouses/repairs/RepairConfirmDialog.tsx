import { useEffect, useState } from 'react'
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
import {
  confirmRepairSlipApi,
  REPAIR_STAGE_LABEL,
  type RepairConfirmShared,
  type RepairItem,
} from '../../api/repairs'
import { DateField } from '../../components/ui'
import { useIsMobile } from '../../hooks/useBreakpoint'

const digitsOf = (raw: string) => raw.replace(/\D/g, '')
const textOrNull = (raw: string) => raw.trim() || null

/** Ngày YYYY-MM-DD → dd/mm/yyyy. */
function fullDate(value: string | null) {
  if (!value) return ''
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Ô thủ kho ghi chung cho cả phiếu. */
type SharedKey = keyof RepairConfirmShared
const SHARED_KEYS: SharedKey[] = [
  'returnedAt',
  'transferConfirmedBy',
  'issuerName',
  'repairedBy',
  'returnedBy',
  'receiverName',
]
const SHARED_LABEL: Record<SharedKey, string> = {
  returnedAt: 'Ngày trả',
  transferConfirmedBy: 'Người xác nhận chuyển hàng sửa chữa',
  issuerName: 'Người lập phiếu',
  repairedBy: 'Người sửa',
  returnedBy: 'Người trả',
  receiverName: 'Người nhận',
}

type SharedState = Record<SharedKey, { value: string; mixed: boolean; touched: boolean }>
type LineState = { returnedQty: string; note: string }

/** Ô chung: các dòng cùng giá trị thì điền sẵn; khác nhau thì để trống, không gõ là giữ của từng dòng. */
function sharedOf(rows: RepairItem[]): SharedState {
  return Object.fromEntries(
    SHARED_KEYS.map((key) => {
      const values = new Set(rows.map((row) => row[key] ?? ''))
      const mixed = values.size > 1
      return [key, { value: mixed ? '' : (rows[0]?.[key] ?? ''), mixed, touched: false }]
    }),
  ) as SharedState
}

/**
 * Thủ kho xác nhận một phiếu sửa — mọi dòng cùng số phiếu sửa (dòng không có số phiếu thì chỉ
 * dòng đó). Ngày trả + các người ký nhập một lần cho cả phiếu; SL trả + note theo từng mã như
 * phiếu giấy. Phần khách gửi chỉ xem ở đây (sửa ở nút Sửa). Lưu là khách hết sửa / xoá các dòng.
 */
export function RepairConfirmDialog({ rows, onClose }: { rows: RepairItem[] | null; onClose: () => void }) {
  const fullScreen = useIsMobile()
  const queryClient = useQueryClient()
  const [shared, setShared] = useState<SharedState>(() => sharedOf([]))
  const [lines, setLines] = useState<Record<string, LineState>>({})

  useEffect(() => {
    if (!rows) return
    setShared(sharedOf(rows))
    setLines(
      Object.fromEntries(
        rows.map((row) => [
          row.id,
          { returnedQty: row.returnedQty != null ? String(row.returnedQty) : '', note: row.note ?? '' },
        ]),
      ),
    )
  }, [rows])

  const setSharedValue = (key: SharedKey, value: string) =>
    setShared((current) => ({ ...current, [key]: { ...current[key], value, touched: true } }))
  const setLine = (id: string, patch: Partial<LineState>) =>
    setLines((current) => ({ ...current, [id]: { ...current[id], ...patch } }))

  const list = rows ?? []
  const first = list[0]
  const returnedAt = shared.returnedAt.value
  // Ngày trả để trống vì các dòng khác nhau thì BE tự kiểm tra từng dòng.
  const returnedBeforeReceived = Boolean(returnedAt) && list.some((row) => returnedAt < row.receivedAt)
  const tooMany = (row: RepairItem) => {
    const raw = lines[row.id]?.returnedQty ?? ''
    return raw !== '' && Number(raw) > row.qty
  }
  const ready = list.length > 0 && !returnedBeforeReceived && !list.some(tooMany)

  const save = useMutation({
    mutationFn: () => {
      const payload: RepairConfirmShared = {}
      for (const key of SHARED_KEYS) {
        const field = shared[key]
        // Các dòng đang khác nhau mà thủ kho không gõ → không gửi, BE giữ giá trị từng dòng.
        if (field.mixed && !field.touched) continue
        payload[key] = key === 'returnedAt' ? field.value || null : textOrNull(field.value)
      }
      return confirmRepairSlipApi({
        ...payload,
        lines: list.map((row) => {
          const line = lines[row.id] ?? { returnedQty: '', note: '' }
          return {
            id: row.id,
            returnedQty: line.returnedQty === '' ? null : Number(line.returnedQty),
            note: textOrNull(line.note),
          }
        }),
      })
    },
    onSuccess: () => {
      toast.success(list.length > 1 ? `Đã xác nhận phiếu (${list.length} mã)` : 'Đã lưu xác nhận của thủ kho')
      void queryClient.invalidateQueries({ queryKey: ['repairs'] })
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const mixedHint = (key: SharedKey) =>
    shared[key].mixed && !shared[key].touched ? 'Các mã đang khác nhau — để trống là giữ nguyên' : undefined

  const sharedText = (key: Exclude<SharedKey, 'returnedAt'>) => (
    <TextField
      key={key}
      size="small"
      label={SHARED_LABEL[key]}
      value={shared[key].value}
      onChange={(event) => setSharedValue(key, event.target.value)}
      helperText={mixedHint(key)}
      slotProps={{ htmlInput: { maxLength: 100 } }}
    />
  )

  return (
    <Dialog open={rows != null} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle>
        Thủ kho xác nhận
        {first?.ticketCode ? ` phiếu ${first.ticketCode}` : ''}
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
              {list.map((row, index) => (
                <Box
                  key={row.id}
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    alignItems: 'start',
                    gridTemplateColumns: { xs: '1fr 1fr', sm: '2.4fr 0.8fr 1.6fr' },
                    pb: 1.5,
                    borderBottom: index < list.length - 1 ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                      {[row.productCode, row.productName].filter(Boolean).join(' · ')} — SL {row.qty}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                      {row.content}
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    label="SL trả"
                    value={lines[row.id]?.returnedQty ?? ''}
                    onChange={(event) => setLine(row.id, { returnedQty: digitsOf(event.target.value) })}
                    error={tooMany(row)}
                    helperText={tooMany(row) ? `Lớn hơn ${row.qty}` : 'Trống = chưa trả'}
                    slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `SL trả ${row.productCode ?? row.productName ?? ''}` } }}
                  />
                  <TextField
                    size="small"
                    label="Note"
                    value={lines[row.id]?.note ?? ''}
                    onChange={(event) => setLine(row.id, { note: event.target.value })}
                    slotProps={{ htmlInput: { maxLength: 1000 } }}
                  />
                </Box>
              ))}
            </Stack>

            <Divider />
            <Typography variant="subtitle2" color="text.secondary">
              Ghi chung{list.length > 1 ? ' cho cả phiếu' : ''}
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <DateField
                size="small"
                label={SHARED_LABEL.returnedAt}
                value={returnedAt}
                onChange={(next) => setSharedValue('returnedAt', next ?? '')}
                error={returnedBeforeReceived}
                helperText={returnedBeforeReceived ? 'Trước ngày gửi' : mixedHint('returnedAt')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {sharedText('transferConfirmedBy')}
              {sharedText('issuerName')}
              {sharedText('repairedBy')}
              {sharedText('returnedBy')}
              {sharedText('receiverName')}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Lưu xác nhận thì khách không sửa / xoá {list.length > 1 ? 'các dòng của phiếu này' : 'dòng này'} được nữa.
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
          Lưu xác nhận
        </Button>
      </DialogActions>
    </Dialog>
  )
}
