import { confirmWeights, ratioWarning } from './weightSanity'
import { stoneReturnPreview } from './stoneReturn'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import type {
  CastingPayload,
  HandoverPayload,
  OrderImage,
  OrderWorkTicket,
  ProductionOrderDetail,
  ReturnPayload,
  StageCode,
  StageEntry,
  SubTicket,
} from '../api/productionOrders'
import { ctToGram, CT_PER_GRAM, formatCt, formatQty, gramToCt } from '../api/inventory'
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
  handoverLineGram,
  handoverMetalWeight,
  stageIssuesStock,
  type HandoverMaterialLine,
} from './MaterialRequests'
import { FormImageField } from './FormImageField'
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
 * Cắt giá trị vừa gõ về đúng mức trần — QC không nhập quá số đã giao được, nhờ vậy hao hụt
 * không bao giờ âm. `null` là không có trần (khâu cũ chưa ghi số giao).
 */
export const capAt = (max: number | null) => (value: string) =>
  max != null && value !== '' && Number(value) > max ? String(max) : value

// ---------------------------------------------------------------- Giao thợ

/**
 * Hàng của phiếu đã qua khâu Vào đá (QC đã nhận lại) trước mốc `before` chưa. Từ đó đá và
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
  note: string
  /** NVL xuất kho cho thợ lúc xác nhận giao. */
  materials: HandoverMaterialLine[]
}

/** Đã giao cho thợ thì thông tin giao khoá luôn — hộp thoại chỉ còn bước xác nhận giao. */
export type HandoverDialogState =
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
      note: '',
      materials: [],
    },
  })

  useEffect(() => {
    if (!open || !state) return
    const { ticket } = state
    form.reset({
      stage: ticket.pendingStage ?? '',
      craftsmanUserId: ticket.claimedByUserId ?? '',
      handedAt: nowInput(),
      handedQty: String(ticket.availableQty),
      handedSilverWeight: ticket.availableSilver ?? '',
      note: '',
      materials: [],
    })
  }, [open, state, form])

  const ticket = state?.ticket ?? null
  const stageCode = ticket?.pendingStage ?? null
  const stageLabel = stageCode ? STAGE_LABEL[stageCode] : ''
  /** Khâu Vào đá phát thêm đá cho thợ; khâu khác chỉ giao bạc. */
  const stoneStage = stageCode === 'STONE_SETTING'
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
  const limitText = ticket?.handoverSilverLimit ?? null
  const silverLimit = limitText != null ? Number(limitText) : null
  /** Đã qua khâu Vào đá: giao cả cụm BTP (bạc + đá), không còn là bạc trơn. */
  const btpWeight =
    !stoneStage &&
    carriesStone(order.stages, state?.mode === 'confirm' ? state.ticket.id : null)
  const title = ticket
    ? `Xác nhận giao ${stageLabel} — ${state?.mode === 'confirm-order' ? 'phiếu mẹ' : 'phiếu'} ${ticket.code}`
    : ''
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
      note: values.note.trim(),
      materials: issuesStock
        ? values.materials.map((line) => ({
            materialId: line.materialId,
            kind: line.kind,
            qty: line.qty,
            weight: handoverLineGram(line),
            stoneCount: line.stoneCount ? Number(line.stoneCount) : null,
          }))
        : undefined,
    })
  }

  return (
    <CrudDialogShell<HandoverValues>
      open={open}
      kind="create"
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitDisabled={selfConfirmBlocked}
      submitLabel="Xác nhận giao"
      pendingLabel="Đang xác nhận…"
      maxWidth="sm"
      onClose={onClose}
      onExited={onExited}
    >
      {selfConfirmBlocked ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          Bạn là thợ nhận phiếu này — nhờ người khác xác nhận giao.
        </Alert>
      ) : selfConfirm ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Bạn đang tự xác nhận giao cho chính mình (admin).
        </Alert>
      ) : null}
      <FormRow columns={2} sx={{ mt: 1 }}>
        <TextInput label="Khâu" value={stageLabel} readOnly />
        <TextInput
          label="Người giao"
          value={operatorName}
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
          label={btpWeight ? 'TL hàng từ khâu trước — BTP (bạc + đá) (g)' : 'TL hàng từ khâu trước (g)'}
          required={!firstStage}
          helperText={[
            firstStage
              ? 'Khâu đầu: để trống nếu hàng lấy từ NVL xuất bên dưới'
              : 'Tự điền theo số QC nhận lại khâu trước',
            silverLimit != null ? `tối đa ${formatQty(String(silverLimit))} g` : '',
          ]
            .filter(Boolean)
            .join(' · ') || undefined}
          rules={{
            validate: (value) => {
              // Không giao vượt hàng đang có (QC nhận lại khâu trước / phôi sau đúc) — khớp BE.
              if (silverLimit != null && value !== '' && Number(value) > silverLimit) {
                return `Không vượt số hàng đang có (${formatQty(String(silverLimit))} g)`
              }
              return (
                !firstStage ||
                Boolean(value) ||
                issuedMetal > 0 ||
                'Khâu đầu: chọn NVL bạc xuất cho thợ hoặc nhập TL giao'
              )
            },
          }}
        />
      </FormRow>

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

      <FormTextField<HandoverValues> name="note" label="Ghi chú" multiline minRows={2} maxRows={6} />
    </CrudDialogShell>
  )
}

