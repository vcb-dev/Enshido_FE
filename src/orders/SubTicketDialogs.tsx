import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { listNvlOptionsApi, type NvlOption } from '../api/productionOrders'
import AddIcon from '@mui/icons-material/Add'
import { createFilterOptions } from '@mui/material/Autocomplete'
import type {
  ProductionOrderDetail,
  StageCode,
  SubTicket,
  SubTicketPayload,
} from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { CrudDialogShell, FormRow, FormSelect, FormTextField, TrashIcon } from '../components/ui'
import { isInStage, STAGE_LABEL, STAGES } from './catalog'
import { evenSplit } from './evenSplit'

// ---------------------------------------------------------------- Tạo / sửa phiếu con

type TicketValues = { qty: string; note: string }

type SplitRow = { qty: string; note: string }

/** Chia lần đầu thành ít nhất hai phiếu; lưu nguyên khối để không bao giờ sinh một phiếu lẻ. */
export function SplitSubTicketsDialog({
  open,
  order,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  order: ProductionOrderDetail
  saving: boolean
  onClose: () => void
  onSave: (tickets: SubTicketPayload[]) => void
}) {
  const [rows, setRows] = useState<SplitRow[]>([])
  const seeded = useRef(false)

  useEffect(() => {
    if (!open) {
      seeded.current = false
      return
    }
    if (seeded.current) return
    seeded.current = true
    setRows(evenSplit(order.qty, 2).map((qty) => ({ qty: qty > 0 ? String(qty) : '', note: '' })))
  }, [open, order.qty])

  /** Thêm / xoá phiếu thì chia đều lại số lượng cho mọi phiếu (giữ ghi chú); người dùng chỉnh sau. */
  const resplit = (next: SplitRow[]) =>
    evenSplit(order.qty, next.length).map((qty, index) => ({
      note: next[index].note,
      qty: qty > 0 ? String(qty) : '',
    }))

  const update = (index: number, field: keyof SplitRow, value: string) =>
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)))
  const totalQty = rows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const invalidRow = rows.some((row) => !Number.isInteger(Number(row.qty)) || Number(row.qty) < 1)
  const invalidTotals = totalQty > order.qty
  const canSubmit = rows.length >= 2 && !invalidRow && !invalidTotals

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Chia đơn {order.code} thành phiếu con</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Chỉ chia khi có từ 2 phần việc trở lên. Nếu một thợ làm toàn bộ đơn, đóng hộp thoại và giao khâu trực
          tiếp trên phiếu mẹ. Phiếu con chỉ chia số lượng — bạc / đá thợ xin xuất dần trong lúc làm.
        </Alert>
        <Stack spacing={1}>
          {rows.map((row, index) => (
            <Box
              key={index}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: '72px 1fr 1.5fr auto' },
                gap: 1,
                alignItems: 'start',
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700, pt: 1.25 }}>
                Phiếu {index + 1}
              </Typography>
              <TextField
                size="small"
                type="number"
                label="Số lượng"
                value={row.qty}
                onChange={(event) => update(index, 'qty', event.target.value)}
                slotProps={{ htmlInput: { min: 1 } }}
              />
              <TextField
                size="small"
                label="Ghi chú"
                value={row.note}
                onChange={(event) => update(index, 'note', event.target.value)}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
              <Button
                size="small"
                color="error"
                disabled={rows.length <= 2}
                onClick={() => setRows((current) => resplit(current.filter((_, rowIndex) => rowIndex !== index)))}
                sx={{ mt: 0.5 }}
              >
                Xóa
              </Button>
            </Box>
          ))}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.25, justifyContent: 'space-between' }}>
          <Button
            size="small"
            // Mỗi phiếu ít nhất 1 sp nên không thêm quá số lượng đơn.
            disabled={rows.length >= order.qty}
            onClick={() => setRows((current) => resplit([...current, { qty: '', note: '' }]))}
          >
            Thêm phiếu
          </Button>
          <Typography variant="body2" color={invalidTotals ? 'error.main' : 'text.secondary'}>
            Đã chia {totalQty}/{order.qty} sp
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button
          variant="contained"
          disabled={!canSubmit}
          loading={saving}
          onClick={() =>
            onSave(
              rows.map((row) => ({
                qty: Number(row.qty),
                note: row.note.trim() || undefined,
              })),
            )
          }
        >
          Tạo {rows.length} phiếu
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Phần số lượng còn chưa chia (không tính phiếu đang sửa). */
export function remainingSplit(order: ProductionOrderDetail, exceptId?: string) {
  const others = order.subTickets.filter((ticket) => ticket.id !== exceptId)
  return { qty: order.qty - others.reduce((sum, ticket) => sum + ticket.qty, 0) }
}

