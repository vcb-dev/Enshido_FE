import { confirmWeights, ratioWarning } from './weightSanity'
import { useEffect, useMemo } from 'react'
import { Alert, Box, Typography } from '@mui/material'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import type {
  CastingPayload,
  HandoverPayload,
  OrderWorkTicket,
  ProductionOrderDetail,
  ReturnPayload,
  StageCode,
  StageEntry,
  SubTicket,
} from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import {
  CrudDialogShell,
  FormQtyField,
  FormRow,
  FormTextField,
  TextInput,
} from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { useOperatorName } from '../hooks/useOperatorName'
import {
  HandoverMaterialsField,
  handoverMetalWeight,
  stageIssuesStock,
  type HandoverMaterialLine,
} from './MaterialRequests'
import {
  formatDateShort,
  fromDateTimeInput,
  SILVER_LOSS_LIMITS,
  silverLossLevel,
  STAGE_LABEL,
  toDateTimeInput,
} from './catalog'

const DATE_LABEL = { inputLabel: { shrink: true } }

/** Hao hụt bạc: đạt / cần xem lại / quá cao — cùng ngưỡng với màu trên phiếu thợ. */
const LOSS_SEVERITY = { ok: 'success', warn: 'warning', high: 'error' } as const

function nowInput() {
  return toDateTimeInput(new Date().toISOString())
}

/**
 * Hao tổn một khâu: thiếu bao nhiêu so với số đã giao, kèm %. Mặc định % tính trên chính số
 * giao; khâu Vào đá truyền `base` là TL bạc giao để đá không làm loãng mẫu số.
 */
export function lossOf(handed: number, back: number, base = handed) {
  return { value: handed - back, percent: base > 0 ? ((handed - back) / base) * 100 : null }
}

/** Gram cân đo lấy 4 số lẻ như trên kho — tránh số lẻ nhị phân khi trừ. */
function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

/**
 * Cắt giá trị vừa gõ về đúng mức trần — KCS không nhập quá số đã giao được, nhờ vậy hao hụt
 * không bao giờ âm. `null` là không có trần (khâu cũ chưa ghi số giao).
 */
export const capAt = (max: number | null) => (value: string) =>
  max != null && value !== '' && Number(value) > max ? String(max) : value

// ---------------------------------------------------------------- Giao thợ

/**
 * Tổng đá ghi lúc lên đơn (đã tự xuất khỏi kho NVL chính). Đơn nhiều mã NVL cộng từng dòng;
 * chưa dòng nào ghi TL đá thì TL là null. Khớp `orderStoneOf` ở BE.
 */
export function orderStoneOf(
  order: Pick<ProductionOrderDetail, 'stoneCount' | 'stoneWeight' | 'nvlLines'>,
): { count: number | null; weight: number | null } {
  const lines = order.nvlLines ?? []
  if (!lines.length) {
    return {
      count: order.stoneCount,
      weight: order.stoneWeight != null ? Number(order.stoneWeight) : null,
    }
  }
  const weighed = lines.filter((line) => line.stoneWeight != null)
  return {
    count: lines.reduce((sum, line) => sum + (line.qty ?? 0), 0),
    weight: weighed.length
      ? round4(weighed.reduce((sum, line) => sum + Number(line.stoneWeight), 0))
      : null,
  }
}

