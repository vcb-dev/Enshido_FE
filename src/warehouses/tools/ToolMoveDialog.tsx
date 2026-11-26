import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatMoney, formatQty, getWarehouseStockApi } from '../../api/inventory'
import {
  createToolMoveApi,
  getToolHoldingsApi,
  getToolWorkersApi,
  TOOL_MOVE_HINT,
  TOOL_MOVE_KINDS,
  TOOL_MOVE_LABEL,
  TOOL_REASON_REQUIRED,
  toolMoveSides,
  type ToolMoveKind,
  type ToolWorker,
} from '../../api/tools'
import { AutocompleteInput, DateField } from '../../components/ui'
import { useIsMobile } from '../../hooks/useBreakpoint'
import { vnToday } from '../warehousePeriod'
import { invalidateToolQueries, TOOL_WAREHOUSE_CODE } from './toolQueries'

export type ToolMoveDraft = {
  kind: ToolMoveKind
  fromWorkerId?: string
  toWorkerId?: string
  materialId?: string
}

type ToolOption = {
  id: string
  sku: string | null
  name: string
  unitName: string
  /** Tồn kho (xuất) hoặc SL thợ giao đang giữ (các loại khác). */
  available: number
  /** Giá trị phần thợ đang giữ — để hiện ước tính giá trị phiếu. */
  heldAmount?: number
}

const qtyOf = (raw: string) => Number(raw.replace(',', '.'))

/**
 * Thủ kho ghi một phiếu dụng cụ. Xuất: chọn dụng cụ còn tồn kho; các loại khác: chọn trong dụng cụ
 * thợ giao đang giữ (không cho vượt số đang giữ).
 */