/** Chia một phần số lượng của đơn thành phiếu con cho thợ. */
export function SubTicketFormDialog({
  open,
  order,
  ticket,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  order: ProductionOrderDetail
  /** null = tạo phiếu mới. */
  ticket: SubTicket | null
  saving: boolean
  onClose: () => void
  onExited: () => void
  onSave: (payload: SubTicketPayload) => void
}) {
  const form = useForm<TicketValues>({ defaultValues: { qty: '', note: '' } })
  const remaining = useMemo(() => remainingSplit(order, ticket?.id), [order, ticket])

  // Nạp form một lần mỗi lần mở. Trang đơn tự làm mới định kỳ; `remaining` đổi theo mỗi lần
  // có ai đó đổi đơn, nạp lại theo nó là xoá mất số người dùng đang gõ.
  const seeded = useRef(false)
  useEffect(() => {
    if (!open) {
      seeded.current = false
      return
    }
    if (seeded.current) return
    seeded.current = true
    form.reset(
      ticket
        ? { qty: String(ticket.qty), note: ticket.note ?? '' }
        : {
            // Gợi ý phần còn lại — chia phiếu cuối cùng không phải tự tính.
            qty: remaining.qty > 0 ? String(remaining.qty) : '',
            note: '',
          },
    )
  }, [open, ticket, remaining, form])

  const locked = Boolean(ticket && ticket.entryCount > 0)
  const title = ticket ? `Sửa phiếu con ${ticket.code}` : `Tạo phiếu con cho đơn ${order.code}`

  return (
    <CrudDialogShell<TicketValues>
      open={open}
      kind={ticket ? 'edit' : 'create'}
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={(values) =>
        onSave({ qty: Number(values.qty), note: values.note.trim() })
      }
      saving={saving}
      submitLabel={ticket ? 'Lưu' : 'Tạo phiếu'}
      maxWidth="xs"
      onClose={onClose}
      onExited={onExited}
    >
      <Alert severity="info" sx={{ mt: 1, py: 0 }}>
        Đơn {order.qty} sp · còn chưa chia: <b>{remaining.qty} sp</b>
      </Alert>
      {locked ? (
        <Typography variant="body2" color="text.secondary">
          Phiếu đã giao khâu nên chỉ sửa được ghi chú.
        </Typography>
      ) : null}
      <FormRow columns={1}>
        <FormTextField<TicketValues>
          name="qty"
          label="Số lượng (sp)"
          type="number"
          required
          readOnly={locked}
          rules={{
            validate: (value) => {
              const qty = Number(value)
              if (!Number.isInteger(qty) || qty < 1) return 'Số lượng phải từ 1'
              if (qty > remaining.qty) return `Còn ${remaining.qty} sp chưa chia`
              return true
            },
          }}
        />
      </FormRow>
      <FormTextField<TicketValues> name="note" label="Ghi chú" multiline minRows={2} maxRows={5} />
    </CrudDialogShell>
  )
}

// ---------------------------------------------------------------- Mở khâu cho thợ nhận

function lastStageOf(order: ProductionOrderDetail, ticket: SubTicket): StageCode | null {
  const own = order.stages.filter((entry) => entry.subTicketId === ticket.id)
  const last = own.at(-1) ?? order.stages.filter((entry) => !entry.subTicketId).at(-1)
  return last?.stage ?? null
}

/**
 * Các khâu mở được cho từng phiếu con đang rảnh — không lùi khâu trừ khi đơn đang làm lại.
 * Mỗi phiếu đi khâu của riêng nó: phiếu xong trước thì mở khâu sau luôn, không đợi các phiếu
 * còn đang làm khâu cũ (khớp luật ở BE).
 */
