import { confirmWeights, ratioWarning } from './weightSanity'
import { STONE_SET_SOURCE_LABEL, stoneReturnPreview, stoneSetWeight } from './stoneReturn'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
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
  FormSelect,
  FormTextField,
  TextInput,
} from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { useOperatorName } from '../hooks/useOperatorName'
import {
  HandoverMaterialsField,
  handoverLinePayload,
  handoverMetalWeight,
  stageIssuesStock,
  type HandoverMaterialLine,
} from './MaterialRequests'
import { FormImageField } from './FormImageField'
import { KcsImages } from './KcsImages'
import {
  formatDateShort,
  SILVER_LOSS_LIMITS,
  silverLossLevel,
  STAGE_LABEL,
} from './catalog'

const DATE_LABEL = { inputLabel: { shrink: true } }

/** Hao hụt bạc: đạt / cần xem lại / quá cao — cùng ngưỡng với màu trên phiếu thợ. */
const LOSS_SEVERITY = { ok: 'success', warn: 'warning', high: 'error' } as const

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
      handedQty: '',
      handedSilverWeight: '',
      note: '',
      materials: [],
    },
  })

  const initializedTarget = useRef<string | null>(null)
  useEffect(() => {
    if (!open || !state) {
      initializedTarget.current = null
      return
    }
    const target = `${state.mode}:${state.ticket.code}`
    if (initializedTarget.current === target) return
    initializedTarget.current = target
    const { ticket } = state
    form.reset({
      stage: ticket.pendingStage ?? '',
      craftsmanUserId: ticket.claimedByUserId ?? '',
      handedQty: String(ticket.availableQty),
      handedSilverWeight: ticket.availableSilver ?? '',
      note: '',
      materials: [],
    })
  }, [open, state, form])

  const ticket = state?.ticket ?? null
  useEffect(() => {
    if (open && state?.mode === 'confirm-order' && ticket) {
      form.setValue('handedQty', String(ticket.availableQty))
    }
  }, [open, state?.mode, ticket?.availableQty, form])
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
  // Khâu đầu chưa có hàng từ khâu trước: bạc vào khâu chỉ là NVL xuất bên dưới.
  const firstStockStage = firstStage && issuesStock
  const carriedWeight = firstStockStage ? 0 : Number(carried) || 0
  const silverIn = carriedWeight + issuedMetal
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
  const [uploading, setUploading] = useState(false)

  function submit(values: HandoverValues) {
    onSave({
      craftsmanUserId: values.craftsmanUserId,
      handedQty: state?.mode === 'confirm-order' && ticket
        ? ticket.availableQty
        : values.handedQty ? Number(values.handedQty) : null,
      handedSilverWeight: firstStockStage ? null : values.handedSilverWeight || null,
      note: values.note.trim(),
      materials: issuesStock ? values.materials.map(handoverLinePayload) : undefined,
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
      submitDisabled={selfConfirmBlocked || uploading}
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
      <Typography variant="body2" sx={{ mt: 1 }}>Khâu: <b>{stageLabel}</b></Typography>
      <FormRow columns={1}>
        <TextInput
          label="Người giao"
          value={operatorName}
          readOnly
        />
      </FormRow>

      <FormRow columns={2}>
        <FormTextField<HandoverValues>
          name="handedQty"
          label="Số lượng giao"
          type="number"
          readOnly={state?.mode === 'confirm-order'}
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
        {firstStockStage ? null : (
          <FormQtyField<HandoverValues>
            name="handedSilverWeight"
            label={firstStage ? 'TL bạc giao (g)' : btpWeight ? 'TL hàng từ khâu trước — BTP (bạc + đá) (g)' : 'TL hàng từ khâu trước (g)'}
            required
            helperText={[
              firstStage ? 'Trọng lượng hàng giao cho thợ' : 'Tự điền theo số QC nhận lại khâu trước',
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
                return true
              },
            }}
          />
        )}
      </FormRow>

      <HandoverMaterialsField
        form={form}
        stage={stageCode}
        readOnly={saving}
        onUploadingChange={setUploading}
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
        {issuedMetal ? ` (hàng ${formatQty(String(carriedWeight))} g + xuất ${formatQty(String(round4(issuedMetal)))} g)` : ''}
      </Typography>

      <FormTextField<HandoverValues> name="note" label="Ghi chú" multiline minRows={2} maxRows={6} />
    </CrudDialogShell>
  )
}

