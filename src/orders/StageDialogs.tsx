import { useEffect, useMemo } from 'react'
import { Alert, Box, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import type {
  CastingPayload,
  HandoverPayload,
  ReturnPayload,
  StageCode,
  StageEntry,
} from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import {
  CrudDialogShell,
  FormMoneyField,
  FormQtyField,
  FormRow,
  FormSearchSelect,
  FormSelect,
  FormTextField,
  TextInput,
} from '../components/ui'
import { useOperatorName } from '../hooks/useOperatorName'
import { formatDateShort, fromDateTimeInput, STAGE_LABEL, toDateTimeInput } from './catalog'

type Users = Array<{ id: string; username: string; fullName: string }>

const DATE_LABEL = { inputLabel: { shrink: true } }

function nowInput() {
  return toDateTimeInput(new Date().toISOString())
}

// ---------------------------------------------------------------- Giao thợ

type HandoverValues = {
  stage: StageCode | ''
  craftsmanUserId: string
  handedAt: string
  handedTotalWeight: string
  handedSilverWeight: string
  note: string
}

export type HandoverDialogState =
  | {
      mode: 'start'
      stages: StageCode[]
      /** TL nhận lại của khâu trước — thường chính là TL giao khâu sau. */
      defaults: { total: string | null; silver: string | null }
    }
  | { mode: 'edit'; entry: StageEntry }

/** Giao khâu cho thợ. Người giao là tài khoản đang đăng nhập. */
export function HandoverDialog({
  open,
  state,
  users,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  state: HandoverDialogState | null
  users: Users
  saving: boolean
  onClose: () => void
  onExited: () => void
  onSave: (payload: HandoverPayload & { stage?: StageCode }) => void
}) {
  const operatorName = useOperatorName()
  const form = useForm<HandoverValues>({
    defaultValues: {
      stage: '',
      craftsmanUserId: '',
      handedAt: '',
      handedTotalWeight: '',
      handedSilverWeight: '',
      note: '',
    },
  })

  useEffect(() => {
    if (!open || !state) return
    if (state.mode === 'start') {
      form.reset({
        stage: state.stages[0] ?? '',
        craftsmanUserId: '',
        handedAt: nowInput(),
        handedTotalWeight: state.defaults.total ?? '',
        handedSilverWeight: state.defaults.silver ?? '',
        note: '',
      })
    } else {
      const { entry } = state
      form.reset({
        stage: entry.stage,
        craftsmanUserId: entry.craftsmanUserId ?? '',
        handedAt: toDateTimeInput(entry.handedAt),
        handedTotalWeight: entry.handedTotalWeight ?? '',
        handedSilverWeight: entry.handedSilverWeight ?? '',
        note: entry.note ?? '',
      })
    }
  }, [open, state, form])

  const starting = state?.mode === 'start'
  const title = starting
    ? 'Giao khâu cho thợ'
    : `Sửa thông tin giao — ${state ? STAGE_LABEL[state.entry.stage] : ''}`

  function submit(values: HandoverValues) {
    onSave({
      ...(starting && values.stage ? { stage: values.stage } : null),
      craftsmanUserId: values.craftsmanUserId,
      handedAt: fromDateTimeInput(values.handedAt) ?? new Date().toISOString(),
      handedTotalWeight: values.handedTotalWeight || null,
      handedSilverWeight: values.handedSilverWeight,
      note: values.note.trim(),
    })
  }

  return (
    <CrudDialogShell<HandoverValues>
      open={open}
      kind={starting ? 'create' : 'edit'}
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitLabel={starting ? 'Giao thợ' : 'Lưu'}
      maxWidth="sm"
      onClose={onClose}
      onExited={onExited}
    >
      <FormRow columns={2} sx={{ mt: 1 }}>
        {starting ? (
          <FormSelect<HandoverValues>
            name="stage"
            label="Khâu"
            required
            options={state.stages.map((stage) => ({ value: stage, label: STAGE_LABEL[stage] }))}
          />
        ) : (
          <TextInput label="Khâu" value={state ? STAGE_LABEL[state.entry.stage] : ''} readOnly />
        )}
        <TextInput
          label="Người giao"
          value={state?.mode === 'edit' ? state.entry.handedByName : operatorName}
          readOnly
        />
      </FormRow>

      <FormRow columns={2}>
        <FormSearchSelect<HandoverValues>
          name="craftsmanUserId"
          label="Người chế tác (thợ)"
          options={users.map((user) => ({ id: user.id, name: user.fullName, secondary: user.username }))}
          required
          displayValue={state?.mode === 'edit' ? state.entry.craftsmanName : undefined}
          placeholder="Tìm tài khoản…"
        />
        <FormTextField<HandoverValues>
          name="handedAt"
          label="Thời gian giao"
          type="datetime-local"
          required
          slotProps={DATE_LABEL}
        />
      </FormRow>

      <FormRow columns={2}>
        <FormQtyField<HandoverValues> name="handedTotalWeight" label="Trọng lượng giao — tổng (g)" />
        <FormQtyField<HandoverValues>
          name="handedSilverWeight"
          label="Trọng lượng giao — bạc (g)"
          required
        />
      </FormRow>

      <FormTextField<HandoverValues> name="note" label="Ghi chú" multiline minRows={2} maxRows={6} />
    </CrudDialogShell>
  )
}

// ---------------------------------------------------------------- KCS nhận lại

type ReturnValues = {
  returnedAt: string
  laborCost: string
  returnedTotalWeight: string
  returnedSilverWeight: string
  btpRecoveredWeight: string
  silverRecoveredWeight: string
  note: string
}

/** KCS nhận lại hàng từ thợ và cân lại bạc. Người KCS là tài khoản đang đăng nhập. */
export function KcsReturnDialog({
  entry,
  saving,
  onClose,
  onSave,
}: {
  entry: StageEntry | null
  saving: boolean
  onClose: () => void
  onSave: (payload: ReturnPayload) => void
}) {
  const operatorName = useOperatorName()
  const form = useForm<ReturnValues>({
    defaultValues: {
      returnedAt: '',
      laborCost: '',
      returnedTotalWeight: '',
      returnedSilverWeight: '',
      btpRecoveredWeight: '',
      silverRecoveredWeight: '',
      note: '',
    },
  })

  useEffect(() => {
    if (!entry) return
    form.reset({
      returnedAt: nowInput(),
      laborCost: '',
      returnedTotalWeight: '',
      returnedSilverWeight: '',
      btpRecoveredWeight: '',
      silverRecoveredWeight: '',
      note: '',
    })
  }, [entry, form])

  const [returnedSilver, btp, silverRecovered] = useWatch({
    control: form.control,
    name: ['returnedSilverWeight', 'btpRecoveredWeight', 'silverRecoveredWeight'],
  })
  const loss = useMemo(() => {
    if (!entry?.handedSilverWeight || !returnedSilver) return null
    const handed = Number(entry.handedSilverWeight)
    const value = handed - Number(returnedSilver) - (Number(btp) || 0) - (Number(silverRecovered) || 0)
    return { value, percent: handed > 0 ? (value / handed) * 100 : null }
  }, [entry, returnedSilver, btp, silverRecovered])

  const title = `KCS nhận lại — ${entry ? STAGE_LABEL[entry.stage] : ''}`

  function submit(values: ReturnValues) {
    onSave({
      returnedAt: fromDateTimeInput(values.returnedAt) ?? new Date().toISOString(),
      laborCost: values.laborCost || null,
      returnedTotalWeight: values.returnedTotalWeight || null,
      returnedSilverWeight: values.returnedSilverWeight,
      btpRecoveredWeight: values.btpRecoveredWeight || null,
      silverRecoveredWeight: values.silverRecoveredWeight || null,
      note: values.note.trim(),
    })
  }

  return (
    <CrudDialogShell<ReturnValues>
      open={entry != null}
      kind="create"
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitLabel="Nhận lại"
      maxWidth="sm"
      onClose={onClose}
      onExited={() => undefined}
    >
      {entry ? (
        <Box sx={{ mt: 1, p: 1.25, bgcolor: '#f4f6f7', borderRadius: 1 }}>
          <Typography variant="body2">
            Thợ <b>{entry.craftsmanName}</b> · giao lúc {formatDateShort(entry.handedAt)} bởi {entry.handedByName}
          </Typography>
          <Typography variant="body2">
            TL giao: tổng <b>{entry.handedTotalWeight ? formatQty(entry.handedTotalWeight) : '—'}</b> g · bạc{' '}
            <b>{entry.handedSilverWeight ? formatQty(entry.handedSilverWeight) : '—'}</b> g
          </Typography>
        </Box>
      ) : null}

      <FormRow columns={2}>
        <TextInput label="Người KCS" value={operatorName} readOnly />
        <FormTextField<ReturnValues>
          name="returnedAt"
          label="Thời gian nhận lại"
          type="datetime-local"
          required
          slotProps={DATE_LABEL}
          rules={{
            validate: (value) =>
              !entry ||
              !value ||
              new Date(value) >= new Date(toDateTimeInput(entry.handedAt)) ||
              'Không được trước thời gian giao',
          }}
        />
      </FormRow>

      <FormRow columns={2}>
        <FormQtyField<ReturnValues> name="returnedTotalWeight" label="Trọng lượng nhận lại — tổng (g)" />
        <FormQtyField<ReturnValues>
          name="returnedSilverWeight"
          label="Trọng lượng nhận lại — bạc (g)"
          required
        />
      </FormRow>

      <FormRow columns={2}>
        <FormQtyField<ReturnValues> name="btpRecoveredWeight" label="BTP thu hồi (g)" />
        <FormQtyField<ReturnValues> name="silverRecoveredWeight" label="Bạc S925 thu hồi (g)" />
      </FormRow>

      {loss ? (
        <Alert severity={loss.value < 0 ? 'warning' : 'info'} sx={{ py: 0 }}>
          Hao hụt bạc: <b>{formatQty(loss.value.toFixed(4))} g</b>
          {loss.percent != null ? ` (${loss.percent.toFixed(2)}%)` : ''}
          {loss.value < 0 ? ' — bạc nhận lại nhiều hơn bạc giao, kiểm tra lại số cân' : ''}
        </Alert>
      ) : null}

      <FormRow columns={2}>
        <FormMoneyField<ReturnValues> name="laborCost" label="Tiền công khâu (đ)" />
      </FormRow>

      <FormTextField<ReturnValues> name="note" label="Ghi chú" multiline minRows={2} maxRows={6} />
    </CrudDialogShell>
  )
}

// ---------------------------------------------------------------- Đúc

type CastingValues = { sentDate: string; returnedDate: string }

/** Báo Đúc (đơn chuyển sang Đúc, từ đây mới in phiếu thợ) và ghi ngày Đúc về. */
export function CastingDialog({
  open,
  sentDate,
  returnedDate,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  sentDate: string | null
  returnedDate: string | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CastingPayload) => void
}) {
  const form = useForm<CastingValues>({ defaultValues: { sentDate: '', returnedDate: '' } })

  useEffect(() => {
    if (!open) return
    form.reset({ sentDate: sentDate ?? new Date().toISOString().slice(0, 10), returnedDate: returnedDate ?? '' })
  }, [open, sentDate, returnedDate, form])

  const title = sentDate ? 'Cập nhật Đúc' : 'Báo Đúc'

  return (
    <CrudDialogShell<CastingValues>
      open={open}
      kind={sentDate ? 'edit' : 'create'}
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={(values) => onSave({ sentDate: values.sentDate, returnedDate: values.returnedDate || null })}
      saving={saving}
      submitLabel="Lưu"
      maxWidth="xs"
      onClose={onClose}
      onExited={() => undefined}
    >
      {sentDate ? null : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Báo Đúc chuyển đơn sang trạng thái Đúc. Từ bước này mới in được phiếu cho thợ.
        </Typography>
      )}
      <FormRow columns={2} sx={{ mt: 1 }}>
        <FormTextField<CastingValues>
          name="sentDate"
          label="Ngày báo Đúc"
          type="date"
          required
          slotProps={DATE_LABEL}
        />
        <FormTextField<CastingValues>
          name="returnedDate"
          label="Ngày Đúc về"
          type="date"
          slotProps={DATE_LABEL}
          rules={{
            validate: (value, values) =>
              !value || !values.sentDate || value >= values.sentDate || 'Không được trước ngày báo Đúc',
          }}
        />
      </FormRow>
    </CrudDialogShell>
  )
}