export function openableStages(order: ProductionOrderDetail) {
  const reworking = !isInStage(order.status)
  const idle = order.subTickets.filter((ticket) => ticket.state === 'IDLE')
  const byTicket = new Map<number, StageCode[]>()
  const lastBy = new Map<number, StageCode | null>()
  for (const ticket of idle) {
    const last = lastStageOf(order, ticket)
    lastBy.set(ticket.no, last)
    byTicket.set(
      ticket.no,
      !last || reworking ? STAGES : STAGES.filter((stage) => STAGES.indexOf(stage) > STAGES.indexOf(last)),
    )
  }
  const stages = STAGES.filter((stage) => idle.some((ticket) => byTicket.get(ticket.no)?.includes(stage)))
  /** Các khâu phiếu này sẽ bị bỏ qua nếu mở `stage` — rỗng nghĩa là đúng khâu kế tiếp. */
  const skipped = (no: number, stage: StageCode): StageCode[] => {
    const last = lastBy.get(no)
    if (!last || reworking) return []
    return STAGES.filter(
      (item) => STAGES.indexOf(item) > STAGES.indexOf(last) && STAGES.indexOf(item) < STAGES.indexOf(stage),
    )
  }
  return { stages, idle, byTicket, skipped }
}

type StoneLineValues = { materialId: string; stoneCount: string; weight: string }
type AssignValues = { stage: StageCode | ''; craftsmanUserId: string; stones: StoneLineValues[] }

/** Tìm theo mã hoặc tên đá — gõ "moiss 4.0" hay "MROW" đều ra. */
const STONE_FILTER = createFilterOptions<NvlOption>({
  stringify: (option) => `${option.sku ?? ''} ${option.name}`,
})

const EMPTY_STONE_LINE: StoneLineValues = { materialId: '', stoneCount: '', weight: '' }

/**
 * Thủ kho chỉ định thợ cho một khâu của phiếu con. Chưa giao hàng: thợ quét QR bấm nhận —
 * Nguội tự xuất phôi, Vào đá tự xuất BTP đã nguội. Khâu Vào đá kèm đá cấp cho thợ: chỉ giữ
 * chỗ trong tồn, xuất kho khi thủ kho xác nhận sau KCS (số cấp − đá thừa trả lại).
 * Khâu khác người giao cân bạc rồi bấm "Xác nhận giao".
 */
