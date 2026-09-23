import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Controller, useForm, useWatch } from 'react-hook-form'
import type {
  ProductionOrderDetail,
  StageCode,
  SubTicket,
  SubTicketPayload,
} from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { CrudDialogShell, FormQtyField, FormRow, FormSelect, FormTextField } from '../components/ui'
import { isInStage, STAGE_LABEL, STAGES } from './catalog'

// ---------------------------------------------------------------- Tạo / sửa phiếu con

type TicketValues = { qty: string; silverWeight: string; note: string }

type SplitRow = { qty: string; silverWeight: string; note: string }

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
    const firstQty = Math.floor(order.qty / 2)
    const secondQty = order.qty - firstQty
    const totalSilver = Number(order.silverWeight ?? 0)
    const firstSilver = round4(totalSilver / 2)
    const secondSilver = round4(totalSilver - firstSilver)
    setRows([
      { qty: firstQty > 0 ? String(firstQty) : '', silverWeight: firstSilver > 0 ? String(firstSilver) : '', note: '' },
      { qty: secondQty > 0 ? String(secondQty) : '', silverWeight: secondSilver > 0 ? String(secondSilver) : '', note: '' },
    ])
  }, [open, order.qty, order.silverWeight])

  const update = (index: number, field: keyof SplitRow, value: string) =>
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)))
  const totalQty = rows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const totalSilver = round4(rows.reduce((sum, row) => sum + Number(row.silverWeight || 0), 0))
  const invalidRow = rows.some(
    (row) => !Number.isInteger(Number(row.qty)) || Number(row.qty) < 1 || !(Number(row.silverWeight) > 0),
  )
  // Cả hai vế làm tròn 4 số lẻ như cột Decimal(18,4) ở DB, rồi so đúng như BE so Decimal —
  // dung sai sẽ cho qua những mức mà BE chặn, người dùng bấm Lưu mới biết.
  const invalidTotals =
    totalQty > order.qty ||
    order.silverWeight == null ||
    totalSilver > round4(Number(order.silverWeight))
  const canSubmit = rows.length >= 2 && !invalidRow && !invalidTotals

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Chia đơn {order.code} thành phiếu con</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Chỉ chia khi có từ 2 phần việc trở lên. Nếu một thợ làm toàn bộ đơn, đóng hộp thoại và giao khâu trực
          tiếp trên phiếu mẹ.
        </Alert>
        <Stack spacing={1}>
          {rows.map((row, index) => (
            <Box
              key={index}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: '72px 1fr 1fr 1.5fr auto' },
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
                type="number"
                label="Gram bạc"
                value={row.silverWeight}
                onChange={(event) => update(index, 'silverWeight', event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 'any' } }}
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
                onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
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
            onClick={() => setRows((current) => [...current, { qty: '', silverWeight: '', note: '' }])}
          >
            Thêm phiếu
          </Button>
          <Typography variant="body2" color={invalidTotals ? 'error.main' : 'text.secondary'}>
            Đã chia {totalQty}/{order.qty} sp · {formatQty(String(totalSilver))}/
            {formatQty(order.silverWeight ?? '0')} g bạc
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
                silverWeight: row.silverWeight,
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

/** Phần số lượng / gram còn chưa chia (không tính phiếu đang sửa). */
export function remainingSplit(order: ProductionOrderDetail, exceptId?: string) {
  const others = order.subTickets.filter((ticket) => ticket.id !== exceptId)
  const qty = order.qty - others.reduce((sum, ticket) => sum + ticket.qty, 0)
  const silver =
    order.silverWeight != null
      ? round4(Number(order.silverWeight) - others.reduce((sum, ticket) => sum + Number(ticket.silverWeight), 0))
      : null
  return { qty, silver }
}

/** Chia một phần số lượng + gram bạc của đơn thành phiếu con cho thợ. */
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
  const form = useForm<TicketValues>({ defaultValues: { qty: '', silverWeight: '', note: '' } })
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
        ? { qty: String(ticket.qty), silverWeight: ticket.silverWeight, note: ticket.note ?? '' }
        : {
            // Gợi ý phần còn lại — chia phiếu cuối cùng không phải tự tính.
            qty: remaining.qty > 0 ? String(remaining.qty) : '',
            silverWeight: remaining.silver != null && remaining.silver > 0 ? String(remaining.silver) : '',
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
        onSave({ qty: Number(values.qty), silverWeight: values.silverWeight, note: values.note.trim() })
      }
      saving={saving}
      submitLabel={ticket ? 'Lưu' : 'Tạo phiếu'}
      maxWidth="xs"
      onClose={onClose}
      onExited={onExited}
    >
      <Alert severity="info" sx={{ mt: 1, py: 0 }}>
        Đơn {order.qty} sp · {order.silverWeight != null ? `${formatQty(order.silverWeight)} g bạc` : 'chưa có Tổng TL bạc'}
        <br />
        Còn chưa chia: <b>{remaining.qty} sp</b>
        {remaining.silver != null ? (
          <>
            {' '}
            · <b>{formatQty(String(remaining.silver))} g</b>
          </>
        ) : null}
      </Alert>
      {locked ? (
        <Typography variant="body2" color="text.secondary">
          Phiếu đã giao khâu nên chỉ sửa được ghi chú.
        </Typography>
      ) : null}
      <FormRow columns={2}>
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
        <FormQtyField<TicketValues>
          name="silverWeight"
          label="Gram bạc (g)"
          required
          readOnly={locked}
          rules={{
            validate: (value) => {
              const silver = Number(value)
              if (!(silver > 0)) return 'Gram bạc phải lớn hơn 0'
              if (remaining.silver != null && silver > remaining.silver) {
                return `Còn ${formatQty(String(remaining.silver))} g chưa chia`
              }
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

type OpenStageValues = { stage: StageCode | ''; nos: number[] }

/** Khâu gần nhất phiếu con đã làm; chưa làm thì lấy khâu cả đơn làm trước khi chia phiếu. */
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

export function OpenStageDialog({
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
  onSave: (payload: { stage: StageCode; nos: number[] }) => void
}) {
  const form = useForm<OpenStageValues>({ defaultValues: { stage: '', nos: [] } })
  const { stages, idle, byTicket, skipped } = useMemo(() => openableStages(order), [order])
  const stage = useWatch({ control: form.control, name: 'stage' })
  const eligible = idle.filter((ticket) => stage && byTicket.get(ticket.no)?.includes(stage))

  // Chỉ chọn sẵn phiếu mà khâu này là khâu kế tiếp. Phiếu con đi lệch khâu nhau, nên chọn
  // Khắc cho phiếu đã xong Vào đá thì phiếu mới xong Nguội cũng "mở được" Khắc — tick sẵn nó
  // là để nó âm thầm nhảy cóc Vào đá. Muốn bỏ qua khâu thật thì người dùng tự tick.
  const preselect = (target: StageCode | '') =>
    target
      ? idle
          .filter((ticket) => byTicket.get(ticket.no)?.includes(target) && skipped(ticket.no, target).length === 0)
          .map((ticket) => ticket.no)
      : []

  // Chọn khâu và tick sẵn phiếu chỉ lúc mở hộp thoại và lúc người dùng đổi khâu — không làm
  // lại mỗi lần trang đơn tự làm mới, kẻo xoá mất những ô người dùng vừa tick / bỏ tick.
  const seededStage = useRef<StageCode | '' | null>(null)
  useEffect(() => {
    if (!open) {
      seededStage.current = null
      return
    }
    if (seededStage.current === null) {
      const first = stages[0] ?? ''
      seededStage.current = first
      form.reset({ stage: first, nos: preselect(first) })
      return
    }
    if (!stage || stage === seededStage.current) return
    seededStage.current = stage
    form.setValue('nos', preselect(stage))
  }, [open, stage, stages, idle, byTicket, skipped, form])

  const title = 'Mở khâu cho thợ nhận'

  return (
    <CrudDialogShell<OpenStageValues>
      open={open}
      kind="create"
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={(values) => values.stage && onSave({ stage: values.stage, nos: values.nos })}
      saving={saving}
      submitDisabled={!stage || eligible.length === 0}
      submitLabel="Mở khâu"
      maxWidth="xs"
      onClose={onClose}
      onExited={() => undefined}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Thợ có quyền “Thợ sản xuất” sẽ thấy phiếu ở màn Phiếu của tôi và tự bấm nhận. Người giao cân bạc rồi xác
        nhận giao.
      </Typography>
      <FormRow columns={1}>
        <FormSelect<OpenStageValues>
          name="stage"
          label="Khâu"
          required
          options={stages.map((item) => ({ value: item, label: STAGE_LABEL[item] }))}
        />
      </FormRow>
      <Controller
        control={form.control}
        name="nos"
        rules={{ validate: (value) => value.length > 0 || 'Chọn ít nhất một phiếu con' }}
        render={({ field, fieldState }) => (
          <Stack>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Phiếu con
            </Typography>
            {eligible.map((ticket) => (
              <FormControlLabel
                key={ticket.id}
                control={
                  <Checkbox
                    size="small"
                    checked={field.value.includes(ticket.no)}
                    onChange={(event) =>
                      field.onChange(
                        event.target.checked
                          ? [...field.value, ticket.no]
                          : field.value.filter((no) => no !== ticket.no),
                      )
                    }
                  />
                }
                label={
                  <>
                    {`${ticket.code} · ${ticket.availableQty} sp · ${formatQty(ticket.availableSilver)} g`}
                    {stage && skipped(ticket.no, stage).length ? (
                      <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 0.75 }}>
                        bỏ qua {skipped(ticket.no, stage).map((item) => STAGE_LABEL[item]).join(', ')}
                      </Typography>
                    ) : null}
                  </>
                }
              />
            ))}
            {eligible.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Không có phiếu con nào mở được khâu này.
              </Typography>
            ) : null}
            {fieldState.error ? (
              <Typography variant="caption" color="error">
                {fieldState.error.message}
              </Typography>
            ) : null}
          </Stack>
        )}
      />
    </CrudDialogShell>
  )
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}
