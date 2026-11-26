import { useEffect } from 'react'
import { Alert, Typography } from '@mui/material'
import { useWatch } from 'react-hook-form'
import { useAppForm } from '../components/ui/form/useAppForm'
import type { SkipStagesPayload, StageCode, SubTicketState } from '../api/productionOrders'
import { CrudDialogShell, FormRow, FormSelect, FormTextField } from '../components/ui'
import { isSelfTakeStage, skipTargetLabel, STAGE_LABEL, STAGES, type SkipTargetCode } from './catalog'

/** Phiếu chuyển khâu được khi chưa giao hàng cho thợ: rảnh, chờ thợ nhận, hoặc đã chỉ định nhưng thợ chưa nhận. */
const SKIPPABLE_STATES: SubTicketState[] = ['IDLE', 'WAITING', 'CLAIMED']

export type SkipPlan = {
  /** Khâu phiếu đang chờ — khâu đầu tiên bị bỏ qua. */
  from: StageCode
  /** Các khâu chuyển tới được (sau `from`), và nhập thẳng kho thành phẩm khi phiếu đã giao khâu. */
  targets: SkipTargetCode[]
}

/**
 * Phiếu đang chờ khâu nào và chuyển tới được những khâu nào — khớp `skipStages` ở BE. Null khi
 * phiếu không chuyển khâu được (thợ đang giữ hàng, chờ QC / thủ kho, đã chốt, qua Xi).
 */
export function skipPlan(input: {
  state: SubTicketState
  pendingStage: StageCode | null
  skippedStages: readonly StageCode[]
  /** Khâu gần nhất đã giao của phiếu (phiếu con chưa làm khâu nào thì lấy của phiếu mẹ). */
  lastStage: StageCode | null
  skipStone: boolean
  /**
   * Phiếu đã có lượt khâu của chính nó — mới nhập thẳng kho thành phẩm được (chưa giao khâu nào
   * thì hàng còn trong kho BTP). Khớp `skipStages` ở BE.
   */
  hasOwnEntries?: boolean
}): SkipPlan | null {
  if (!SKIPPABLE_STATES.includes(input.state)) return null
  const allowed = (stage: StageCode) => !(input.skipStone && stage === 'STONE_SETTING')
  const after = input.lastStage ? STAGES.indexOf(input.lastStage) + 1 : 0
  const from =
    input.pendingStage ??
    STAGES.slice(after).find((stage) => allowed(stage) && !input.skippedStages.includes(stage)) ??
    null
  if (!from) return null
  const targets: SkipTargetCode[] = STAGES.slice(STAGES.indexOf(from) + 1).filter(allowed)
  if (input.hasOwnEntries) targets.push('FINISHED')
  return targets.length > 0 ? { from, targets } : null
}

/** Các khâu sẽ bị bỏ qua khi chuyển từ `from` sang `target`. */
function skippedBetween(from: StageCode, target: SkipTargetCode, skipStone: boolean) {
  const end = target === 'FINISHED' ? STAGES.length : STAGES.indexOf(target)
  return STAGES.slice(STAGES.indexOf(from), end).filter((stage) => !(skipStone && stage === 'STONE_SETTING'))
}

type Values = { stage: SkipTargetCode | ''; note: string }

/**
 * Thủ kho / admin "Chuyển khâu": phiếu đang chờ khâu nào thì bỏ qua từ khâu đó tới trước khâu
 * chọn. Khắc / Đánh bóng / Xi mở luôn cho thợ tự nhận; Vào đá chờ thủ kho chỉ định thợ.
 */
export function SkipStagesDialog({
  open,
  ticketCode,
  plan,
  pendingAssigned,
  skipStone,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  ticketCode: string
  plan: SkipPlan | null
  /** Phiếu đang chỉ định thợ / chờ thợ nhận — chuyển khâu sẽ huỷ lượt đó. */
  pendingAssigned: boolean
  skipStone: boolean
  saving: boolean
  onClose: () => void
  onSave: (payload: SkipStagesPayload) => void
}) {
  const form = useAppForm<Values>({ defaultValues: { stage: '', note: '' } })
  const stage = useWatch({ control: form.control, name: 'stage' })
  useEffect(() => {
    if (open) form.reset({ stage: plan?.targets[0] ?? '', note: '' })
  }, [open, plan, form])
  const skipped = plan && stage ? skippedBetween(plan.from, stage, skipStone) : []
  const title = `Chuyển khâu · phiếu ${ticketCode}`

  return (
    <CrudDialogShell<Values>
      open={open}
      kind="create"
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={(values) => values.stage && onSave({ stage: values.stage, note: values.note.trim() })}
      saving={saving}
      submitDisabled={!plan || !stage}
      submitLabel="Chuyển khâu"
      pendingLabel="Đang chuyển…"
      maxWidth="sm"
      onClose={onClose}
      onExited={() => undefined}
    >
      {plan ? (
        <Typography variant="body2">
          Phiếu đang chờ: <b>{STAGE_LABEL[plan.from]}</b>
        </Typography>
      ) : null}
      <FormRow columns={1}>
        <FormSelect<Values>
          name="stage"
          label="Chuyển sang khâu"
          required
          options={(plan?.targets ?? []).map((value) => ({ value, label: skipTargetLabel(value) }))}
        />
      </FormRow>
      <FormTextField<Values>
        name="note"
        label="Lý do"
        required
        multiline
        minRows={2}
        maxRows={5}
        rules={{ validate: (value) => value.trim().length > 0 || 'Ghi lý do chuyển khâu' }}
      />
      {stage && skipped.length > 0 ? (
        <Alert severity="warning">
          Bỏ qua khâu <b>{skipped.map((item) => STAGE_LABEL[item]).join(', ')}</b> — không giao thợ, không tính
          hao hụt.{' '}
          {stage === 'FINISHED'
            ? 'Phiếu chốt Hoàn thiện với số hàng đang có và sinh phiếu nhập kho thành phẩm chờ thủ kho nhận.'
            : isSelfTakeStage(stage)
              ? `Khâu ${STAGE_LABEL[stage]} mở luôn cho thợ tự nhận.`
              : `Sau đó thủ kho chỉ định thợ ${STAGE_LABEL[stage]}.`}
          {skipped.includes('FILING') ? ' Phôi sau đúc xuất thẳng cho khâu đầu tiên khi thợ nhận hàng.' : ''}
          {pendingAssigned ? ' Lượt chỉ định thợ đang chờ nhận (và đá đã giữ chỗ) sẽ được huỷ.' : ''}
        </Alert>
      ) : null}
    </CrudDialogShell>
  )
}