export function AssignWorkerDialog({
  open,
  ticket,
  stageOptions,
  workers,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  ticket: SubTicket | null
  stageOptions: StageCode[]
  workers: Array<{ id: string; username: string; fullName: string }>
  saving: boolean
  onClose: () => void
  onSave: (payload: {
    ticket: SubTicket
    stage: StageCode
    craftsmanUserId: string
    stones: Array<{ materialId: string; stoneCount: number; weight: string | null }>
  }) => void
}) {
  const form = useForm<AssignValues>({ defaultValues: { stage: '', craftsmanUserId: '', stones: [] } })
  const stones = useFieldArray({ control: form.control, name: 'stones' })
  const stage = useWatch({ control: form.control, name: 'stage' })
  const stoneStage = stage === 'STONE_SETTING'
  const nvl = useQuery({
    queryKey: ['nvl-options'],
    queryFn: () => listNvlOptionsApi(),
    enabled: open && stoneStage,
    staleTime: 60_000,
  })
  useEffect(() => {
    if (open) form.reset({ stage: stageOptions[0] ?? '', craftsmanUserId: '', stones: [] })
  }, [open, stageOptions, form])
  // Vào đá luôn có ít nhất một dòng đá để thủ kho điền.
  useEffect(() => {
    if (stoneStage && stones.fields.length === 0) stones.append({ ...EMPTY_STONE_LINE })
  }, [stoneStage, stones])
  const lines = useWatch({ control: form.control, name: 'stones' }) ?? []
  /** Mã tính theo ct / gram thì thủ kho nhập thêm TL để quy ra số lượng; mã tính theo viên chỉ cần số viên. */
  const byUnit = (index: number) => {
    const unit = (nvl.data ?? []).find((item) => item.id === lines[index]?.materialId)?.unit
    return unit && !['viên', 'vien'].includes(unit.trim().toLowerCase()) ? unit : null
  }
  const title = ticket ? `Chỉ định thợ · phiếu ${ticket.code}` : 'Chỉ định thợ'

  return (
    <CrudDialogShell<AssignValues>
      open={open}
      kind="create"
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={(values) =>
        ticket &&
        values.stage &&
        onSave({
          ticket,
          stage: values.stage,
          craftsmanUserId: values.craftsmanUserId,
          stones:
            values.stage === 'STONE_SETTING'
              ? values.stones.map((line) => ({
                  materialId: line.materialId,
                  stoneCount: Number(line.stoneCount),
                  weight: line.weight || null,
                }))
              : [],
        })
      }
      saving={saving}
      submitLabel="Chỉ định"
      maxWidth="sm"
      onClose={onClose}
      onExited={() => undefined}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Thợ được chỉ định thấy phiếu ở màn Phiếu của tôi, quét QR và bấm nhận hàng. Nguội tự xuất phôi khỏi kho BTP,
        Vào đá tự xuất BTP đã nguội.
      </Typography>
      <FormRow columns={1}>
        <FormSelect<AssignValues>
          name="stage"
          label="Khâu"
          required
          options={stageOptions.map((item) => ({ value: item, label: STAGE_LABEL[item] }))}
        />
      </FormRow>
      <FormRow columns={1}>
        <FormSelect<AssignValues>
          name="craftsmanUserId"
          label="Thợ"
          required
          options={workers.map((worker) => ({ value: worker.id, label: worker.fullName || worker.username }))}
        />
      </FormRow>
      {stoneStage ? (
        <Stack spacing={1.25}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Đá cấp cho thợ
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Chỉ giữ chỗ trong tồn, chưa xuất kho. Thủ kho xác nhận sau KCS thì xuất = số cấp − đá thừa trả lại.
            </Typography>
          </Box>
          {stones.fields.map((field, index) => (
            <Paper key={field.id} variant="outlined" sx={{ p: 1.25, bgcolor: 'background.default' }}>
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Controller
                    control={form.control}
                    name={`stones.${index}.materialId`}
                    rules={{ required: 'Chọn mã đá' }}
                    render={({ field: input, fieldState }) => (
                      <Autocomplete<NvlOption>
                        fullWidth
                        size="small"
                        options={nvl.data ?? []}
                        loading={nvl.isLoading}
                        value={(nvl.data ?? []).find((item) => item.id === input.value) ?? null}
                        onChange={(_, option) => input.onChange(option?.id ?? '')}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        getOptionLabel={(option) => [option.sku, option.name].filter(Boolean).join(' · ')}
                        filterOptions={STONE_FILTER}
                        noOptionsText="Không có mã đá phù hợp"
                        loadingText="Đang tải…"
                        renderOption={(props, option) => {
                          const { key, ...rest } = props
                          return (
                            <Box component="li" key={key} {...rest} sx={{ display: 'block !important', py: '6px !important' }}>
                              <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {option.sku ?? '—'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                  Tồn {formatQty(option.qty)} {option.unit}
                                </Typography>
                              </Stack>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {option.name}
                              </Typography>
                            </Box>
                          )
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Mã đá"
                            required
                            error={Boolean(fieldState.error)}
                            helperText={fieldState.error?.message}
                          />
                        )}
                        slotProps={{ listbox: { sx: { maxHeight: 320 } } }}
                      />
                    )}
                  />
                  <Tooltip title={stones.fields.length === 1 ? 'Phải có ít nhất một dòng đá' : 'Bỏ dòng đá'}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label="Bỏ dòng đá"
                        disabled={stones.fields.length === 1}
                        onClick={() => stones.remove(index)}
                      >
                        <TrashIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                <FormRow columns={2}>
                  <FormTextField<AssignValues>
                    name={`stones.${index}.stoneCount` as 'stones'}
                    label="Số viên"
                    type="number"
                    required
                    slotProps={{ htmlInput: { min: 1, step: 1 } }}
                  />
                  {byUnit(index) ? (
                    <FormTextField<AssignValues>
                      name={`stones.${index}.weight` as 'stones'}
                      label="TL (g)"
                      type="number"
                      required
                      helperText={`Mã tính theo ${byUnit(index)} — nhập TL của số viên cấp`}
                    />
                  ) : null}
                </FormRow>
              </Stack>
            </Paper>
          ))}
          <Box>
            <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={() => stones.append({ ...EMPTY_STONE_LINE })}>
              Thêm mã đá
            </Button>
          </Box>
        </Stack>
      ) : null}
    </CrudDialogShell>
  )
}
