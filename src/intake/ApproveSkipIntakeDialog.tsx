import { useEffect } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { useWatch } from 'react-hook-form'
import { useAppForm } from '../components/ui/form/useAppForm'
import type { ApproveSkipPayload, ApproveSkipTarget, IntakeOrder } from '../api/intakeOrders'
import { DialogForm, FormCheckbox, FormQtyField, FormRow, FormSelect, FormTextField } from '../components/ui'
import { STAGE_LABEL, STAGES } from '../orders/catalog'
import { StoneSpecsFields, stoneSpecsPayload, type StoneSpecs } from './StoneSpecsFields'

type Values = StoneSpecs & {
  target: ApproveSkipTarget
  hasMold: boolean
  btpMetal: 'S925' | 'S999'
  btpWeightGram: string
  note: string
}

const PRE_PRODUCTION = 'Dựng 3D, Sáp, Cấy cây, Đúc, Cắt cây'

const TARGET_OPTIONS: Array<{ value: ApproveSkipTarget; label: string }> = [
  { value: 'WAX', label: 'In / bơm sáp (bỏ dựng 3D)' },
  ...STAGES.map((stage) => ({ value: stage as ApproveSkipTarget, label: STAGE_LABEL[stage] })),
  { value: 'FINISHED', label: 'Nhập kho thành phẩm' },
]

/** Bỏ đúc: hàng lấy từ kho BTP. */
function skipsCasting(target: ApproveSkipTarget) {
  return target !== 'WAX'
}

/** Khâu đích còn trước / đúng Vào đá: khai đá thay số liệu file 3D đã bỏ. */
function needsStoneSpecs(target: ApproveSkipTarget) {
  return target === 'WAX' || target === 'FILING' || target === 'STONE_SETTING'
}

/** Các bước sẽ bỏ qua khi đi thẳng tới `target` (chưa tính Vào đá của đơn không đá). */
export function approveSkippedSteps(target: ApproveSkipTarget, hasStone: boolean): string[] {
  if (target === 'WAX') return ['Dựng 3D']
  const end = target === 'FINISHED' ? STAGES.length : STAGES.indexOf(target)
  const stages = STAGES.slice(0, end).filter((stage) => hasStone || stage !== 'STONE_SETTING')
  return [PRE_PRODUCTION, ...stages.map((stage) => STAGE_LABEL[stage])]
}

function defaults(order: IntakeOrder | null): Values {
  return {
    target: 'WAX',
    hasMold: false,
    btpMetal: order?.metalType === 'SILVER_999' ? 'S999' : 'S925',
    btpWeightGram: '',
    note: '',
    // Đơn có ghi loại đá thì mặc định có đá.
    hasStone: (order?.stoneTypes?.length ?? 0) > 0,
    stoneCount3d: '',
    stoneWeight3dCt: '',
  }
}

type Props = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onConfirm: (payload: ApproveSkipPayload) => void
}

/**
 * Thủ kho duyệt kèm "Chuyển khâu" (2026-11-26): duyệt và đi thẳng tới khâu đích. Bỏ đúc thì hàng
 * lấy từ kho BTP — thủ kho chọn mã S925 / S999 và nhập TL cả đơn; khâu đầu xuất đúng TL đó khi
 * thợ nhận hàng, còn nhập thẳng thành phẩm thì xuất ngay lúc duyệt.
 */