/** "Mã · SL viên · TL g" từng mã đá trên đơn, để người giao thấy đá nào phát cho thợ. */
function orderStoneCodes(
  order: Pick<ProductionOrderDetail, 'nvl' | 'nvlLines' | 'stoneCount' | 'stoneWeight'>,
) {
  const describe = (
    code: string | null | undefined,
    qty: number | null,
    weight: string | null,
  ) =>
    [
      code || '—',
      qty != null ? `${qty} viên` : null,
      weight != null ? `${formatQty(weight)} g` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  const lines = order.nvlLines ?? []
  if (lines.length) {
    return lines
      .map((line) => describe(line.sku || line.name, line.qty, line.stoneWeight))
      .join(' | ')
  }
  if (!order.nvl) return ''
  return describe(order.nvl.sku || order.nvl.name, order.stoneCount, order.stoneWeight)
}

/**
 * Khâu Vào đá lúc xác nhận giao: điền sẵn số viên và TL đá còn lại của đơn (lấy từ mã đá lúc
 * lên đơn). Người giao vẫn sửa được nếu chỉ phát một phần.
 */
function useStoneAutofill(
  form: UseFormReturn<HandoverValues>,
  active: boolean,
  budget: { leftCount: number | null; leftWeight: number | null },
) {
  const { leftCount, leftWeight } = budget
  useEffect(() => {
    if (!active) return
    form.setValue('handedStoneCount', leftCount != null ? String(leftCount) : '')
    form.setValue('handedStoneWeight', leftWeight != null ? String(leftWeight) : '')
  }, [active, leftCount, leftWeight, form])
}

/**
 * Hàng của phiếu đã qua khâu Vào đá (KCS đã nhận lại) trước mốc `before` chưa. Từ đó đá và
 * bạc đã gắn thành một BTP: các khâu sau giao, cân lại và tính hao tổn trên cả cụm BTP.
 */
export function carriesStone(
  stages: readonly StageEntry[],
  subTicketId: string | null,
  before?: string,
) {
  return stages.some(
    (item) =>
      item.stage === 'STONE_SETTING' &&
      item.subTicketId === subTicketId &&
      item.returnedAt != null &&
      (before == null || item.handedAt < before),
  )
}

type HandoverValues = {
  stage: StageCode | ''
  craftsmanUserId: string
  handedAt: string
  handedQty: string
  handedSilverWeight: string
  /** Chỉ khâu Vào đá: đá phát cho thợ. */
  handedStoneCount: string
  handedStoneWeight: string
  note: string
  /** NVL xuất kho cho thợ lúc xác nhận giao. */
  materials: HandoverMaterialLine[]
}

export type HandoverDialogState =
  | { mode: 'edit'; entry: StageEntry }
  /** Phiếu con: thợ đã tự nhận khâu, người giao cân bạc rồi xác nhận. */
  | { mode: 'confirm'; ticket: SubTicket }
  /** Phiếu mẹ không chia: cùng luồng tự nhận như phiếu con. */
  | { mode: 'confirm-order'; ticket: OrderWorkTicket }

/** Giao khâu cho thợ. Người giao là tài khoản đang đăng nhập. */
export function HandoverDialog({
  open,
  order,
  state,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  /** Đơn đang mở — lấy quỹ đá của đơn để chặn giao quá. */
  order: ProductionOrderDetail
  state: HandoverDialogState | null
  saving: boolean
  onClose: () => void
  onExited: () => void
  onSave: (payload: HandoverPayload) => void
}) {
  const operatorName = useOperatorName()
  const { user } = useAuth()
  const isAdmin = user?.roleCode === 'ADMIN' || Boolean(user?.extraRoles?.includes('ADMIN'))
  const form = useForm<HandoverValues>({
    defaultValues: {
      stage: '',
      craftsmanUserId: '',
      handedAt: '',
      handedQty: '',
      handedSilverWeight: '',
      handedStoneCount: '',
      handedStoneWeight: '',
      note: '',
      materials: [],
    },
  })

  useEffect(() => {
    if (!open || !state) return
    if (state.mode === 'confirm' || state.mode === 'confirm-order') {
      const { ticket } = state
      form.reset({
        stage: ticket.pendingStage ?? '',
        craftsmanUserId: ticket.claimedByUserId ?? '',
        handedAt: nowInput(),
        handedQty: String(ticket.availableQty),
        handedSilverWeight: ticket.availableSilver ?? '',
        handedStoneCount: '',
        handedStoneWeight: '',
        note: '',
        materials: [],
      })
    } else {
      const { entry } = state
      form.reset({
        stage: entry.stage,
        craftsmanUserId: entry.craftsmanUserId ?? '',
        handedAt: toDateTimeInput(entry.handedAt),
        handedQty: entry.handedQty != null ? String(entry.handedQty) : '',
        handedSilverWeight: entry.handedSilverWeight ?? '',
        handedStoneCount: entry.handedStoneCount != null ? String(entry.handedStoneCount) : '',
        handedStoneWeight: entry.handedStoneWeight ?? '',
        note: entry.note ?? '',
        materials: [],
      })
    }
  }, [open, state, form])

  const confirming = state?.mode === 'confirm' || state?.mode === 'confirm-order'
  const handingOver = confirming
  const ticket =
    state?.mode === 'confirm' || state?.mode === 'confirm-order'
      ? state.ticket
      : null
  const entry = state?.mode === 'edit' ? state.entry : null
  const stageCode = ticket?.pendingStage ?? entry?.stage ?? null
  const stageLabel = stageCode ? STAGE_LABEL[stageCode] : ''
  /** Khâu Vào đá phát thêm đá cho thợ; khâu khác chỉ giao bạc. */
  const stoneStage = stageCode === 'STONE_SETTING'
  /**
   * Quỹ đá của đơn: số ghi lúc lên đơn trừ phần đã phát ở các lần giao khâu Vào đá khác
   * (lần đang sửa không tính vào phần đã phát). Người giao tự chia trong phần còn lại.
   */
  const stoneBudget = useMemo(() => {
    const used = order.stages
      .filter((item) => item.stage === 'STONE_SETTING' && item.id !== entry?.id)
      .reduce(
        (sum, item) => ({
          count: sum.count + (item.handedStoneCount ?? 0),
          weight: sum.weight + (Number(item.handedStoneWeight) || 0),
        }),
        { count: 0, weight: 0 },
      )
    const { count: totalCount, weight: totalWeight } = orderStoneOf(order)
    return {
      used,
      totalCount,
      totalWeight,
      leftCount: totalCount != null ? Math.max(0, totalCount - used.count) : null,
      leftWeight: totalWeight != null ? round4(totalWeight - used.weight) : null,
    }
  }, [order, entry?.id])
  /** Mã đá lấy từ đơn — cũng là các dòng phiếu xuất NVL tự tạo lúc lên đơn. */
  const stoneCodes = useMemo(() => orderStoneCodes(order), [order])

  // Đá giao luôn bằng số bạc giao: gõ SL bạc thì tự điền số viên và TL đá theo quỹ còn lại.
  // Giao khâu mới chọn đá qua các dòng NVL xuất kho; quỹ đá theo đơn chỉ còn cho bản ghi cũ.
  useStoneAutofill(form, open && stoneStage && !handingOver, stoneBudget)
  /** Khâu đầu của phiếu: chưa có hàng từ khâu trước, TL lấy từ NVL xuất. */
  const firstStage = ticket
    ? !order.stages.some((item) =>
        state?.mode === 'confirm'
          ? item.subTicketId === state.ticket.id
          : item.subTicketId == null,
      )
    : false
  const [carried, materialLines] = useWatch({
    control: form.control,
    name: ['handedSilverWeight', 'materials'],
  })
  // Khâu không xuất kho thì bỏ qua các dòng còn sót trong form.
  const issuesStock = stageIssuesStock(stageCode)
  const issuedMetal = issuesStock ? handoverMetalWeight(materialLines ?? []) : 0
  const silverIn = (Number(carried) || 0) + issuedMetal
  /** Mốc TL giao tối đa do BE tính (cùng công thức với chỗ chặn ở BE). */
  const limitText = ticket ? ticket.handoverSilverLimit : (entry?.handedSilverLimit ?? null)
  const silverLimit = limitText != null ? Number(limitText) : null
  /** Đã qua khâu Vào đá: giao cả cụm BTP (bạc + đá), không còn là bạc trơn. */
  const btpWeight =
    !stoneStage &&
    carriesStone(
      order.stages,
      state?.mode === 'confirm' ? state.ticket.id : (entry?.subTicketId ?? null),
      entry?.handedAt,
    )
  const title = ticket
      ? `Xác nhận giao ${stageLabel} — ${state?.mode === 'confirm-order' ? 'phiếu mẹ' : 'phiếu'} ${ticket.code}`
      : `Sửa thông tin giao — ${stageLabel}${entry?.subTicketNo ? ` (phiếu con ${entry.subTicketNo})` : ''}`
  // Người đang xác nhận cũng chính là thợ đã nhận phiếu. Khớp luật ở BE: chỉ admin được
  // tự giao cho mình, người khác bấm cũng chỉ nhận lỗi nên chặn luôn ở đây.
  const selfConfirm = Boolean(ticket && user && ticket.claimedByUserId === user.id)
  const selfConfirmBlocked = selfConfirm && !isAdmin

  function submit(values: HandoverValues) {
    onSave({
      craftsmanUserId: values.craftsmanUserId,
      handedAt: fromDateTimeInput(values.handedAt) ?? new Date().toISOString(),
      handedQty: values.handedQty ? Number(values.handedQty) : null,
      handedSilverWeight: values.handedSilverWeight || null,
      handedStoneCount:
        !handingOver && stoneStage && values.handedStoneCount !== '' ? Number(values.handedStoneCount) : null,
      handedStoneWeight: !handingOver && stoneStage ? values.handedStoneWeight || null : null,
      note: values.note.trim(),
      materials: handingOver && issuesStock
        ? values.materials.map((line) => ({
            materialId: line.materialId,
            kind: line.kind,
            qty: line.qty,
            weight: line.weight || null,
            stoneCount: line.stoneCount ? Number(line.stoneCount) : null,
          }))
        : undefined,
    })
  }

  return (
    <CrudDialogShell<HandoverValues>
      open={open}
      kind={handingOver ? 'create' : 'edit'}
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitDisabled={selfConfirmBlocked}
      submitLabel={confirming ? 'Xác nhận giao' : 'Lưu'}
      pendingLabel={confirming ? 'Đang xác nhận…' : 'Đang lưu…'}
      maxWidth="sm"
      onClose={onClose}
      onExited={onExited}
    >
      {selfConfirmBlocked ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          Bạn là thợ đã nhận phiếu này — không tự xác nhận giao cho mình được. Nhờ người khác
          cân bạc và xác nhận.
        </Alert>
      ) : selfConfirm ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Bạn đang tự xác nhận giao cho chính mình (quyền admin) — lần cân bạc này chỉ có một
          người. Lịch sử khâu sẽ ghi người giao và thợ là cùng một người.
        </Alert>
      ) : null}
      <FormRow columns={2} sx={{ mt: 1 }}>
        <TextInput label="Khâu" value={stageLabel} readOnly />
        <TextInput
          label="Người giao"
          value={state?.mode === 'edit' ? state.entry.handedByName : operatorName}
          readOnly
        />
      </FormRow>

      <FormRow columns={1}>
        <FormTextField<HandoverValues>
          name="handedAt"
          label="Thời gian giao"
          type="datetime-local"
          required
          slotProps={DATE_LABEL}
        />
      </FormRow>

      <FormRow columns={2}>
        <FormTextField<HandoverValues>
          name="handedQty"
          label="Số lượng giao"
          type="number"
          required
          rules={{
            validate: (value) => {
              if (!(Number(value) >= 1)) return 'Số lượng giao phải từ 1'
              if (ticket && Number(value) > ticket.availableQty) {
                return `Không quá số phiếu đang có (${ticket.availableQty})`
              }
              return true
            },
          }}
        />
        <FormQtyField<HandoverValues>
          name="handedSilverWeight"
          label={
            handingOver
              ? btpWeight
                ? 'TL hàng từ khâu trước — BTP (bạc + đá) (g)'
                : 'TL hàng từ khâu trước (g)'
              : btpWeight
                ? 'Trọng lượng giao — BTP (bạc + đá) (g)'
                : 'Trọng lượng giao — bạc (g)'
          }
          required={!handingOver || !firstStage}
          helperText={[
            handingOver && firstStage
              ? 'Khâu đầu: để trống nếu hàng lấy từ NVL xuất bên dưới'
              : handingOver
                ? 'Tự điền theo số KCS nhận lại khâu trước'
                : '',
            silverLimit != null ? `tối đa ${formatQty(String(silverLimit))} g` : '',
          ]
            .filter(Boolean)
            .join(' · ') || undefined}
          rules={{
            validate: (value) => {
              // Không giao vượt hàng đang có (KCS nhận lại khâu trước / phôi sau đúc) — khớp BE.
              if (silverLimit != null && value !== '' && Number(value) > silverLimit) {
                return `Không vượt số hàng đang có (${formatQty(String(silverLimit))} g)`
              }
              return (
                !handingOver ||
                !firstStage ||
                Boolean(value) ||
                issuedMetal > 0 ||
                'Khâu đầu: chọn NVL bạc xuất cho thợ hoặc nhập TL giao'
              )
            },
          }}
        />
      </FormRow>

      {handingOver ? (
        <>
          <HandoverMaterialsField
            form={form}
            stage={stageCode}
            blank={
              order.cut?.btpMaterialId && order.cut.leftQty != null && order.cut.leftWeight != null
                ? {
                    materialId: order.cut.btpMaterialId,
                    leftQty: Number(order.cut.leftQty),
                    leftWeight: Number(order.cut.leftWeight),
                  }
                : null
            }
          />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Bạc vào khâu: <b>{formatQty(String(round4(silverIn)))}</b> g
            {issuedMetal ? ` (hàng ${formatQty(String(Number(carried) || 0))} g + xuất ${formatQty(String(round4(issuedMetal)))} g)` : ''}
          </Typography>
        </>
      ) : null}

      {stoneStage && !handingOver ? (
        <>
          {stoneBudget.totalCount == null && stoneBudget.totalWeight == null ? (
            <Alert severity="warning" sx={{ mt: 1, py: 0.25 }}>
              <Typography variant="body2">
                Đơn chưa ghi số lượng / trọng lượng đá nên không chặn được phần giao — bổ sung ở
                phần sửa đơn nếu cần.
              </Typography>
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mt: 1, py: 0.25 }}>
              <Typography variant="body2">
                Đá của đơn: <b>{stoneBudget.totalCount ?? '—'}</b> viên ·{' '}
                <b>
                  {stoneBudget.totalWeight != null ? formatQty(String(stoneBudget.totalWeight)) : '—'}
                </b>{' '}
                g
                {stoneBudget.used.count > 0 || stoneBudget.used.weight > 0
                  ? ` · đã giao ${stoneBudget.used.count} viên · ${formatQty(String(stoneBudget.used.weight))} g`
                  : ''}
              </Typography>
              <Typography variant="body2">
                Còn chia được: <b>{stoneBudget.leftCount ?? '—'}</b> viên ·{' '}
                <b>
                  {stoneBudget.leftWeight != null ? formatQty(String(stoneBudget.leftWeight)) : '—'}
                </b>{' '}
                g
              </Typography>
            </Alert>
          )}
          {stoneCodes ? (
            <FormRow columns={1}>
              <TextInput label="Mã đá (theo đơn)" value={stoneCodes} readOnly />
            </FormRow>
          ) : null}
          <FormRow columns={2}>
            <FormTextField<HandoverValues>
              name="handedStoneCount"
              label="Số viên đá giao"
              type="number"
              helperText={
                stoneBudget.leftCount != null ? `Tối đa ${stoneBudget.leftCount} viên` : undefined
              }
              slotProps={{
                htmlInput: { min: 0, max: stoneBudget.leftCount ?? undefined, step: 1 },
              }}
              transform={(value) => capAt(stoneBudget.leftCount)(value.replace(/[^\d]/g, ''))}
              rules={{
                validate: (value) =>
                  stoneBudget.leftCount == null ||
                  value === '' ||
                  Number(value) <= stoneBudget.leftCount
                    ? true
                    : `Đơn chỉ còn ${stoneBudget.leftCount} viên đá`,
              }}
            />
            <FormQtyField<HandoverValues>
              name="handedStoneWeight"
              label="Trọng lượng đá giao (g)"
              helperText={
                stoneBudget.leftWeight != null
                  ? `Tối đa ${formatQty(String(stoneBudget.leftWeight))} g của đơn`
                  : 'Đá phát cho thợ; lúc nhận lại KCS ghi số đá thật sự gắn lên'
              }
              transform={(value) => capAt(stoneBudget.leftWeight)(value)}
              rules={{
                validate: (value) =>
                  stoneBudget.leftWeight == null ||
                  value === '' ||
                  Number(value) <= stoneBudget.leftWeight
                    ? true
                    : `Đơn chỉ còn ${formatQty(String(stoneBudget.leftWeight))} g đá`,
              }}
            />
          </FormRow>
        </>
      ) : null}

      <FormTextField<HandoverValues> name="note" label="Ghi chú" multiline minRows={2} maxRows={6} />
    </CrudDialogShell>
  )
}

