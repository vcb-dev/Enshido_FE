import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createScrapReturnApi, getScrapWorkersApi, type ScrapWorker } from '../api/lossReports'
import { STAGE_LABEL } from '../orders/catalog'
import { AutocompleteInput } from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'
import { todayKey, weekLabel, weekStart } from './lossReport'

/**
 * Thủ kho nhận mạt vụn thợ gom cả tuần, cô lại và cân trả. Lưu là nhập kho NVL "Bạc thu hồi / đầu cây
 * S925" và trừ vào hao hụt tuần đó của thợ.
 */
export function ScrapReturnDialog({
  open,
  onClose,
  defaultWeek,
}: {
  open: boolean
  onClose: () => void
  defaultWeek: string
}) {
  const fullScreen = useIsMobile()
  const queryClient = useQueryClient()
  const today = todayKey()
  const workers = useQuery({ queryKey: ['loss-reports', 'workers'], queryFn: getScrapWorkersApi, enabled: open })
  const [worker, setWorker] = useState<ScrapWorker | null>(null)
  const [week, setWeek] = useState(defaultWeek)
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setWorker(null)
    setWeek(defaultWeek)
    setWeight('')
    setNote('')
  }, [open, defaultWeek])

  const weightValue = Number(weight.replace(',', '.'))
  const validWeight = weight.trim() !== '' && Number.isFinite(weightValue) && weightValue > 0
  const save = useMutation({
    mutationFn: () =>
      createScrapReturnApi({
        craftsmanUserId: worker!.id,
        week,
        weightGram: weightValue,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`Đã nhận ${weight} g mạt của ${worker?.fullName ?? ''} — nhập kho NVL bạc thu hồi`)
      void queryClient.invalidateQueries({ queryKey: ['loss-reports', 'weekly'] })
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const stagesOf = (row: ScrapWorker) => row.workerStages.map((stage) => STAGE_LABEL[stage]).join(', ')

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="xs">
      <DialogTitle>Nhận mạt vụn cuối tuần</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Thợ gom mạt cả tuần, cô lại rồi cân trả. Lưu là nhập kho NVL bạc thu hồi và trừ vào hao hụt tuần đã chọn của
            thợ.
          </Typography>
          <AutocompleteInput
            label="Thợ"
            placeholder="Chọn thợ"
            options={workers.data ?? []}
            value={worker}
            onChange={setWorker}
            getOptionLabel={(row) => {
              const stages = stagesOf(row)
              return stages ? `${row.fullName || row.username} · ${stages}` : row.fullName || row.username
            }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText={workers.isLoading ? 'Đang tải…' : 'Không có thợ nào'}
          />
          <TextField
            size="small"
            type="date"
            label="Tuần có ngày"
            value={week}
            onChange={(event) => event.target.value && setWeek(weekStart(event.target.value))}
            helperText={`Tính vào tuần ${weekLabel(week)}`}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
          />
          <TextField
            size="small"
            label="TL mạt sau khi cô (g)"
            value={weight}
            onChange={(event) => setWeight(event.target.value.replace(/[^\d.,]/g, ''))}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
          <TextField
            size="small"
            label="Ghi chú"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button
          variant="contained"
          disabled={!worker || !validWeight || save.isPending}
          onClick={() => save.mutate()}
        >
          Nhận mạt
        </Button>
      </DialogActions>
    </Dialog>
  )
}