export function ApproveSkipIntakeDialog({ order, saving, onClose, onConfirm }: Props) {
  const form = useAppForm<Values>({ defaultValues: defaults(null) })
  const target = useWatch({ control: form.control, name: 'target' })
  const hasMold = useWatch({ control: form.control, name: 'hasMold' })
  const hasStone = useWatch({ control: form.control, name: 'hasStone' })

  useEffect(() => {
    if (order) form.reset(defaults(order))
  }, [order, form])

  const castingSkipped = skipsCasting(target)
  const stoneAsked = needsStoneSpecs(target)
  const skipped = approveSkippedSteps(target, stoneAsked ? hasStone : true)

  const submit = (values: Values) => {
    const payload: ApproveSkipPayload = {
      hasMold: values.target === 'WAX' ? values.hasMold : false,
      target: values.target,
      note: values.note.trim(),
      ...(stoneAsked ? stoneSpecsPayload(values) : {}),
      ...(castingSkipped ? { btpMetal: values.btpMetal, btpWeightGram: Number(values.btpWeightGram) } : {}),
    }
    onConfirm(payload)
  }

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Duyệt và chuyển khâu · đơn {order?.code ?? ''}</DialogTitle>
      <DialogForm form={form} onSubmit={submit}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {order ? (
              <Typography variant="body2">
                Sản phẩm: <strong>{order.productName?.trim() || '—'}</strong>
                {order.qty ? ` · SL ${order.qty}` : null}
              </Typography>
            ) : null}
            <FormRow columns={1}>
              <FormSelect<Values, ApproveSkipTarget>
                name="target"
                label="Chuyển thẳng tới"
                required
                options={TARGET_OPTIONS}
                disabled={saving}
              />
            </FormRow>
            {target === 'WAX' ? (
              <FormCheckbox<Values>
                name="hasMold"
                label="Đã có khuôn"
                helperText={hasMold ? 'Chờ thợ sáp / thợ đúc bơm sáp.' : 'Chờ thợ 3D in sáp.'}
                disabled={saving}
              />
            ) : null}
            {castingSkipped ? (
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Hàng lấy từ kho BTP
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <FormSelect<Values, 'S925' | 'S999'>
                    name="btpMetal"
                    label="Mã BTP"
                    required
                    options={[
                      { value: 'S925', label: 'BTP S925' },
                      { value: 'S999', label: 'BTP S999' },
                    ]}
                    disabled={saving}
                    fullWidth
                  />
                  <FormQtyField<Values>
                    name="btpWeightGram"
                    label="TL cả đơn (g)"
                    required
                    rules={{ validate: (value) => (Number(value) > 0 ? true : 'Nhập TL lớn hơn 0') }}
                    size="small"
                    fullWidth
                    disabled={saving}
                  />
                </Stack>
              </Stack>
            ) : null}
            {stoneAsked ? <StoneSpecsFields disabled={saving} qty={order?.qty} /> : null}
            <FormTextField<Values>
              name="note"
              label="Lý do"
              required
              multiline
              minRows={2}
              maxRows={5}
              disabled={saving}
              rules={{ validate: (value) => String(value).trim().length > 0 || 'Ghi lý do chuyển khâu' }}
            />
            {target === 'STONE_SETTING' && !hasStone ? (
              <Alert severity="error">Chuyển sang Vào đá phải khai đá của 1 sản phẩm.</Alert>
            ) : (
              <Alert severity="warning">
                Bỏ qua <b>{skipped.join(', ')}</b>.{' '}
                {target === 'WAX'
                  ? 'Đơn không có ảnh / TL đá file 3D — hao hụt Vào đá tính theo đá thực tế nếu không khai đá.'
                  : target === 'FINISHED'
                    ? 'Xuất ngay TL trên khỏi kho BTP và sinh phiếu nhập kho thành phẩm chờ thủ kho nhận.'
                    : `Đơn vào Lệnh SX ngay; ${
                        target === 'FILING' || target === 'STONE_SETTING'
                          ? `thủ kho chỉ định thợ ${STAGE_LABEL[target]}`
                          : `khâu ${STAGE_LABEL[target]} mở cho thợ tự nhận`
                      }, hàng BTP xuất khi thợ nhận.`}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || !order || (target === 'STONE_SETTING' && !hasStone)}
          >
            {saving ? 'Đang duyệt…' : 'Duyệt và chuyển khâu'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