// ---------------------------------------------------------------- KCS nhận lại

type ReturnValues = {
  returnedAt: string
  returnedQty: string
  returnedSilverWeight: string
  /** Nguội / Vào đá: SL hàng lỗi KCS tách ra. */
  defectQty: string
  btpRecoveredWeight: string
  silverRecoveredWeight: string
  /** Nguội / Vào đá: S999 thừa (g). */
  scrapS999Weight: string
  note: string
}

/** KCS nhận lại hàng từ thợ và cân lại bạc. Người KCS là tài khoản đang đăng nhập. */
export function KcsReturnDialog({
  order,
  entry,
  saving,
  onClose,
  onSave,
}: {
  /** Đơn đang mở — xem phiếu đã qua khâu Vào đá chưa để cân theo BTP. */
  order: ProductionOrderDetail
  entry: StageEntry | null
  saving: boolean
  onClose: () => void
  onSave: (payload: ReturnPayload) => void
}) {
  const operatorName = useOperatorName()
  const form = useForm<ReturnValues>({
    defaultValues: {
      returnedAt: '',
      returnedQty: '',
      returnedSilverWeight: '',
      defectQty: '',
      btpRecoveredWeight: '',
      silverRecoveredWeight: '',
      scrapS999Weight: '',
      note: '',
    },
  })

  useEffect(() => {
    if (!entry) return
    // Đã báo lỗi ở khâu Nguội / Vào đá: điền sẵn cả lô là hàng lỗi, KCS sửa lại theo hàng thật.
    const flagged =
      entry.defectReportedAt != null &&
      entry.subTicketId != null &&
      (entry.stage === 'FILING' || entry.stage === 'STONE_SETTING')
    // Sửa lại kết quả đã nhận: điền sẵn số liệu KCS đã nhập lần trước.
    if (entry.returnedAt) {
      form.reset({
        returnedAt: toDateTimeInput(entry.returnedAt),
        returnedQty: entry.returnedQty != null ? String(entry.returnedQty) : '',
        returnedSilverWeight: entry.returnedSilverWeight ?? '',
        defectQty: entry.defectQty != null ? String(entry.defectQty) : '',
        btpRecoveredWeight: entry.btpRecoveredWeight ?? '',
        silverRecoveredWeight: entry.silverRecoveredWeight ?? '',
        scrapS999Weight: entry.scrapS999Weight ?? '',
        note: '',
      })
      return
    }
    form.reset({
      returnedAt: nowInput(),
      returnedQty: flagged ? '0' : entry.handedQty != null ? String(entry.handedQty) : '',
      returnedSilverWeight: '',
      defectQty: flagged && entry.handedQty != null ? String(entry.handedQty) : '',
      btpRecoveredWeight: '',
      silverRecoveredWeight: '',
      scrapS999Weight: '',
      note: '',
    })
  }, [entry, form])

  const [returnedQty, returnedSilver, btp, silverRecovered, scrapS999, defectQty] = useWatch({
    control: form.control,
    name: [
      'returnedQty',
      'returnedSilverWeight',
      'btpRecoveredWeight',
      'silverRecoveredWeight',
      'scrapS999Weight',
      'defectQty',
    ],
  })
  /** Nguội / Vào đá của phiếu con: KCS tách hàng đạt / hàng lỗi / nguyên liệu thừa, thủ kho xác nhận sau. */
  const keeperStage =
    entry != null && entry.subTicketId != null && (entry.stage === 'FILING' || entry.stage === 'STONE_SETTING')
  /**
   * Khâu Vào đá: đá và bạc đã gắn thành một BTP nên KCS chỉ đếm và cân lại cả cụm, không tách
   * đá riêng. Mốc so là bạc giao + đá giao (BE coi như gắn hết số đá đã giao).
   */
  const stoneStage = entry?.stage === 'STONE_SETTING'
  const stoneHandedWeight = stoneStage
    ? Number(entry?.handedStoneWeight ?? 0) + Number(entry?.issuedStoneWeight ?? 0)
    : 0
  // KCS cân cả cụm bạc + đá nên mốc so là bạc vào khâu + TL đá đã giao.
  const stone = stoneHandedWeight
  /** Bạc vào khâu = TL giao + bạc thợ xin xuất thêm — mốc tính hao hụt, khớp BE. */
  const silverInText = entry?.silverIn ?? entry?.handedSilverWeight ?? null
  const issuedMetal = Number(entry?.issuedMetalWeight ?? 0)
  /** Khâu Vào đá hoặc các khâu sau nó: hàng là BTP bạc + đá, KCS cân và tính hao tổn cả cụm. */
  const btpWeight =
    stoneStage ||
    (entry != null && carriesStone(order.stages, entry.subTicketId, entry.handedAt))
  /** Hao tổn của khâu: thiếu bao nhiêu sản phẩm và hụt bao nhiêu bạc, mỗi thứ kèm %. */
  const loss = useMemo(() => {
    if (!entry) return null
    const handedQty = entry.handedQty
    const qty =
      handedQty != null && returnedQty !== '' && Number.isFinite(Number(returnedQty))
        ? lossOf(handedQty, Number(returnedQty))
        : null
    const handedSilver = silverInText != null ? Number(silverInText) : null
    // Đá giao cộng vào vế giao vì KCS cân cả cụm; % vẫn tính trên bạc vào khâu (đá không hao).
    const back =
      Number(returnedSilver) + (Number(btp) || 0) + (Number(silverRecovered) || 0) + (Number(scrapS999) || 0)
    const silver =
      handedSilver != null && returnedSilver
        ? lossOf(handedSilver + stone, back, handedSilver)
        : null
    // Chưa cân bạc mà hàng về đủ thì chưa có gì để cảnh báo — đừng hiện ô xanh trống rỗng.
    return silver || (qty && qty.value !== 0) ? { qty, silver } : null
  }, [entry, returnedQty, returnedSilver, stone, btp, silverRecovered, scrapS999, silverInText])
  // Bạc quyết định màu cảnh báo; thiếu sản phẩm thì ít nhất cũng phải vàng để KCS soi lại.
  const silverLevel = silverLossLevel(loss?.silver?.percent?.toFixed(2) ?? null) ?? 'ok'
  const lossLevel = silverLevel === 'ok' && (loss?.qty?.value ?? 0) > 0 ? 'warn' : silverLevel

  /**
   * Mốc chặn số cân lại: TL bạc đã giao, cộng TL đá đã giao ở khâu Vào đá vì KCS cân cả cụm.
   * Khâu cũ chưa ghi TL giao thì không chặn.
   */
  const handedSilver = silverInText != null ? Number(silverInText) : null
  const silverLimit = handedSilver != null ? round4(handedSilver + stone) : null

  /**
   * Bạc còn được ghi vào một ô: TL giao trừ hai ô bạc kia. Gõ quá là bị cắt ngay tại ô,
   * nhờ vậy tổng bạc về tay KCS không bao giờ vượt số giao và hao hụt không bao giờ âm.
   */
  function silverRoomFor(field: keyof ReturnValues) {
    if (handedSilver == null) return null
    const values = form.getValues()
    const limit = handedSilver + stone
    const others = (
      ['returnedSilverWeight', 'btpRecoveredWeight', 'silverRecoveredWeight', 'scrapS999Weight'] as const
    )
      .filter((name) => name !== field)
      .reduce((sum, name) => sum + (Number(values[name]) || 0), 0)
    return Math.max(0, limit - others)
  }

  const revising = entry?.returnedAt != null
  const title = revising
    ? `KCS sửa lại — ${entry ? STAGE_LABEL[entry.stage] : ''} (lần ${(entry?.kcsRevisionCount ?? 0) + 1}/3)`
    : `KCS cân lại — ${entry ? STAGE_LABEL[entry.stage] : ''}`

  function submit(values: ReturnValues) {
    const back =
      Number(values.returnedSilverWeight || 0) +
      Number(values.btpRecoveredWeight || 0) +
      Number(values.silverRecoveredWeight || 0) +
      Number(values.scrapS999Weight || 0)
    if (
      silverLimit != null &&
      !confirmWeights([
        ratioWarning(back, 'Nhận lại + thu hồi', silverLimit, 'bạc vào khâu', {
          min: 0.5,
          max: 1,
          note: 'hao hụt khâu trên 50%',
        }),
      ])
    ) {
      return
    }
    onSave({
      returnedAt: fromDateTimeInput(values.returnedAt) ?? new Date().toISOString(),
      returnedQty: values.returnedQty !== '' ? Number(values.returnedQty) : null,
      returnedSilverWeight: values.returnedSilverWeight,
      defectQty: keeperStage ? Number(values.defectQty || 0) : null,
      scrapS999Weight: keeperStage ? values.scrapS999Weight || null : null,
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
      submitLabel={revising ? 'Lưu bản sửa' : keeperStage ? 'Lưu KCS — chờ thủ kho xác nhận' : 'Lưu cân & chuyển khâu'}
      maxWidth="sm"
      onClose={onClose}
      onExited={() => undefined}
    >
      {entry ? (
        <Box sx={{ mt: 1, p: 1.25, bgcolor: '#f8f3eb', borderRadius: 1 }}>
          <Typography variant="body2">
            Thợ <b>{entry.craftsmanName}</b> · giao lúc {formatDateShort(entry.handedAt)} bởi {entry.handedByName}
          </Typography>
          <Typography variant="body2">
            SL giao: <b>{entry.handedQty ?? '—'}</b> ·{' '}
            {btpWeight && !stoneStage ? 'TL BTP (bạc + đá) giao' : 'TL bạc giao'}:{' '}
            <b>{entry.handedSilverWeight ? formatQty(entry.handedSilverWeight) : '—'}</b> g
          </Typography>
          {issuedMetal ? (
            <Typography variant="body2">
              Bạc xuất thêm theo yêu cầu: <b>{formatQty(entry.issuedMetalWeight ?? '0')}</b> g → bạc vào khâu{' '}
              <b>{silverInText ? formatQty(silverInText) : '—'}</b> g
            </Typography>
          ) : null}
          {stoneStage ? (
            <>
              <Typography variant="body2">
                Đá giao: <b>{entry.handedStoneCount ?? '—'}</b> viên ·{' '}
                <b>{entry.handedStoneWeight ? formatQty(entry.handedStoneWeight) : '—'}</b> g
                {entry.issuedStoneCount ? (
                  <>
                    {' '}
                    · xuất thêm <b>{entry.issuedStoneCount}</b> viên
                    {entry.issuedStoneWeight ? ` (${formatQty(entry.issuedStoneWeight)} g)` : ''}
                  </>
                ) : null}
              </Typography>
              <Typography variant="body2">
                BTP giao (bạc + đá):{' '}
                <b>{silverLimit != null ? formatQty(String(silverLimit)) : '—'}</b> g — cân lại cả cụm
              </Typography>
            </>
          ) : null}
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
        <FormTextField<ReturnValues>
          name="returnedQty"
          label={btpWeight ? 'Số lượng nhận lại — BTP (bạc + đá)' : 'Số lượng nhận lại'}
          type="number"
          required
          helperText={entry?.handedQty != null ? `Tối đa ${entry.handedQty} sp đã giao` : undefined}
          slotProps={{ htmlInput: { min: 0, max: entry?.handedQty ?? undefined, step: 1 } }}
          transform={(value) => capAt(entry?.handedQty ?? null)(value.replace(/[^\d]/g, ''))}
          rules={{
            validate: (value) => {
              const qty = Number(value)
              if (!(qty >= 0)) return 'Số lượng nhận lại không hợp lệ'
              const handed = entry?.handedQty
              if (handed != null && qty > handed) return `Không quá số đã giao (${handed})`
              return true
            },
          }}
        />
        <FormQtyField<ReturnValues>
          name="returnedSilverWeight"
          label={btpWeight ? 'Trọng lượng nhận lại — BTP (bạc + đá) (g)' : 'Trọng lượng nhận lại — bạc (g)'}
          required
          helperText={
            silverLimit != null
              ? `Tối đa ${formatQty(String(silverLimit))} g${stoneStage ? ' (bạc vào khâu + đá)' : issuedMetal ? ' (giao + xuất thêm)' : ' đã giao'}, tính cả phần thu hồi`
              : undefined
          }
          transform={(value) => capAt(silverRoomFor('returnedSilverWeight'))(value)}
          rules={{
            validate: (value) =>
              silverLimit == null || value === '' || Number(value) <= silverLimit
                ? true
                : `Không quá ${formatQty(String(silverLimit))} g đã giao`,
          }}
        />
      </FormRow>


      {entry?.defectReportedAt ? (
        <Alert severity="error" sx={{ py: 0.25 }}>
          {entry.defectReportedByName ?? '—'} báo lỗi khâu này: {entry.defectNote}. Cân hàng thật rồi nhập số hàng đạt /
          hàng lỗi.
        </Alert>
      ) : null}

      {entry?.pendingRequestCount ? (
        <Alert severity="warning" sx={{ py: 0.25 }}>
          Còn {entry.pendingRequestCount} yêu cầu xuất NVL của khâu này chưa xử lý — kho xuất hoặc từ chối trước rồi
          KCS mới nhận lại được.
        </Alert>
      ) : null}

      {keeperStage ? (
        <>
          <FormRow columns={2}>
            <FormTextField<ReturnValues>
              name="defectQty"
              label="Số lượng hàng lỗi"
              type="number"
              helperText={
                entry?.handedQty != null
                  ? `Đạt ${returnedQty || 0} + lỗi ${defectQty || 0} tối đa ${entry.handedQty} sp đã giao`
                  : undefined
              }
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              transform={(value) => value.replace(/[^\d]/g, '')}
              rules={{
                validate: (value) =>
                  entry?.handedQty == null ||
                  Number(returnedQty || 0) + Number(value || 0) <= entry.handedQty ||
                  `Đạt + lỗi không quá ${entry.handedQty} sp đã giao`,
              }}
            />
            <FormQtyField<ReturnValues>
              name="btpRecoveredWeight"
              label="TL hàng lỗi (g) — về kho NVL"
              transform={(value) => capAt(silverRoomFor('btpRecoveredWeight'))(value)}
            />
          </FormRow>
          <FormRow columns={2}>
            <FormQtyField<ReturnValues>
              name="silverRecoveredWeight"
              label="Nguyên liệu thừa S925 (g)"
              transform={(value) => capAt(silverRoomFor('silverRecoveredWeight'))(value)}
            />
            <FormQtyField<ReturnValues>
              name="scrapS999Weight"
              label="Nguyên liệu thừa S999 (g)"
              transform={(value) => capAt(silverRoomFor('scrapS999Weight'))(value)}
            />
          </FormRow>
          <Alert severity="info" sx={{ py: 0.25 }}>
            Hàng đạt nhập kho BTP, hàng lỗi + nguyên liệu thừa nhập kho NVL — thủ kho xác nhận xong mới nhập kho.
            Đạt 0 sp thì phiếu chốt Lỗi.
          </Alert>
        </>
      ) : (
        <FormRow columns={2}>
          <FormQtyField<ReturnValues>
            name="btpRecoveredWeight"
            label="BTP thu hồi (g)"
            transform={(value) => capAt(silverRoomFor('btpRecoveredWeight'))(value)}
          />
          <FormQtyField<ReturnValues>
            name="silverRecoveredWeight"
            label="Bạc S925 thu hồi (g)"
            transform={(value) => capAt(silverRoomFor('silverRecoveredWeight'))(value)}
          />
        </FormRow>
      )}

      {loss ? (
        <Alert severity={LOSS_SEVERITY[lossLevel]} sx={{ py: 0.25 }}>
          {loss.qty ? (
            <Typography variant="body2">
              Hao hụt số lượng: <b>{loss.qty.value} sp</b>
              {loss.qty.percent != null ? ` (${loss.qty.percent.toFixed(2)}%)` : ''}
              {loss.qty.value > 0 ? ' — ghi rõ lý do thiếu hàng ở ghi chú' : ''}
            </Typography>
          ) : null}
          {loss.silver ? (
            <Typography variant="body2">
              {btpWeight ? 'Hao hụt BTP' : 'Hao hụt bạc'}: <b>{formatQty(loss.silver.value.toFixed(4))} g</b>
              {loss.silver.percent != null ? ` (${loss.silver.percent.toFixed(2)}%)` : ''}
              {loss.silver.percent != null && loss.silver.percent > SILVER_LOSS_LIMITS.warn
                ? ` — vượt ngưỡng ${SILVER_LOSS_LIMITS.warn}%, kiểm tra lại trước khi nhận`
                : ''}
            </Typography>
          ) : null}
        </Alert>
      ) : null}

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
    form.reset({
      sentDate: sentDate ?? new Date().toISOString().slice(0, 10),
      returnedDate: returnedDate ?? '',
    })
  }, [open, sentDate, returnedDate, form])

  const title = sentDate ? 'Cập nhật Đúc' : 'Báo Đúc'

  return (
    <CrudDialogShell<CastingValues>
      open={open}
      kind={sentDate ? 'edit' : 'create'}
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={(values) =>
        onSave({
          sentDate: values.sentDate,
          returnedDate: values.returnedDate || null,
        })
      }
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
