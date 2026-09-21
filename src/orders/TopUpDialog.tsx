import { useEffect } from 'react'
import { Alert, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import type { SubTicket } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { CrudDialogShell, FormQtyField, FormRow, FormTextField } from '../components/ui'
import { STAGE_LABEL } from './catalog'

type TopUpValues = { qty: string; silverWeight: string; reason: string }

const EMPTY: TopUpValues = { qty: '', silverWeight: '', reason: '' }

/**
 * Cấp thêm SL / bạc cho phiếu con khi thợ làm giữa chừng phát hiện thiếu.
 * Thợ đang giữ khâu thì phần cấp thêm cộng thẳng vào số giao của khâu đó, nên hao hụt
 * bạc vẫn tính đúng; phiếu đang rảnh thì phần này vào khâu được giao kế tiếp.
 */
export function TopUpDialog({
  ticket,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  ticket: SubTicket | null
  saving: boolean
  onClose: () => void
  onExited: () => void
  onSave: (payload: { qty?: number | null; silverWeight?: string | null; reason?: string }) => void
}) {
  const form = useForm<TopUpValues>({ defaultValues: EMPTY })
  const qty = useWatch({ control: form.control, name: 'qty' })
  const silver = useWatch({ control: form.control, name: 'silverWeight' })
  const empty = !Number(qty || 0) && !Number(silver || 0)

  useEffect(() => {
    if (ticket) form.reset(EMPTY)
  }, [ticket, form])

  const working = ticket?.state === 'WORKING' || ticket?.state === 'SUBMITTED'

  return (
    <CrudDialogShell<TopUpValues>
      open={ticket != null}
      kind="create"
      titles={{
        create: `Cấp thêm — phiếu ${ticket?.code ?? ''}`,
        edit: '',
        view: '',
      }}
      form={form}
      onSubmit={(values) =>
        onSave({
          qty: values.qty ? Number(values.qty) : null,
          silverWeight: values.silverWeight || null,
          reason: values.reason.trim() || undefined,
        })
      }
      saving={saving}
      submitLabel="Cấp thêm"
      submitDisabled={empty}
      maxWidth="xs"
      onClose={onClose}
      onExited={onExited}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Phiếu đang có <b>{ticket?.availableQty ?? 0} sp</b> ·{' '}
        <b>{ticket ? formatQty(ticket.availableSilver) : 0} g bạc</b>. Bỏ trống ô nào thì
        hiểu là không cấp thêm phần đó.
      </Typography>

      {working && ticket?.activeStage ? (
        <Alert severity="info">
          Thợ đang giữ khâu {STAGE_LABEL[ticket.activeStage]} — phần cấp thêm cộng thẳng vào
          số giao của khâu đó, nên hao hụt bạc vẫn tính đúng.
        </Alert>
      ) : (
        <Alert severity="info">
          Phiếu chưa có khâu nào đang làm — phần cấp thêm sẽ vào khâu được giao kế tiếp.
        </Alert>
      )}

      <FormRow columns={2}>
        <FormTextField<TopUpValues>
          name="qty"
          label="Số lượng cấp thêm"
          type="number"
          rules={{
            validate: (value) =>
              !value || Number(value) >= 0 || 'Số lượng cấp thêm không được âm',
          }}
        />
        <FormQtyField<TopUpValues> name="silverWeight" label="Bạc cấp thêm (g)" />
      </FormRow>

      <FormTextField<TopUpValues>
        name="reason"
        label="Lý do"
        multiline
        minRows={2}
        placeholder="vd: thợ làm hỏng 1 cái, cần thêm phôi"
      />
    </CrudDialogShell>
  )
}