export function ToolMoveDialog({
  open,
  onClose,
  draft,
}: {
  open: boolean
  onClose: () => void
  draft: ToolMoveDraft
}) {
  const fullScreen = useIsMobile()
  const queryClient = useQueryClient()
  const today = vnToday()
  const [kind, setKind] = useState<ToolMoveKind>(draft.kind)
  const [movedAt, setMovedAt] = useState(today)
  const [fromWorker, setFromWorker] = useState<ToolWorker | null>(null)
  const [toWorker, setToWorker] = useState<ToolWorker | null>(null)
  const [tool, setTool] = useState<ToolOption | null>(null)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const sides = toolMoveSides(kind)

  const workers = useQuery({ queryKey: ['tools', 'workers'], queryFn: getToolWorkersApi, enabled: open })
  const stock = useQuery({
    queryKey: ['warehouse-stock', TOOL_WAREHOUSE_CODE, 'all'],
    queryFn: () => getWarehouseStockApi(TOOL_WAREHOUSE_CODE),
    enabled: open && kind === 'ISSUE',
  })
  const holdings = useQuery({
    queryKey: ['tools', 'holdings', fromWorker?.id ?? ''],
    queryFn: () => getToolHoldingsApi(fromWorker?.id),
    enabled: open && sides.from && Boolean(fromWorker),
  })

  useEffect(() => {
    if (!open) return
    setKind(draft.kind)
    setMovedAt(vnToday())
    setTool(null)
    setQty('')
    setNote('')
  }, [open, draft])

  // Mở từ một dòng thợ ở tab Xuất: chọn sẵn thợ khi danh sách thợ về.
  useEffect(() => {
    if (!open) return
    setFromWorker(workers.data?.find((worker) => worker.id === draft.fromWorkerId) ?? null)
    setToWorker(workers.data?.find((worker) => worker.id === draft.toWorkerId && worker.isActive) ?? null)
  }, [open, draft, workers.data])

  const toolOptions = useMemo<ToolOption[]>(() => {
    if (kind === 'ISSUE') {
      return (stock.data?.items ?? [])
        .filter((row) => Number(row.qty) > 0)
        .map((row) => ({
          id: row.id,
          sku: row.sku,
          name: row.name,
          unitName: row.unit,
          available: Number(row.qty),
        }))
    }
    return (holdings.data ?? []).map((row) => ({
      id: row.materialId,
      sku: row.sku,
      name: row.name,
      unitName: row.unitName,
      available: Number(row.qty),
      heldAmount: Number(row.amount),
    }))
  }, [kind, stock.data, holdings.data])

  // Chọn sẵn dụng cụ khi mở từ dòng thợ; đổi loại / thợ mà dụng cụ không còn trong danh sách thì bỏ chọn.
  useEffect(() => {
    if (!open) return
    setTool((current) => {
      const wanted = current?.id ?? draft.materialId
      return toolOptions.find((option) => option.id === wanted) ?? null
    })
  }, [open, toolOptions, draft.materialId])

  const qtyNumber = qtyOf(qty)
  const qtyValid = qty.trim() !== '' && Number.isFinite(qtyNumber) && qtyNumber > 0
  const overAvailable = Boolean(tool && qtyValid && qtyNumber > tool.available)
  const needsReason = TOOL_REASON_REQUIRED.includes(kind)
  const sameWorker = kind === 'TRANSFER' && fromWorker && toWorker && fromWorker.id === toWorker.id
  const ready =
    Boolean(tool) &&
    qtyValid &&
    !overAvailable &&
    (!sides.from || Boolean(fromWorker)) &&
    (!sides.to || Boolean(toWorker)) &&
    !sameWorker &&
    (!needsReason || note.trim() !== '') &&
    Boolean(movedAt)

  const estimate =
    tool?.heldAmount != null && qtyValid && !overAvailable
      ? qtyNumber === tool.available
        ? tool.heldAmount
        : Math.round((tool.heldAmount * qtyNumber) / tool.available)
      : null

  const save = useMutation({
    mutationFn: () =>
      createToolMoveApi({
        kind,
        movedAt,
        materialId: tool!.id,
        fromWorkerId: sides.from ? fromWorker?.id : null,
        toWorkerId: sides.to ? toWorker?.id : null,
        qty: String(qtyNumber),
        note: note.trim() || null,
      }),
    onSuccess: (row) => {
      toast.success(`Đã ghi phiếu ${row.code} — ${row.kindLabel.toLowerCase()} ${formatQty(row.qty)} ${row.material.unitName} ${row.material.name}`)
      invalidateToolQueries(queryClient)
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const activeWorkers = (workers.data ?? []).filter((worker) => worker.isActive)
  const workerLabel = (worker: ToolWorker) => (worker.isActive ? worker.name : `${worker.name} (đã nghỉ)`)
  const toolLabel = (option: ToolOption) =>
    `${option.sku ? `${option.sku} — ` : ''}${option.name} · ${kind === 'ISSUE' ? 'tồn' : 'đang giữ'} ${formatQty(String(option.available))} ${option.unitName}`

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle>Ghi phiếu dụng cụ</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={kind}
            onChange={(_, value: ToolMoveKind | null) => value && setKind(value)}
            sx={{ flexWrap: 'wrap' }}
          >
            {TOOL_MOVE_KINDS.map((option) => (
              <ToggleButton key={option} value={option}>
                {TOOL_MOVE_LABEL[option]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="body2" color="text.secondary">
            {TOOL_MOVE_HINT[kind]}
          </Typography>
          <DateField
            size="small"
            label="Ngày"
            value={movedAt}
            onChange={(next) => next && setMovedAt(next)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
          />
          {sides.from ? (
            <AutocompleteInput
              label={kind === 'TRANSFER' ? 'Thợ giao' : 'Thợ'}
              placeholder="Chọn thợ đang giữ dụng cụ"
              options={workers.data ?? []}
              value={fromWorker}
              onChange={setFromWorker}
              getOptionLabel={workerLabel}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText={workers.isLoading ? 'Đang tải…' : 'Không có thợ nào'}
            />
          ) : null}
          {sides.to ? (
            <AutocompleteInput
              label={kind === 'TRANSFER' ? 'Thợ nhận' : 'Xuất cho thợ'}
              placeholder="Chọn thợ"
              options={activeWorkers.filter((worker) => worker.id !== fromWorker?.id)}
              value={toWorker}
              onChange={setToWorker}
              getOptionLabel={workerLabel}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText={workers.isLoading ? 'Đang tải…' : 'Không có thợ nào'}
            />
          ) : null}
          <AutocompleteInput
            label="Dụng cụ"
            placeholder={
              sides.from && !fromWorker ? 'Chọn thợ trước' : kind === 'ISSUE' ? 'Chọn dụng cụ còn tồn' : 'Chọn dụng cụ thợ đang giữ'
            }
            disabled={sides.from && !fromWorker}
            options={toolOptions}
            value={tool}
            onChange={setTool}
            getOptionLabel={toolLabel}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            loading={kind === 'ISSUE' ? stock.isLoading : holdings.isLoading}
            noOptionsText={
              kind === 'ISSUE' ? 'Kho dụng cụ chưa có dụng cụ nào còn tồn' : 'Thợ này không giữ dụng cụ nào'
            }
          />
          <TextField
            size="small"
            label={tool ? `Số lượng (${tool.unitName})` : 'Số lượng'}
            value={qty}
            onChange={(event) => setQty(event.target.value.replace(/[^\d.,]/g, ''))}
            error={overAvailable}
            helperText={
              overAvailable
                ? `Vượt số ${kind === 'ISSUE' ? 'tồn kho' : 'thợ đang giữ'} (${formatQty(String(tool!.available))} ${tool!.unitName})`
                : estimate != null
                  ? `Giá trị theo bình quân thợ đang giữ: ${formatMoney(String(estimate))} đ`
                  : kind === 'ISSUE'
                    ? 'Giá trị tính theo FIFO lúc xuất kho'
                    : undefined
            }
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
          <TextField
            size="small"
            label={needsReason ? 'Lý do (bắt buộc)' : 'Ghi chú'}
            value={note}
            required={needsReason}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={needsReason ? 2 : 1}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          {sameWorker ? <Alert severity="warning">Thợ nhận phải khác thợ giao.</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="contained" disabled={!ready || save.isPending} loading={save.isPending} onClick={() => save.mutate()}>
          Ghi phiếu {TOOL_MOVE_LABEL[kind].toLowerCase()}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