/** Chỉ định thợ và ghi sẵn nội dung giao Nguội / Vào đá; thợ xác nhận nhận hàng ở bước sau. */
export function AssignReceiptDialog({
  open,
  order,
  ticket,
  stages,
  workers,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  order: ProductionOrderDetail
  ticket: OrderWorkTicket | null
  stages: StageCode[]
  workers: Array<{ id: string; username: string; fullName: string }>
  saving: boolean
  onClose: () => void
  onSave: (payload: HandoverPayload & { stage: StageCode }) => void
}) {
  type Values = {
    stage: StageCode | ''
    craftsmanUserId: string
    handedQty: string
    handedSilverWeight: string
    note: string
    materials: HandoverMaterialLine[]
  }
  const form = useForm<Values>({
    defaultValues: {
      stage: '',
      craftsmanUserId: '',
      handedQty: '',
      handedSilverWeight: '',
      note: '',
      materials: [],
    },
  })
  const stage = useWatch({ control: form.control, name: 'stage' })
  const craftsmanUserId = useWatch({ control: form.control, name: 'craftsmanUserId' })
  const handedQty = useWatch({ control: form.control, name: 'handedQty' })
  const [uploading, setUploading] = useState(false)
  const availableQty = ticket?.availableQty ?? order.qty
  useEffect(() => {
    if (open) form.setValue('handedQty', String(availableQty))
  }, [open, availableQty, form])
  const cutBtp =
    order.cut?.btpMaterialId && order.cut.leftQty != null && order.cut.leftWeight != null
      ? {
          materialId: order.cut.btpMaterialId,
          leftQty: Number(order.cut.leftQty),
          leftWeight: Number(order.cut.leftWeight),
        }
      : null
  const autoCutBtp = stage === 'FILING' && cutBtp != null
  const missingCutBtpLink = stage === 'FILING' && Boolean(order.cutAt) && cutBtp == null
  const autoCutQty = Number(handedQty)
  const autoCutWeight =
    cutBtp && Number.isInteger(autoCutQty) && autoCutQty > 0 && autoCutQty <= cutBtp.leftQty
      ? autoCutQty === cutBtp.leftQty
        ? cutBtp.leftWeight
        : Math.round((cutBtp.leftWeight * autoCutQty / cutBtp.leftQty) * 10_000) / 10_000
      : null
  const cutBtpLabel = cutBtp
    ? order.btp?.id === cutBtp.materialId
      ? [order.btp.sku, order.btp.name].filter(Boolean).join(' — ')
      : 'BTP đã cắt gắn với đơn'
    : ''
  const firstStage = order.stages.length === 0
  /**
   * Vào đá: hàng đạt khâu trước đã nhập kho BTP (BTP đã nguội của đơn) thì hệ thống tự xuất khi
   * thợ nhận hàng — thủ kho chỉ chọn đá, không nhập TL bạc hay chọn lại BTP (khớp BE).
   */
  const previousEntry = order.stages.filter((item) => item.subTicketId == null).at(-1) ?? null
  const autoFiledBtp =
    stage === 'STONE_SETTING' && previousEntry?.outputMaterialId != null ? previousEntry : null
  const resetForOpen = useRef(false)
  useEffect(() => {
    if (!open) {
      resetForOpen.current = false
      return
    }
    // Props cập nhật khi trang làm mới dữ liệu nền; không được reset lựa chọn người dùng đang nhập.
    if (resetForOpen.current) return
    resetForOpen.current = true
    form.reset({
      stage: stages[0] ?? '',
      craftsmanUserId: '',
      handedQty: String(ticket?.availableQty ?? order.qty),
      handedSilverWeight: ticket?.availableSilver ?? '',
      note: '',
      materials: [],
    })
  }, [open, stages, ticket, order.qty, order.stages.length, form])

  return (
    <CrudDialogShell<Values>
      open={open}
      kind="create"
      titles={{ create: 'Giao khâu cho thợ', edit: 'Giao khâu cho thợ', view: 'Giao khâu cho thợ' }}
      form={form}
      onSubmit={(values) => {
        if (!values.stage) return
        const materialLines = autoCutBtp ? [] : values.materials
        onSave({
          stage: values.stage,
          craftsmanUserId: values.craftsmanUserId,
          handedQty: availableQty,
          // Bạc vào khâu lấy từ dòng BTP xuất kho; đá giao máy chủ tính từ các dòng đá — không gửi
          // kèm tổng, gửi cả hai là cộng đôi.
          handedSilverWeight: firstStage || autoFiledBtp ? null : values.handedSilverWeight || null,
          note: values.note.trim(),
          materials: materialLines.map(handoverLinePayload),
        })
      }}
      saving={saving}
      submitDisabled={!stage || !craftsmanUserId || uploading}
      submitLabel="Giao cho thợ"
      pendingLabel="Đang giao…"
      maxWidth="sm"
      onClose={onClose}
      onExited={() => undefined}
    >
      <Alert severity="info" sx={{ mt: 1 }}>
        Lưu thông tin giao trước. Kho chỉ xuất hàng khi thợ bấm “Xác nhận”.
      </Alert>
      <Typography variant="body2" sx={{ mt: 1 }}>Khâu: <b>{stage ? STAGE_LABEL[stage] : '—'}</b></Typography>
      <FormRow columns={1}>
        <FormSelect<Values>
          name="craftsmanUserId"
          label="Thợ"
          required
          options={workers.map((worker) => ({ value: worker.id, label: worker.fullName || worker.username }))}
        />
      </FormRow>
      <FormRow columns={2}>
        <FormTextField<Values>
          name="handedQty"
          label="Số lượng giao"
          type="number"
          readOnly
          required
          rules={{
            validate: (value) => {
              const qty = Number(value)
              if (!Number.isInteger(qty) || qty < 1) return 'Số lượng giao phải từ 1'
              if (ticket && qty > ticket.availableQty) return `Không quá số phiếu đang có (${ticket.availableQty})`
              if (autoCutBtp && cutBtp && qty > cutBtp.leftQty) {
                return `Phôi BTP đã cắt chỉ còn ${formatQty(String(cutBtp.leftQty))} chiếc`
              }
              return true
            },
          }}
        />
        {!firstStage && !autoFiledBtp ? (
          <FormQtyField<Values>
            name="handedSilverWeight"
            label="TL bạc giao (g)"
            required
            rules={{ validate: (value) => Number(value) > 0 || 'Nhập trọng lượng bạc giao' }}
          />
        ) : null}
      </FormRow>
      {autoCutBtp && cutBtp ? (
        <Alert severity="info" sx={{ mt: 1 }}>
          Tự gắn {cutBtpLabel}. Còn {formatQty(String(cutBtp.leftQty))} chiếc ·{' '}
          {formatQty(String(cutBtp.leftWeight))} g.
          {autoCutWeight != null
            ? ` Dự kiến xuất ${autoCutQty} chiếc · ${formatQty(String(autoCutWeight))} g.`
            : ''}{' '}
          Kho xuất khi thợ bấm “Xác nhận”.
        </Alert>
      ) : (
        <>
          {missingCutBtpLink ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Đơn đã có thời điểm cắt cây nhưng chưa lưu mã phôi BTP và số lượng cân trên phiếu mẹ,
              nên chưa thể tự gắn phôi. Hãy kiểm tra dữ liệu cắt cây; nếu cần giao ngay, chọn BTP thủ công.
            </Alert>
          ) : null}
          {autoFiledBtp ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              Tự xuất BTP đã nguội của đơn: {autoFiledBtp.returnedQty ?? availableQty} chiếc ·{' '}
              {formatQty(autoFiledBtp.returnedSilverWeight ?? '0')} g. Kho xuất khi thợ bấm “Xác nhận”.
            </Alert>
          ) : null}
          <HandoverMaterialsField
            form={form}
            stage={stage || null}
            blank={cutBtp}
            stoneOnly={autoFiledBtp != null}
            readOnly={saving}
            onUploadingChange={setUploading}
          />
        </>
      )}
      <FormTextField<Values> name="note" label="Ghi chú" multiline minRows={2} maxRows={5} />
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
  /** `count`: số viên thừa QC đếm — chỉ mã cấp kèm số viên; mã chỉ cấp theo ct để trống. */
  returnedStones: Array<{ materialId: string; weight: string; count: string }>
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
    count: entry.returnedAt && line.stoneCount != null && line.returnedCount != null ? String(line.returnedCount) : '',
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
      (entry.stage === 'FILING' || entry.stage === 'STONE_SETTING')
    // Sửa lại kết quả đã nhận: điền sẵn số liệu QC đã nhập lần trước.
    if (entry.returnedAt) {
      setOutcome((entry.defectQty ?? 0) > 0 ? (entry.returnedQty === 0 ? 'all' : 'partial') : 'ok')
      form.reset({
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
  /** Nguội / Vào đá: QC tách hàng đạt / hàng lỗi / nguyên liệu thừa trên cả phiếu mẹ và phiếu con. */
  const keeperStage =
    entry != null && (entry.stage === 'FILING' || entry.stage === 'STONE_SETTING')
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
  const legacyReturnedCount = useWatch({ control: form.control, name: 'legacyReturnedCount' })
  /**
   * TL đá gắn lên BTP — cùng cách BE tính lúc QC lưu (ưu tiên TL đá 3D chia theo SL giao, rồi TL
   * đá cấp − gói thừa). QC cân cả cụm bạc + đá nên mốc so là bạc vào khâu + TL đá gắn.
   */
  const stoneSet =
    stoneStage && entry
      ? stoneSetWeight({
          stone3dGram: order.stoneWeight != null ? Number(order.stoneWeight) : null,
          orderQty: order.qty,
          handedQty: entry.handedQty ?? order.qty,
          handedGram:
            entry.handedStoneWeight != null || entry.issuedStoneWeight != null ? stoneHandedWeight : null,
          allWeighed: entry.stoneLines.length > 0 && legacyStones.length === 0,
          returnedPackGram: returnedStones.reduce((sum, line) => sum + Number(line.weight || 0), 0) / CT_PER_GRAM,
          stonesHanded:
            entry.handedStoneCount != null || entry.issuedStoneCount > 0
              ? Math.max(
                  0,
                  (entry.handedStoneCount ?? 0) + entry.issuedStoneCount - (entry.stoneReturnedEarlyCount ?? 0),
                )
              : null,
          returnedCount: Number(legacyReturnedCount || 0),
        })
      : null
  const stone = stoneSet?.gram ?? 0
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
              .map((line) => ({
                materialId: line.materialId,
                weight: ctToGram(line.weight),
                ...(line.count !== '' ? { count: Number(line.count) } : {}),
              })),
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
      // Nguội / Vào đá: mọi kết quả QC đều chờ thủ kho xác nhận rồi mới nhập kho, chuyển khâu.
      submitColor={keeperStage && outcome === 'all' ? 'error' : undefined}
      submitLabel={
        keeperStage
          ? revising
            ? 'Lưu bản sửa'
            : 'Lưu QC'
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
                Đá gắn:{' '}
                {stoneSet ? (
                  <>
                    <b>{formatCt(stoneSet.gram)}</b> (= <b>{formatQty(String(stoneSet.gram))}</b> g) ·{' '}
                    {STONE_SET_SOURCE_LABEL[stoneSet.source]}
                  </>
                ) : (
                  '—'
                )}
              </Typography>
              <Typography variant="body2">
                BTP dự kiến (bạc vào khâu + đá gắn):{' '}
                <b>{silverLimit != null ? formatQty(String(silverLimit)) : '—'}</b> g — cân lại cả cụm, không vượt số này
              </Typography>
            </>
          ) : null}
        </Box>
      ) : null}

      <FormRow columns={1}>
        <TextInput label="Người QC" value={operatorName} readOnly />
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

      {/* Đá thừa nhập trước số lượng / TL sản phẩm đạt: QC cân gói đá thừa rồi mới cân cả cụm. */}
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
            // Mã cấp kèm số viên: QC nhập cả ct thừa lẫn số viên thừa; mã chỉ cấp theo ct chỉ nhập ct.
            const hasCount = line.stoneCount != null
            const countText = returnedStones[index]?.count ?? ''
            const countNum = countText !== '' ? Number(countText) : null
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
                  <KcsImages images={line.images} title="Ảnh gói đá lúc cấp" />
                </Box>
                <Stack spacing={1}>
                  <FormQtyField<ReturnValues>
                    name={`returnedStones.${index}.weight`}
                    label="TL gói đá thừa (ct)"
                    helperText={
                      preview && returned > 0
                        ? `${preview.returnedCount != null && countNum == null ? `≈ ${preview.returnedCount} viên thừa → ` : ''}xuất ${formatQty(String(preview.usedQty))} ${line.unit}`
                        : `Không thừa → xuất hết ${formatQty(line.qty)} ${line.unit}`
                    }
                    rules={{
                      validate: (value) =>
                        !value || Number(value) <= packCt || `Không quá ${formatCt(line.weight)} đã cấp`,
                    }}
                  />
                  {hasCount ? (
                    <FormTextField<ReturnValues>
                      name={`returnedStones.${index}.count`}
                      label="Số viên đá thừa"
                      type="number"
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                      transform={(value) => value.replace(/[^\d]/g, '')}
                      required={returned > 0}
                      helperText={
                        countNum != null && countNum <= line.stoneCount!
                          ? `Đã cấp ${line.stoneCount} viên · dùng ${line.stoneCount! - countNum} viên`
                          : `Đã cấp ${line.stoneCount} viên — đếm số viên còn thừa`
                      }
                      // `required` đổi theo TL gói thừa — react-hook-form giữ luật cũ, nên luật thật nằm ở validate.
                      rules={{
                        required: false,
                        validate: (value) => {
                          const weight = Number(form.getValues(`returnedStones.${index}.weight`) || 0)
                          if (value === '' || value == null) return weight > 0 ? 'Nhập số viên đá thừa' : true
                          const n = Number(value)
                          if (!Number.isInteger(n) || n < 0) return 'Số viên không hợp lệ'
                          if (n > line.stoneCount!) return `Không quá ${line.stoneCount} viên đã cấp`
                          if (n > 0 && weight <= 0) return 'Có viên thừa thì phải cân TL gói thừa'
                          return true
                        },
                      }}
                    />
                  ) : null}
                </Stack>
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
