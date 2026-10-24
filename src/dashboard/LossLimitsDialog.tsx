import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getLossLimitsApi,
  LOSS_METAL_LABEL,
  LOSS_STAGE_LABEL,
  updateLossLimitsApi,
  type LossMetal,
  type LossStage,
} from '../api/lossReports'
import { TableSkeleton } from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'

const METALS: LossMetal[] = ['SILVER', 'GOLD']
const key = (stage: LossStage, metal: LossMetal) => `${stage}|${metal}`

/** Mức hao hụt cho phép theo khâu × kim loại. Thủ kho sửa; kế toán chỉ xem. Ô trống = chưa đặt mức. */
export function LossLimitsDialog({ open, onClose, canEdit }: { open: boolean; onClose: () => void; canEdit: boolean }) {
  const fullScreen = useIsMobile()
  const queryClient = useQueryClient()
  const limits = useQuery({ queryKey: ['loss-reports', 'limits'], queryFn: getLossLimitsApi, enabled: open })
  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open || !limits.data) return
    setDraft(Object.fromEntries(limits.data.map((row) => [key(row.stage, row.metal), row.percent ?? ''])))
  }, [open, limits.data])

  const stages = [...new Set(limits.data?.map((row) => row.stage) ?? [])]
  const invalid = Object.values(draft).some((value) => {
    if (value.trim() === '') return false
    const n = Number(value.replace(',', '.'))
    return !Number.isFinite(n) || n < 0 || n > 100
  })

  const save = useMutation({
    mutationFn: () =>
      updateLossLimitsApi(
        (limits.data ?? []).map((row) => {
          const raw = (draft[key(row.stage, row.metal)] ?? '').trim().replace(',', '.')
          return { stage: row.stage, metal: row.metal, percent: raw === '' ? null : Number(raw) }
        }),
      ),
    onSuccess: (rows) => {
      queryClient.setQueryData(['loss-reports', 'limits'], rows)
      void queryClient.invalidateQueries({ queryKey: ['loss-reports', 'weekly'] })
      toast.success('Đã lưu mức hao hụt cho phép')
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle>Mức hao hụt cho phép</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            % trên TL giao của từng khâu. Mô tả luồng: hao bạc cả đơn &lt; 10%, vàng &lt; 5%. Khắc / Xi tài liệu chưa ghi
            mức — Xi đang gánh hao cả chặng Khắc → Xi. Để trống = chưa đặt mức, báo cáo không so vượt. Báo cáo hiện tính
            bạc; mức vàng để sẵn.
          </Typography>
          {limits.isError ? (
            <Alert severity="error">Không tải được mức cho phép: {limits.error.message}</Alert>
          ) : !limits.data ? (
            <TableSkeleton />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Khâu</TableCell>
                  {METALS.map((metal) => (
                    <TableCell key={metal} align="right">
                      {LOSS_METAL_LABEL[metal]} (%)
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {stages.map((stage) => (
                  <TableRow key={stage}>
                    <TableCell>{LOSS_STAGE_LABEL[stage]}</TableCell>
                    {METALS.map((metal) => {
                      const id = key(stage, metal)
                      return (
                        <TableCell key={metal} align="right">
                          {canEdit ? (
                            <TextField
                              size="small"
                              value={draft[id] ?? ''}
                              onChange={(event) =>
                                setDraft((prev) => ({ ...prev, [id]: event.target.value.replace(/[^\d.,]/g, '') }))
                              }
                              placeholder="—"
                              slotProps={{ htmlInput: { inputMode: 'decimal', style: { textAlign: 'right' } } }}
                              sx={{ width: 96 }}
                            />
                          ) : (
                            (draft[id] || '—') + (draft[id] ? '%' : '')
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {invalid ? <Alert severity="warning">Mức cho phép phải từ 0 đến 100.</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{canEdit ? 'Huỷ' : 'Đóng'}</Button>
        {canEdit ? (
          <Button
            variant="contained"
            disabled={!limits.data || invalid || save.isPending}
            onClick={() => save.mutate()}
          >
            Lưu
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}