// ---------------------------------------------------------------- QC nhận lại

/** Các ô cân QC ghi — cộng lại không vượt bạc vào khâu (+ đá ở Vào đá). */
const SILVER_FIELDS = ['returnedSilverWeight', 'btpRecoveredWeight', 'silverRecoveredWeight', 'scrapS999Weight'] as const
type SilverField = (typeof SILVER_FIELDS)[number]

/** Kết quả QC ở Nguội / Vào đá: không lỗi, lỗi một phần, lỗi hết (phiếu dừng ở khâu này). */
type QcOutcome = 'ok' | 'partial' | 'all'
const QC_OUTCOMES: { value: QcOutcome; label: string; color: 'success' | 'warning' | 'error' }[] = [
  { value: 'ok', label: 'Không lỗi', color: 'success' },
  { value: 'partial', label: 'Lỗi một phần', color: 'warning' },
  { value: 'all', label: 'Lỗi hết', color: 'error' },
]

type ReturnValues = {
  returnedAt: string
  returnedQty: string
  returnedSilverWeight: string
  /** Nguội / Vào đá: SL hàng lỗi QC tách ra. */
  defectQty: string
  /** Lý do hàng lỗi — hiện ở cột Lỗi của phiếu. */
  defectReason: string
  btpRecoveredWeight: string
  silverRecoveredWeight: string
  /** Nguội / Vào đá: S999 thừa (g). */
  scrapS999Weight: string
  /** Vào đá của phiếu con: TL gói đá thừa theo từng mã đã cấp (ct — gửi API đổi ra g). */
  returnedStones: Array<{ materialId: string; weight: string }>
  /** Vào đá: số viên trả lại của dòng cấp cũ không cân gói. */
  legacyReturnedCount: string
  note: string
  /** Ảnh làm chứng QC — bắt buộc ở mọi khâu Nguội → Xi. */
  images: OrderImage[]
}

/** Gói đá thừa trống theo từng mã có cân gói lúc cấp — sửa lại thì điền số QC cân lần trước. */
/** Mã đá còn túi đang giữ (có cân gói) — QC cân gói thừa từng mã; túi đã trả hết giữa khâu thì bỏ. */
function weighedLinesOf(entry: StageEntry) {
  return entry.stoneLines.filter((line) => line.weight != null && Number(line.weight) > 0)
}

function returnedStonesOf(entry: StageEntry) {
  return weighedLinesOf(entry).map((line) => ({
    materialId: line.materialId,
    weight: entry.returnedAt ? gramToCt(line.returnedWeight) : '',
  }))
}

