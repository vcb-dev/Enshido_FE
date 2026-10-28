import { useEffect, useState } from 'react'
import {
  Box,
  Button,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createScrapReturnApi,
  getScrapWorkersApi,
  LOSS_METAL_LABEL,
  type LossMetal,
  type ScrapWorker,
} from '../api/lossReports'
import {
  GOLD_METAL_TYPES,
  ORDER_METAL_TYPE_LABELS,
  type OrderMetalType,
  recoveredMaterialName,
} from '../api/intakeOrders'
import { STAGE_LABEL } from '../orders/catalog'
import { AutocompleteInput, TrashIcon } from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'
import { todayKey, weekLabel, weekStart } from './lossReport'

/**
 * Thủ kho nhận mạt vụn thợ gom cả tuần, cô lại và cân trả — một lần nhập được cho nhiều thợ, cùng một
 * kim loại. Mỗi dòng là một phiếu: lưu là nhập kho NVL "Bạc thu hồi / đầu cây S925" (bạc) hoặc
 * "Vàng <tuổi> thu hồi" (vàng, chọn tuổi) và trừ vào hao hụt tuần đó của thợ ở báo cáo kim loại đó.
 */
type Row = { key: number; worker: ScrapWorker | null; weight: string; note: string }

let rowKey = 0
const newRow = (): Row => ({ key: ++rowKey, worker: null, weight: '', note: '' })
const weightOf = (row: Row) => Number(row.weight.replace(',', '.'))
const validWeight = (row: Row) => row.weight.trim() !== '' && Number.isFinite(weightOf(row)) && weightOf(row) > 0

export function ScrapReturnDialog({
  open,
  onClose,
  defaultWeek,
  defaultMetal,
}: {
  open: boolean
  onClose: () => void
  defaultWeek: string
  defaultMetal: LossMetal
}) {
  const fullScreen = useIsMobile()
  const queryClient = useQueryClient()
  const today = todayKey()
  const workers = useQuery({ queryKey: ['loss-reports', 'workers'], queryFn: getScrapWorkersApi, enabled: open })
  const [week, setWeek] = useState(defaultWeek)
  const [metal, setMetal] = useState(defaultMetal)
  const [goldType, setGoldType] = useState<OrderMetalType | null>(null)
  const [rows, setRows] = useState<Row[]>([newRow()])
  const metalLabel = LOSS_METAL_LABEL[metal].toLowerCase()
  const isGold = metal === 'GOLD'
  const materialName = isGold ? (goldType ? recoveredMaterialName(goldType) : null) : recoveredMaterialName(null)

  useEffect(() => {
    if (!open) return
    setWeek(defaultWeek)
    setMetal(defaultMetal)
    setGoldType(null)
    setRows([newRow()])
  }, [open, defaultWeek, defaultMetal])

  const patch = (key: number, change: Partial<Row>) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...change } : row)))

  const complete = rows.filter((row) => row.worker && validWeight(row))
  // Dòng có nhập dở (thiếu thợ hoặc TL không hợp lệ) chặn lưu để không bỏ sót mạt của ai.
  const half = rows.filter((row) => (row.worker || row.weight.trim() !== '') && !(row.worker && validWeight(row)))
  const total = complete.reduce((sum, row) => sum + weightOf(row), 0)

  const save = useMutation({
    mutationFn: async () => {
      // Mỗi dòng một phiếu nhập kho; dòng nào lưu xong thì gỡ khỏi form, lỗi thì dừng để sửa rồi lưu tiếp.
      const saved: number[] = []
      try {
        for (const row of complete) {
          await createScrapReturnApi({
            craftsmanUserId: row.worker!.id,
            week,
            metal,
            goldType: isGold ? goldType! : undefined,
            weightGram: weightOf(row),
            note: row.note.trim() || undefined,
          })
          saved.push(row.key)
        }
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { saved })
      }
      return saved
    },
    onSuccess: (saved) => {
      toast.success(`Đã nhận mạt ${metalLabel} của ${saved.length} thợ — nhập kho NVL "${materialName}"`)
      void queryClient.invalidateQueries({ queryKey: ['loss-reports', 'weekly'] })
      onClose()
    },
    onError: (error: Error & { saved?: number[] }) => {
      const saved = error.saved ?? []
      if (saved.length) {
        setRows((prev) => prev.filter((row) => !saved.includes(row.key)))
        void queryClient.invalidateQueries({ queryKey: ['loss-reports', 'weekly'] })
        toast.error(`Đã lưu ${saved.length} thợ, các dòng còn lại chưa lưu: ${error.message}`)
      } else {
        toast.error(error.message)
      }
    },
  })

  const stagesOf = (row: ScrapWorker) => row.workerStages.map((stage) => STAGE_LABEL[stage]).join(', ')

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle>Nhận mạt vụn cuối tuần</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Thợ gom mạt cả tuần, cô lại rồi cân trả. Nhập được nhiều thợ một lần; lưu là nhập kho NVL
            {materialName ? ` "${materialName}"` : ' vàng thu hồi đúng tuổi'} và trừ vào hao hụt {metalLabel} tuần đã
            chọn của từng thợ.
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={metal}
            onChange={(_, value: LossMetal | null) => value && setMetal(value)}
          >
            <ToggleButton value="SILVER">Mạt {LOSS_METAL_LABEL.SILVER.toLowerCase()}</ToggleButton>
            <ToggleButton value="GOLD">Mạt {LOSS_METAL_LABEL.GOLD.toLowerCase()}</ToggleButton>
          </ToggleButtonGroup>
          {isGold ? (
            <Box>
              <Typography variant="caption" color={goldType ? 'text.secondary' : 'error'} sx={{ display: 'block', mb: 0.5 }}>
                Tuổi vàng (bắt buộc) — mỗi tuổi nhập một mã NVL thu hồi
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={goldType}
                onChange={(_, value: OrderMetalType | null) => value && setGoldType(value)}
              >
                {GOLD_METAL_TYPES.map((type) => (
                  <ToggleButton key={type} value={type}>
                    {ORDER_METAL_TYPE_LABELS[type]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          ) : null}
          <TextField
            size="small"
            type="date"
            label="Tuần có ngày"
            value={week}
            onChange={(event) => event.target.value && setWeek(weekStart(event.target.value))}
            helperText={`Tính vào tuần ${weekLabel(week)}`}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
          />
          {rows.map((row, index) => {
            const taken = new Set(rows.filter((other) => other.key !== row.key).map((other) => other.worker?.id))
            return (
              <Box
                key={row.key}
                sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1, position: 'relative' }}
              >
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                    <AutocompleteInput
                      label={`Thợ ${index + 1}`}
                      placeholder="Chọn thợ"
                      options={(workers.data ?? []).filter((option) => !taken.has(option.id))}
                      value={row.worker}
                      onChange={(worker) => patch(row.key, { worker })}
                      getOptionLabel={(option) => {
                        const stages = stagesOf(option)
                        return stages
                          ? `${option.fullName || option.username} · ${stages}`
                          : option.fullName || option.username
                      }}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      noOptionsText={workers.isLoading ? 'Đang tải…' : 'Không có thợ nào'}
                    />
                    <Tooltip title="Bỏ dòng này">
                      <span>
                        <IconButton
                          size="small"
                          disabled={rows.length === 1}
                          onClick={() => setRows((prev) => prev.filter((other) => other.key !== row.key))}
                          sx={{ mt: 0.5 }}
                        >
                          <TrashIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                  <Stack spacing={1.25}>
                    <TextField
                      size="small"
                      label="Trọng lượng mạt vụn thu hồi (sau khi cô lại) (g)"
                      value={row.weight}
                      onChange={(event) => patch(row.key, { weight: event.target.value.replace(/[^\d.,]/g, '') })}
                      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                    />
                    <TextField
                      size="small"
                      label="Ghi chú"
                      value={row.note}
                      onChange={(event) => patch(row.key, { note: event.target.value })}
                      slotProps={{ htmlInput: { maxLength: 500 } }}
                    />
                  </Stack>
                </Stack>
              </Box>
            )
          })}
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Button size="small" onClick={() => setRows((prev) => [...prev, newRow()])}>
              + Thêm thợ
            </Button>
            <Typography variant="body2" color="text.secondary">
              {complete.length} thợ · tổng <b>{Number(total.toFixed(4)).toLocaleString('vi-VN')} g</b>
            </Typography>
          </Stack>
          {half.length ? (
            <Typography variant="caption" color="error">
              {half.length} dòng chưa đủ thợ hoặc trọng lượng mạt vụn — nhập đủ hoặc bỏ dòng đó.
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button
          variant="contained"
          disabled={complete.length === 0 || half.length > 0 || (isGold && !goldType) || save.isPending}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          {complete.length > 1 ? `Nhận mạt ${metalLabel} (${complete.length} thợ)` : `Nhận mạt ${metalLabel}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