/** QC nhận lại hàng từ thợ và cân lại bạc. Người QC là tài khoản đang đăng nhập. */
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
  const [uploading, setUploading] = useState(false)
  /** Nguội / Vào đá: QC chọn kết quả trước — form chỉ hiện ô của kết quả đó. */
  const [outcome, setOutcome] = useState<QcOutcome>('ok')
  const form = useForm<ReturnValues>({
    defaultValues: {
      images: [],
      returnedAt: '',
      returnedQty: '',
      returnedSilverWeight: '',
      defectQty: '',
      defectReason: '',
      btpRecoveredWeight: '',
      silverRecoveredWeight: '',
      scrapS999Weight: '',
      returnedStones: [],
      legacyReturnedCount: '',
      note: '',
    },
  })

  useEffect(() => {
    if (!entry) return
    const legacyCount =
      entry.returnedAt && entry.stoneLines.some((line) => line.weight == null)
        ? String(
            entry.stoneLines
              .filter((line) => line.weight == null)
              .reduce((sum, line) => sum + (line.returnedCount ?? 0), 0),
          )
        : ''
    // Đã báo lỗi ở khâu Nguội / Vào đá: điền sẵn cả lô là hàng lỗi, QC sửa lại theo hàng thật.
    const flagged =
      entry.defectReportedAt != null &&
      entry.subTicketId != null &&
      (entry.stage === 'FILING' || entry.stage === 'STONE_SETTING')
    // Sửa lại kết quả đã nhận: điền sẵn số liệu QC đã nhập lần trước.
    if (entry.returnedAt) {
      setOutcome((entry.defectQty ?? 0) > 0 ? (entry.returnedQty === 0 ? 'all' : 'partial') : 'ok')
      form.reset({
        returnedAt: toDateTimeInput(entry.returnedAt),
        returnedQty: entry.returnedQty != null ? String(entry.returnedQty) : '',
        returnedSilverWeight: entry.returnedSilverWeight ?? '',
        defectQty: entry.defectQty != null ? String(entry.defectQty) : '',
        defectReason: entry.defectReason ?? '',
        btpRecoveredWeight: entry.btpRecoveredWeight ?? '',
        silverRecoveredWeight: entry.silverRecoveredWeight ?? '',
        scrapS999Weight: entry.scrapS999Weight ?? '',
        returnedStones: returnedStonesOf(entry),
        legacyReturnedCount: legacyCount,
        note: '',
        images: (entry.images ?? []).map((image) => ({ ...image, kind: 'PRODUCT' as const })),
      })
      return
    }
    // Đã báo lỗi giữa khâu: mở sẵn "Lỗi hết", QC đổi sang "Lỗi một phần" nếu còn hàng đạt.
    setOutcome(flagged ? 'all' : 'ok')
    form.reset({
      returnedAt: nowInput(),
      returnedQty: flagged ? '0' : entry.handedQty != null ? String(entry.handedQty) : '',
      returnedSilverWeight: flagged ? '0' : '',
      defectQty: flagged && entry.handedQty != null ? String(entry.handedQty) : '',
      // Khâu đã bị báo lỗi: lấy lý do lúc báo làm lý do hàng lỗi, QC sửa nếu cần.
      defectReason: flagged ? (entry.defectNote ?? '') : '',
      btpRecoveredWeight: '',
      silverRecoveredWeight: '',
      scrapS999Weight: '',
      returnedStones: returnedStonesOf(entry),
      legacyReturnedCount: '',
      note: '',
      images: [],
    })
  }, [entry, form])
  const returnedStones = useWatch({ control: form.control, name: 'returnedStones' }) ?? []

  const [returnedQty, returnedSilver, btp, silverRecovered, scrapS999] = useWatch({
    control: form.control,
    name: ['returnedQty', 'returnedSilverWeight', 'btpRecoveredWeight', 'silverRecoveredWeight', 'scrapS999Weight'],
  })
  /** Nguội / Vào đá của phiếu con: QC tách hàng đạt / hàng lỗi / nguyên liệu thừa; có hàng lỗi thì thủ kho kiểm tra, xác nhận lỗi. */
  const keeperStage =
    entry != null && entry.subTicketId != null && (entry.stage === 'FILING' || entry.stage === 'STONE_SETTING')
  /** QC nhận lại 0 sp: phiếu đóng ở nhánh Lỗi (khâu qua thủ kho thì sau khi thủ kho xác nhận). */
  const allDefect = keeperStage ? outcome === 'all' : returnedQty === '0' && entry?.returnedAt == null
  /** Lỗi hết ở khâu không qua thủ kho thì bắt buộc lý do (phiếu chốt Lỗi ngay). */
  const reasonRequired = allDefect && !keeperStage
  /** Nguội / Vào đá ghi lý do trong phần "Hàng lỗi"; khâu khác chỉ hỏi khi lỗi hết. */
  const showDefectReason = reasonRequired
  const defectSection = keeperStage && outcome !== 'ok'
  const handedQty = entry?.handedQty ?? null

  /** Đổi kết quả QC: điền sẵn số theo kết quả mới, xoá số của phần không còn dùng. */
  function chooseOutcome(next: QcOutcome) {
    if (next === outcome) return
    setOutcome(next)
    const handed = handedQty != null ? String(handedQty) : ''
    if (next === 'all') {
      form.setValue('returnedQty', '0')
      form.setValue('returnedSilverWeight', '0')
      form.setValue('defectQty', handed)
    } else {
      // Từ "Lỗi hết" quay lại: số đạt / TL đạt 0 là số tự điền, trả về trống cho QC nhập.
      if (outcome === 'all') {
        form.setValue('returnedQty', next === 'ok' ? handed : '')
        form.setValue('returnedSilverWeight', '')
      } else if (next === 'ok') {
        form.setValue('returnedQty', handed)
      }
      form.setValue('defectQty', '')
    }
    if (next === 'ok') {
      form.setValue('btpRecoveredWeight', '')
      form.setValue('defectReason', '')
    }
    form.clearErrors()
  }
  const defectQtyValue = useWatch({ control: form.control, name: 'defectQty' })
  useEffect(() => {
    // Báo ngay khi đạt + lỗi vượt số đã giao, không đợi bấm lưu.
    if (keeperStage && form.getValues('defectQty')) void form.trigger('defectQty')
  }, [returnedQty, defectQtyValue, keeperStage, form])
  /** Giao = đạt + lỗi + thiếu — phần thiếu tính hao hụt số lượng. */
  const shortQty =
    keeperStage && handedQty != null
      ? handedQty - Number(returnedQty || 0) - (defectSection ? Number(defectQtyValue || 0) : 0)
      : null
  /**
   * Khâu Vào đá: đá và bạc đã gắn thành một BTP nên QC chỉ đếm và cân lại cả cụm, không tách
   * đá riêng. Mốc so là bạc giao + đá giao (BE coi như gắn hết số đá đã giao).
   */
  const stoneStage = entry?.stage === 'STONE_SETTING'
  /** Đá giữ chỗ của khâu: mã có cân gói thì QC cân gói thừa, dòng cấp cũ không cân thì đếm viên. */
  const weighedStones = stoneStage && entry ? weighedLinesOf(entry) : []
  const legacyStones = stoneStage ? (entry?.stoneLines ?? []).filter((line) => line.weight == null) : []
  // Túi thợ trả giữa khâu (đổi size) không còn là đá đã phát.
  const stoneHandedWeight = stoneStage
    ? Number(entry?.handedStoneWeight ?? 0) +
      Number(entry?.issuedStoneWeight ?? 0) -
      Number(entry?.stoneReturnedEarlyWeight ?? 0)
    : 0
  // QC cân cả cụm bạc + đá nên mốc so là bạc vào khâu + TL đá đã giao.
  const stone = stoneHandedWeight
  /** Bạc vào khâu = TL giao + bạc thợ xin xuất thêm — mốc tính hao hụt, khớp BE. */
  const silverInText = entry?.silverIn ?? entry?.handedSilverWeight ?? null
  const issuedMetal = Number(entry?.issuedMetalWeight ?? 0)
  /** Khâu Vào đá hoặc các khâu sau nó: hàng là BTP bạc + đá, QC cân và tính hao tổn cả cụm. */
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
    // Đá giao cộng vào vế giao vì QC cân cả cụm; % vẫn tính trên bạc vào khâu (đá không hao).
    const back =
      Number(returnedSilver) + (Number(btp) || 0) + (Number(silverRecovered) || 0) + (Number(scrapS999) || 0)
    const silver =
      handedSilver != null && returnedSilver
        ? lossOf(handedSilver + stone, back, handedSilver)
        : null
    // Chưa cân bạc mà hàng về đủ thì chưa có gì để cảnh báo — đừng hiện ô xanh trống rỗng.
    return silver || (qty && qty.value !== 0) ? { qty, silver } : null
  }, [entry, returnedQty, returnedSilver, stone, btp, silverRecovered, scrapS999, silverInText])
  // Bạc quyết định màu cảnh báo; thiếu sản phẩm thì ít nhất cũng phải vàng để QC soi lại.
  const silverLevel = silverLossLevel(loss?.silver?.percent?.toFixed(2) ?? null) ?? 'ok'
  const lossLevel = silverLevel === 'ok' && (loss?.qty?.value ?? 0) > 0 ? 'warn' : silverLevel

  /**
   * Mốc chặn số cân lại: TL bạc đã giao, cộng TL đá đã giao ở khâu Vào đá vì QC cân cả cụm.
   * Khâu cũ chưa ghi TL giao thì không chặn.
   */
  const handedSilver = silverInText != null ? Number(silverInText) : null
  const silverLimit = handedSilver != null ? round4(handedSilver + stone) : null

  /**
   * Bạc còn được ghi vào một ô: bạc vào khâu trừ các ô cân còn lại (đạt, lỗi, thừa). Gõ quá thì
   * báo lỗi ngay tại ô và chặn lưu — không tự sửa số người dùng gõ, nhờ vậy hao hụt không âm.
   */
  function silverRoomFor(field: SilverField) {
    if (handedSilver == null) return null
    const values = form.getValues()
    const limit = handedSilver + stone
    const others = SILVER_FIELDS
      .filter((name) => name !== field)
      .reduce((sum, name) => sum + (Number(values[name]) || 0), 0)
    return Math.max(0, limit - others)
  }

  function silverRules(field: SilverField) {
    return {
      validate: (value: unknown) => {
        if (
          field === 'returnedSilverWeight' &&
          Number(form.getValues('returnedQty')) > 0 &&
          value !== '' && value != null && Number(value) <= 0
        ) {
          return 'Có sản phẩm đạt — trọng lượng sản phẩm đạt phải lớn hơn 0'
        }
        const room = silverRoomFor(field)
        if (room == null || value === '' || value == null) return true
        return Number(value) <= room + 1e-9
          ? true
          : `Vượt mức còn lại ${formatQty(String(round4(room)))} g — đạt + lỗi + thừa không quá ${formatQty(String(silverLimit))} g`
      },
    }
  }

  // Một ô đổi thì mức còn lại của các ô kia đổi theo — kiểm lại các ô đã có số.
  useEffect(() => {
    const filled = SILVER_FIELDS.filter((name) => form.getValues(name) !== '')
    if (filled.length) void form.trigger(filled)
  }, [returnedSilver, btp, silverRecovered, scrapS999, form])

  const revising = entry?.returnedAt != null
  const title = revising
    ? `QC sửa lại — ${entry ? STAGE_LABEL[entry.stage] : ''} (lần ${(entry?.kcsRevisionCount ?? 0) + 1}/3)`
    : `QC cân lại — ${entry ? STAGE_LABEL[entry.stage] : ''}`

  async function submit(values: ReturnValues) {
    const back =
      Number(values.returnedSilverWeight || 0) +
      Number(values.btpRecoveredWeight || 0) +
      Number(values.silverRecoveredWeight || 0) +
      Number(values.scrapS999Weight || 0)
    if (
      silverLimit != null &&
      !(await confirmWeights([
        ratioWarning(back, 'Nhận lại + thu hồi', silverLimit, 'bạc vào khâu', {
          min: 0.5,
          max: 1,
          note: 'hao hụt khâu trên 50%',
        }),
      ]))
    ) {
      return
    }
    onSave({
      returnedAt: fromDateTimeInput(values.returnedAt) ?? new Date().toISOString(),
      returnedQty: values.returnedQty !== '' ? Number(values.returnedQty) : null,
      returnedSilverWeight: values.returnedSilverWeight,
      defectQty: keeperStage ? (defectSection ? Number(values.defectQty || 0) : 0) : null,
      // Lỗi hết: không có hàng đạt — bỏ qua số đạt còn sót trong form.
      ...(keeperStage && outcome === 'all' ? { returnedQty: 0, returnedSilverWeight: '0' } : {}),
      defectReason: keeperStage && !defectSection ? null : values.defectReason.trim() || null,
      scrapS999Weight: keeperStage ? values.scrapS999Weight || null : null,
      btpRecoveredWeight: values.btpRecoveredWeight || null,
      silverRecoveredWeight: values.silverRecoveredWeight || null,
      ...(stoneStage && entry?.stoneLines.length
        ? {
            returnedStones: values.returnedStones
              .filter((line) => Number(line.weight) > 0)
              .map((line) => ({ materialId: line.materialId, weight: ctToGram(line.weight) })),
            returnedStoneCount: legacyStones.length ? Number(values.legacyReturnedCount || 0) : null,
          }
        : {}),
      note: values.note.trim(),
      images: values.images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height })),
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
      submitDisabled={uploading}
      // Nguội / Vào đá: chỉ khi báo hàng lỗi mới chờ thủ kho kiểm tra; không lỗi thì hệ thống tự nhập kho.
      submitColor={keeperStage && outcome === 'all' ? 'error' : undefined}
      submitLabel={
        keeperStage && outcome === 'all'
          ? 'Chốt lỗi hết — dừng phiếu'
          : defectSection
          ? revising
            ? 'Lưu bản sửa — chờ thủ kho xác nhận lỗi'
            : 'Lưu QC — chờ thủ kho xác nhận lỗi'
          : revising
            ? 'Lưu bản sửa & chuyển khâu'
            : 'Lưu cân & chuyển khâu'
      }
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
                <b>{formatCt(entry.handedStoneWeight)}</b>
                {entry.issuedStoneCount ? (
                  <>
                    {' '}
                    · xuất thêm <b>{entry.issuedStoneCount}</b> viên
                    {entry.issuedStoneWeight ? ` (${formatCt(entry.issuedStoneWeight)})` : ''}
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
        <TextInput label="Người QC" value={operatorName} readOnly />
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
              new Date(String(value)) >= new Date(toDateTimeInput(entry.handedAt)) ||
              'Không được trước thời gian giao',
          }}
        />
      </FormRow>


      {keeperStage ? (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
            Kết quả QC
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={outcome}
            onChange={(_, next: QcOutcome | null) => next && chooseOutcome(next)}
          >
            {QC_OUTCOMES.map((option) => (
              <ToggleButton
                key={option.value}
                value={option.value}
                color={option.color}
                sx={{ fontWeight: 700, textTransform: 'none', py: 1 }}
              >
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      ) : null}

      {keeperStage && outcome === 'all' ? null : (
      <FormRow columns={2}>
        <FormTextField<ReturnValues>
          name="returnedQty"
          label="Số lượng sản phẩm đạt"
          type="number"
          required
          helperText={!keeperStage && entry?.handedQty != null ? `Tối đa ${entry.handedQty} sp đã giao` : undefined}
          slotProps={{ htmlInput: { min: 0, max: entry?.handedQty ?? undefined, step: 1 } }}
          transform={(value) => capAt(entry?.handedQty ?? null)(value.replace(/[^\d]/g, ''))}
          rules={{
            validate: (value) => {
              const qty = Number(value)
              if (!(qty >= 0)) return 'Số lượng sản phẩm đạt không hợp lệ'
              const handed = entry?.handedQty
              if (handed != null && qty > handed) return `Không quá số đã giao (${handed})`
              if (keeperStage && outcome === 'ok' && qty === 0) return 'Đạt 0 sp — chọn "Lỗi hết"'
              return true
            },
          }}
        />
        <FormQtyField<ReturnValues>
          name="returnedSilverWeight"
          label={btpWeight ? 'Trọng lượng sản phẩm đạt — BTP (bạc + đá) (g)' : 'Trọng lượng sản phẩm đạt (g)'}
          required
          helperText={
            silverLimit != null
              ? `Tối đa ${formatQty(String(silverLimit))} g`
              : undefined
          }
          rules={silverRules('returnedSilverWeight')}
        />
      </FormRow>
      )}


      {entry?.defectReportedAt ? (
        <Alert severity="error" sx={{ py: 0.25 }}>
          {entry.defectReportedByName ?? '—'} báo lỗi: {entry.defectNote}
        </Alert>
      ) : null}

      {entry?.pendingRequestCount ? (
        <Alert severity="warning" sx={{ py: 0.25 }}>
          Còn {entry.pendingRequestCount} yêu cầu xuất NVL chưa xử lý.
        </Alert>
      ) : null}

      {weighedStones.length || legacyStones.length ? (
        <Box sx={{ p: 1.25, border: '1px solid #e9e0d4', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Đá thừa (cân gói, không thừa để trống)
          </Typography>
          {weighedStones.map((line, index) => {
            // Ô nhập theo ct, gói cấp lưu theo g.
            const returned = Number(returnedStones[index]?.weight || 0)
            const packCt = Number(gramToCt(line.weight) || 0)
            const preview = stoneReturnPreview(line, returned / CT_PER_GRAM)
            return (
              <FormRow key={line.materialId} columns={2}>
                <Box sx={{ alignSelf: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {[line.sku, line.name].filter(Boolean).join(' · ')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Đang giữ {formatQty(line.qty)} {line.unit}
                    {line.stoneCount != null ? ` · ${line.stoneCount} viên` : ''} · gói {formatCt(line.weight)}
                    {line.extraCount ? ` (gồm ${line.extraCount} lần xin thêm)` : ''}
                    {line.earlyReturnedWeight ? ` · đã trả giữa khâu ${formatCt(line.earlyReturnedWeight)}` : ''}
                  </Typography>
                </Box>
                <FormQtyField<ReturnValues>
                  name={`returnedStones.${index}.weight`}
                  label="TL gói đá thừa (ct)"
                  helperText={
                    preview && returned > 0
                      ? `${preview.returnedCount != null ? `≈ ${preview.returnedCount} viên thừa → ` : ''}xuất ${formatQty(String(preview.usedQty))} ${line.unit}`
                      : `Không thừa → xuất hết ${formatQty(line.qty)} ${line.unit}`
                  }
                  rules={{
                    validate: (value) =>
                      !value || Number(value) <= packCt || `Không quá ${formatCt(line.weight)} đã cấp`,
                  }}
                />
              </FormRow>
            )
          })}
          {legacyStones.length ? (
            <FormRow columns={2}>
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                {legacyStones.map((line) => line.sku || line.name).join(', ')} — đếm viên trả (tối đa{' '}
                {legacyStones.reduce((sum, line) => sum + (line.stoneCount ?? 0), 0)})
              </Typography>
              <FormTextField<ReturnValues>
                name="legacyReturnedCount"
                label="Đá trả lại (viên)"
                type="number"
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
                transform={(value) => value.replace(/[^\d]/g, '')}
                rules={{
                  validate: (value) =>
                    Number(value || 0) <= legacyStones.reduce((sum, line) => sum + (line.stoneCount ?? 0), 0) ||
                    'Nhiều hơn số đá đã cấp',
                }}
              />
            </FormRow>
          ) : null}
        </Box>
      ) : null}

      {keeperStage ? (
        <>
          {defectSection ? (
            <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'error.light', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main', mb: 1 }}>
                Hàng lỗi
              </Typography>
              {/* Thứ tự theo thao tác thật: đếm → cân → ghi lý do. */}
              <FormRow columns={2}>
                <FormTextField<ReturnValues>
                  name="defectQty"
                  label="Số lượng hàng lỗi"
                  type="number"
                  required
                  readOnly={outcome === 'all'}
                  helperText={outcome === 'all' ? 'Cả lô đã giao' : 'Số đạt tự trừ theo, sửa lại được'}
                  slotProps={{ htmlInput: { min: 1, step: 1 } }}
                  transform={(value) => {
                    const next = value.replace(/[^\d]/g, '')
                    // Gõ số lỗi thì số đạt tự thành phần còn lại (đã giao − lỗi); QC vẫn sửa tay ô đạt được.
                    if (handedQty != null && next !== '') {
                      form.setValue('returnedQty', String(Math.max(0, handedQty - Number(next))), {
                        shouldDirty: true,
                      })
                    }
                    return next
                  }}
                  rules={{
                    validate: (value) => {
                      if (!(Number(value) > 0)) return 'Nhập số lượng hàng lỗi'
                      if (entry?.handedQty != null && Number(returnedQty || 0) + Number(value) > entry.handedQty) {
                        return `Đạt + lỗi không quá ${entry.handedQty} sp đã giao`
                      }
                      if (outcome === 'partial' && Number(returnedQty || 0) === 0) {
                        return 'Không còn hàng đạt — chọn "Lỗi hết"'
                      }
                      return true
                    },
                  }}
                />
                <FormQtyField<ReturnValues>
                  name="btpRecoveredWeight"
                  label="TL hàng lỗi (g) — về kho NVL"
                  required
                  rules={silverRules('btpRecoveredWeight')}
                />
              </FormRow>
              <FormTextField<ReturnValues>
                name="defectReason"
                label="Lý do lỗi"
                required
                rules={{
                  validate: (value) => (String(value ?? '').trim() ? true : 'Ghi lý do lỗi'),
                }}
                multiline
                minRows={1}
                maxRows={4}
              />
            </Box>
          ) : null}
          {outcome !== 'all' && shortQty != null && handedQty != null ? (
            <Typography
              variant="body2"
              sx={{ color: shortQty > 0 ? 'warning.dark' : shortQty < 0 ? 'error.main' : 'text.secondary' }}
            >
              Giao <b>{handedQty}</b> = Đạt <b>{Number(returnedQty || 0)}</b>
              {defectSection ? (
                <>
                  {' '}+ Lỗi <b>{Number(defectQtyValue || 0)}</b>
                </>
              ) : null}
              {shortQty !== 0 ? (
                <>
                  {' '}+ {shortQty > 0 ? 'Thiếu' : 'Vượt'} <b>{Math.abs(shortQty)}</b> sp
                  {shortQty > 0 ? ' (tính hao hụt)' : ''}
                </>
              ) : null}
            </Typography>
          ) : null}
          <FormRow columns={2}>
            <FormQtyField<ReturnValues>
              name="silverRecoveredWeight"
              label="Nguyên liệu thừa S925 (g)"
              rules={silverRules('silverRecoveredWeight')}
            />
            <FormQtyField<ReturnValues>
              name="scrapS999Weight"
              label="Nguyên liệu thừa S999 (g)"
              rules={silverRules('scrapS999Weight')}
            />
          </FormRow>
        </>
      ) : (
        <FormRow columns={2}>
          <FormQtyField<ReturnValues>
            name="btpRecoveredWeight"
            label="BTP thu hồi (g)"
            rules={silverRules('btpRecoveredWeight')}
          />
          <FormQtyField<ReturnValues>
            name="silverRecoveredWeight"
            label="Bạc S925 thu hồi (g)"
            rules={silverRules('silverRecoveredWeight')}
          />
        </FormRow>
      )}

      {loss ? (
        <Alert severity={LOSS_SEVERITY[lossLevel]} sx={{ py: 0.25 }}>
          {/* Nguội / Vào đá đã có dòng Giao = Đạt + Lỗi + Thiếu ở trên. */}
          {loss.qty && !keeperStage ? (
            <Typography variant="body2">
              Hao hụt số lượng: <b>{loss.qty.value} sp</b>
              {loss.qty.percent != null ? ` (${loss.qty.percent.toFixed(2)}%)` : ''}

            </Typography>
          ) : null}
          {loss.silver ? (
            <Typography variant="body2">
              {btpWeight ? 'Hao hụt BTP' : 'Hao hụt bạc'}: <b>{formatQty(loss.silver.value.toFixed(4))} g</b>
              {loss.silver.percent != null ? ` (${loss.silver.percent.toFixed(2)}%)` : ''}
              {loss.silver.percent != null && loss.silver.percent > SILVER_LOSS_LIMITS.warn
                ? ` — vượt ${SILVER_LOSS_LIMITS.warn}%`
                : ''}
            </Typography>
          ) : null}
        </Alert>
      ) : null}

      {keeperStage && outcome === 'all' && entry ? (
        <Alert severity="error" sx={{ py: 0.25 }}>
          Lỗi hết {entry.handedQty ?? ''} sp — phiếu dừng ở khâu {STAGE_LABEL[entry.stage]} sau khi thủ kho xác nhận,
          không chuyển khâu tiếp. Hàng lỗi về kho NVL.
        </Alert>
      ) : null}
      {allDefect && !keeperStage ? (
        <Alert severity="warning" sx={{ py: 0.25 }}>
          Đạt 0 sp — phiếu chốt Lỗi.
        </Alert>
      ) : null}
      {showDefectReason ? (
        <FormTextField<ReturnValues>
          name="defectReason"
          label="Lý do lỗi"
          required={reasonRequired}
          rules={{
            validate: (value) => (!reasonRequired || String(value ?? '').trim() ? true : 'Ghi lý do lỗi'),
          }}
          multiline
          minRows={1}
          maxRows={4}
        />
      ) : null}
      <FormImageField<ReturnValues>
        name="images"
        label="Ảnh QC làm chứng"
        kind="PRODUCT"
        required
        requiredMessage="QC phải chụp ít nhất một ảnh làm chứng"
        onUploadingChange={setUploading}
        readOnly={saving}
      />
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
          Đơn chuyển sang Đúc.
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
