import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Controller, useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import {
  cancelMaterialRequestApi,
  issueMaterialRequestApi,
  listBtpOptionsApi,
  listNvlOptionsApi,
  rejectMaterialRequestApi,
  returnStoneEarlyApi,
  requestMaterialApi,
  type EarlyStoneReturnPayload,
  type IssueMaterialPayload,
  type MaterialRequest,
  type MaterialRequestKind,
  type MaterialRequestPayload,
  type MaterialRequestStatus,
  type ProductionOrderDetail,
  type StageCode,
  type TicketMaterials,
} from '../api/productionOrders'
import {
  formatQty,
  formatQtyInput,
  gramReadout,
  parseQtyInput,
  pasteIntoQty,
  stockSummary,
  typedDecimalAsComma,
  ctToGram,
  formatCt,
  gramToCt,
  type StockSnapshot,
} from '../api/inventory'
import {
  CrudDialogShell,
  FormQtyField,
  FormRow,
  FormSelect,
  FormTextField,
  SelectInput,
  STICKY_END_CELL_SX,
  STICKY_END_HEAD_SX,
  TextInput,
} from '../components/ui'
import { CatalogPicker, type CatalogPickerItem } from './CatalogPicker'
import { formatDateShort, SILVER_LOSS_TONE, silverLossLevel, STAGE_LABEL } from './catalog'
import { stoneAmountText, stoneQtyFromCt, stoneUnitKind } from './stoneInput'
import { EarlyStoneReturnDialog } from './EarlyStoneReturnDialog'
import { useOrderMutation } from './useOrderMutation'

export const KIND_LABEL: Record<MaterialRequestKind, string> = {
  METAL: 'Bạc / kim loại (g)',
  STONE: 'Đá (viên)',
  OTHER: 'Khác',
}

export const REQUEST_STATUS_META: Record<
  MaterialRequestStatus,
  { label: string; color: 'warning' | 'success' | 'error' | 'default' }
> = {
  PENDING: { label: 'Chờ xuất', color: 'warning' },
  ISSUED: { label: 'Đã xuất', color: 'success' },
  REJECTED: { label: 'Không xuất', color: 'error' },
  CANCELLED: { label: 'Thợ đã huỷ', color: 'default' },
}

/** Nhãn trạng thái của yêu cầu — đá xin thêm ở Vào đá chưa xuất kho cho tới khi thủ kho xác nhận. */
export function requestStatusMeta(request: Pick<MaterialRequest, 'status' | 'holdStatus'>) {
  if (request.status === 'ISSUED' && request.holdStatus === 'HELD') {
    return { label: 'Đã cấp · giữ chỗ', color: 'warning' as const }
  }
  if (request.status === 'ISSUED' && request.holdStatus === 'RELEASED') {
    return { label: 'Thừa hết · không xuất', color: 'default' as const }
  }
  return REQUEST_STATUS_META[request.status]
}

const COUNT_UNITS = new Set(['viên', 'vien'])

type StockSource = 'NVL' | 'BTP'

/**
 * Kho xuất theo khâu, khớp BE: Nguội lấy phôi ở kho BTP, Vào đá lấy ở kho NVL chính — hai khâu
 * này bắt buộc xuất lúc giao. Khắc / Bóng / Xi không xuất kho, chỉ chuyển hàng từ khâu trước.
 */
export function stageSources(stage: StageCode | null | undefined): StockSource[] {
  if (stage === 'FILING') return ['BTP']
  if (stage === 'STONE_SETTING') return ['NVL', 'BTP']
  return []
}

/**
 * Kho thợ được xin thêm: Nguội xin phôi BTP, Vào đá chỉ xin đá (kho NVL chính) — BTP đã nguội
 * xuất lúc giao khâu nên không xin lại.
 */
function requestSources(stage: StageCode | null | undefined): StockSource[] {
  if (stage === 'FILING') return ['BTP']
  if (stage === 'STONE_SETTING') return ['NVL']
  return []
}

/** Tên thứ được xin theo khâu — nhãn nút / hộp xin thêm. */
function requestNoun(stage: StageCode | null | undefined) {
  if (stage === 'STONE_SETTING') return 'đá'
  if (stage === 'FILING') return 'BTP'
  return 'NVL'
}

/** Khâu có xuất kho cho thợ (và thợ được xin thêm) hay không. */
export function stageIssuesStock(stage: StageCode | null | undefined) {
  return stageSources(stage).length > 0
}

function sourcesNote(stage: StageCode | null | undefined) {
  const sources = stageSources(stage)
  if (!stage || sources.length === 0) return ''
  return ` Khâu ${STAGE_LABEL[stage]} lấy ở ${sources[0] === 'BTP' ? 'kho BTP' : 'kho NVL chính'}.`
}

function materialLabel(material: { sku: string | null; name: string }) {
  return material.sku ? `${material.sku} — ${material.name}` : material.name
}

function LossText({ loss, percent, unit }: { loss: string | number | null; percent: string | null; unit: string }) {
  if (loss == null) return null
  const level = silverLossLevel(percent)
  const tone = level ? SILVER_LOSS_TONE[level] : null
  return (
    <Box
      component="span"
      sx={{ px: tone ? 0.5 : 0, borderRadius: 0.5, bgcolor: tone?.bg, color: tone?.fg, fontWeight: 600 }}
    >
      {typeof loss === 'number' ? loss : formatQty(loss)} {unit}
      {percent != null ? ` (${formatQty(percent)}%)` : ''}
    </Box>
  )
}

/** Ô gọn ở bảng phiếu con: đã xuất thêm bao nhiêu, còn yêu cầu chờ, hao hụt cả phiếu. */
export function TicketMaterialsCell({ materials }: { materials: TicketMaterials }) {
  const metal = Number(materials.issuedMetalWeight)
  const empty = !metal && !materials.issuedStoneCount && !materials.pendingCount && materials.silverLoss == null
  if (empty) return <>—</>
  return (
    <Stack spacing={0.25}>
      {metal || materials.issuedStoneCount ? (
        <Typography variant="caption" sx={{ display: 'block' }}>
          {[
            metal ? `${formatQty(materials.issuedMetalWeight)} g bạc` : null,
            materials.issuedStoneCount ? `${materials.issuedStoneCount} viên đá` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      ) : null}
      {materials.silverLoss != null ? (
        <Typography variant="caption" sx={{ display: 'block' }}>
          hao hụt <LossText loss={materials.silverLoss} percent={materials.silverLossPercent} unit="g" />
        </Typography>
      ) : null}
      {materials.stoneLoss ? (
        <Typography variant="caption" sx={{ display: 'block' }}>
          mất <LossText loss={materials.stoneLoss} percent={materials.stoneLossPercent} unit="viên đá" />
        </Typography>
      ) : null}
      {materials.pendingCount ? (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', fontWeight: 600 }}>
          {materials.pendingCount} yêu cầu chờ xuất
        </Typography>
      ) : null}
    </Stack>
  )
}

// ---------------------------------------------------------------- Thợ xin xuất

type RequestValues = { materialId: string; qty: string; weight: string; note: string }
const EMPTY_REQUEST: RequestValues = { materialId: '', qty: '', weight: '', note: '' }

type StockPick = { id: string; unit: string; item: CatalogPickerItem }

/** Thợ đang làm khâu xin xuất thêm một mã NVL (bạc, đá…) — kho cân rồi mới xuất. */
export function MaterialRequestDialog({
  open,
  ticketCode,
  stage,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  ticketCode: string
  stage: StageCode | null
  saving: boolean
  onClose: () => void
  onSave: (payload: MaterialRequestPayload) => void
}) {
  const form = useForm<RequestValues>({ defaultValues: EMPTY_REQUEST })
  const materialId = useWatch({ control: form.control, name: 'materialId' })

  const stageLabel = stage ? STAGE_LABEL[stage] : null
  const sources = requestSources(stage)
  const noun = requestNoun(stage)
  const stoneOnly = stage === 'STONE_SETTING'
  const nvlOptions = useQuery({
    queryKey: ['nvl-options'],
    queryFn: () => listNvlOptionsApi(),
    enabled: open && sources.includes('NVL'),
    staleTime: 60_000,
  })
  const btpOptions = useQuery({
    queryKey: ['btp-options'],
    queryFn: () => listBtpOptionsApi(),
    enabled: open && sources.includes('BTP'),
    staleTime: 60_000,
  })

  const picks = useMemo<StockPick[]>(() => {
    const pick = (
      warehouse: string,
      item: { id: string; sku: string | null; name: string; unit: string; qty: string } & Partial<StockSnapshot>,
      images: Array<{ url: string }>,
    ): StockPick => ({
      id: item.id,
      unit: item.unit,
      item: {
        id: item.id,
        label: materialLabel(item),
        summary: `${warehouse} · ${stockSummary(item)}`,
        thumb: images[0]?.url ?? null,
      },
    })
    return [
      ...(sources.includes('NVL') ? (nvlOptions.data ?? []) : [])
        // Vào đá chỉ xin đá: bỏ các mã bạc / NVL khác của kho NVL chính.
        .filter((item) => !stoneOnly || suggestKindOf(item.unit, item.metalKind) === 'STONE')
        .map((item) => pick('Kho NVL chính', item, item.images)),
      ...(sources.includes('BTP') ? (btpOptions.data ?? []) : []).map((item) => pick('Kho BTP', item, item.images)),
    ]
  }, [nvlOptions.data, btpOptions.data, sources.join(), stoneOnly])
  const pickerItems = useMemo(() => picks.map((pick) => pick.item), [picks])
  const selected = picks.find((pick) => pick.id === materialId)
  // Đá (Vào đá): mã ct / g chỉ nhập TL; mã viên nhập cả số viên lẫn TL. Khâu Nguội xin BTP theo số lượng.
  const stoneUnit = stoneOnly ? stoneUnitKind(selected?.unit) : null
  const weightOnly = stoneUnit === 'weight'
  const needsWeight = stoneOnly
  const needsQty = !weightOnly

  useEffect(() => {
    if (open) form.reset(EMPTY_REQUEST)
  }, [open, form])

  const title = `Xin xuất ${noun} — phiếu ${ticketCode}`
  return (
    <CrudDialogShell<RequestValues>
      open={open}
      kind="create"
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={(values) =>
        onSave({
          materialId: values.materialId,
          // Đá ct / g chỉ gửi TL (BE suy số lượng); đá viên gửi cả hai; BTP chỉ số lượng.
          ...(needsQty ? { qty: values.qty } : {}),
          ...(needsWeight ? { weight: ctToGram(values.weight) } : {}),
          note: values.note.trim() || undefined,
        })
      }
      saving={saving}
      submitLabel="Gửi yêu cầu"
      maxWidth="sm"
      onClose={onClose}
      onExited={() => undefined}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Xin thêm {noun} cho khâu {stageLabel ? <b>{stageLabel}</b> : 'đang làm'}.{sourcesNote(stage)}
      </Typography>
      <Controller
        control={form.control}
        name="materialId"
        rules={{ required: 'Chọn mã cần xuất' }}
        render={({ field, fieldState }) => (
          <CatalogPicker
            value={field.value}
            options={pickerItems}
            label={`Mã ${noun}`}
            placeholder="Tìm theo mã hoặc tên"
            loadingText="Đang tải kho…"
            noOptionsText="Không có mã còn tồn"
            loading={nvlOptions.isLoading || btpOptions.isLoading}
            required
            errorText={fieldState.error?.message}
            inputRef={field.ref}
            onBlur={field.onBlur}
            onChange={field.onChange}
          />
        )}
      />
      <FormRow columns={2}>
        {needsQty ? (
          <FormQtyField<RequestValues>
            name="qty"
            label={
              stoneUnit === 'count'
                ? 'Số viên xin (theo nhãn gói)'
                : `Số lượng xin${selected ? ` (${selected.unit})` : ''}`
            }
            required
            rules={{
              validate: (value) =>
                !(Number(value) > 0)
                  ? 'Số lượng phải lớn hơn 0'
                  : stoneUnit === 'count' && !Number.isInteger(Number(value))
                    ? 'Số viên phải là số nguyên'
                    : true,
            }}
          />
        ) : null}
        {needsWeight ? (
          <FormQtyField<RequestValues>
            name="weight"
            label="TL xin (ct)"
            required
            helperText={
              weightOnly
                ? `Đá tính theo ${selected?.unit} — chỉ nhập trọng lượng`
                : stoneUnit === 'count'
                  ? 'Đá tính theo viên — nhập cả số viên lẫn TL'
                  : undefined
            }
            rules={{ validate: (value) => Number(value) > 0 || 'Trọng lượng phải lớn hơn 0' }}
          />
        ) : null}
        <FormTextField<RequestValues> name="note" label="Ghi chú" placeholder="vd thiếu bạc hàn khoá" />
      </FormRow>
    </CrudDialogShell>
  )
}

// ---------------------------------------------------------------- Kho duyệt xuất

type IssueValues = { kind: MaterialRequestKind; qty: string; weight: string; stoneCount: string }

/** Kho / người giao cân rồi xuất theo yêu cầu. Số thực xuất có thể khác số thợ xin. */
export function IssueMaterialDialog({
  request,
  suggestedKind,
  saving,
  onClose,
  onSave,
}: {
  request: MaterialRequest | null
  suggestedKind?: MaterialRequestKind
  saving: boolean
  onClose: () => void
  onSave: (payload: IssueMaterialPayload) => void
}) {
  const form = useForm<IssueValues>({ defaultValues: { kind: 'METAL', qty: '', weight: '', stoneCount: '' } })
  const kind = useWatch({ control: form.control, name: 'kind' })
  const qty = useWatch({ control: form.control, name: 'qty' })
  const unit = request?.material.unit ?? ''
  const blankQty = request?.blankLeft?.qty != null ? Number(request.blankLeft.qty) : null
  const blankWeight = request?.blankLeft?.weight != null ? Number(request.blankLeft.weight) : null
  /** Đá ở Vào đá của phiếu con: chỉ giữ chỗ, QC cân gói thừa, thủ kho xác nhận mới xuất kho (khớp BE). */
  const holdMode = kind === 'STONE' && request?.stage === 'STONE_SETTING' && request.subTicketNo != null
  const stoneKind = kind === 'STONE'
  /** Đá tính theo ct / g: chỉ nhập TL (ct), số lượng tự suy từ TL (không có ô Số lượng). */
  const weightOnly = stoneKind && stoneUnitKind(unit) === 'weight'
  /** Đá tính theo viên: nhập cả số viên (số lượng) lẫn TL; số viên theo nhãn gói chính là số lượng. */
  const countStone = stoneKind && stoneUnitKind(unit) === 'count'

  useEffect(() => {
    if (!request) return
    form.reset({
      kind: suggestedKind ?? request.kind,
      qty: request.requestedQty,
      // Thợ đã xin kèm TL (đá) thì điền sẵn, kho cân lại sửa được; TL lưu theo g, ô nhập theo ct.
      weight: request.requestedWeight ? gramToCt(request.requestedWeight) : '',
      stoneCount: '',
    })
  }, [request, suggestedKind, form])

  // Đơn vị gram thì TL cân chính là số lượng xuất.
  useEffect(() => {
    if (kind === 'METAL' && ['g', 'gr', 'gram', 'gam'].includes(unit.trim().toLowerCase())) {
      form.setValue('weight', qty)
    }
  }, [kind, qty, unit, form])

  // Đá cân TL theo ct (gửi API đổi ra g). Đá tính theo ct / g: số lượng suy từ TL — kho chỉ cần cân.
  const weight = useWatch({ control: form.control, name: 'weight' })
  useEffect(() => {
    if (!weightOnly || !(Number(weight) > 0)) return
    form.setValue('qty', stoneQtyFromCt(unit, weight))
  }, [weightOnly, weight, unit, form])

  const title = request ? `${holdMode ? 'Cấp đá' : 'Xuất NVL'} cho phiếu ${request.ticketCode}` : ''
  return (
    <CrudDialogShell<IssueValues>
      open={request != null}
      kind="create"
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={(values) =>
        onSave({
          kind: values.kind,
          qty: values.qty,
          weight: (values.kind === 'STONE' ? ctToGram(values.weight) : values.weight) || null,
          stoneCount: values.stoneCount ? Number(values.stoneCount) : null,
        })
      }
      saving={saving}
      submitLabel={holdMode ? 'Cấp đá (giữ chỗ)' : 'Xuất kho'}
      maxWidth="sm"
      onClose={onClose}
      onExited={() => undefined}
    >
      {request ? (
        <Alert severity="info" sx={{ mt: 1 }}>
          {request.requestedByName} xin{' '}
          <b>
            {stoneAmountText({ qty: request.requestedQty, weight: request.requestedWeight, unit })}
          </b>{' '}
          {materialLabel(request.material)} ({request.material.warehouseName})
          {request.stage ? ` cho khâu ${STAGE_LABEL[request.stage]}` : ''}.
          {request.note ? ` Ghi chú: ${request.note}` : ''}
        </Alert>
      ) : null}
      {holdMode ? (
        <Alert severity="warning" sx={{ py: 0.25 }}>
          Đá chỉ giữ chỗ, chưa xuất kho. Cân <b>cả gói</b>.
        </Alert>
      ) : null}
      <FormRow columns={2}>
        <FormSelect<IssueValues, MaterialRequestKind>
          name="kind"
          label="Tính hao hụt theo"
          required
          options={(['METAL', 'STONE', 'OTHER'] as const).map((value) => ({ value, label: KIND_LABEL[value] }))}
          helperText="Bạc tính gram, đá tính viên, loại khác chỉ ghi nhận"
        />
        {weightOnly ? (
          <Box />
        ) : (
          <FormQtyField<IssueValues>
            name="qty"
            label={
              countStone
                ? `Số viên ${holdMode ? 'cấp' : 'xuất'} (theo nhãn gói)`
                : `Số lượng ${holdMode ? 'cấp' : 'xuất'} (${unit})`
            }
            required
            helperText={blankQty != null ? `Phôi của đơn còn ${formatQty(String(blankQty))} ${unit}` : undefined}
            rules={{
              validate: (value) => {
                if (!(Number(value) > 0)) return 'Số lượng phải lớn hơn 0'
                if (countStone && !Number.isInteger(Number(value))) return 'Số viên phải là số nguyên'
                if (blankQty != null && Number(value) > blankQty) {
                  return `Phôi của đơn chỉ còn ${formatQty(String(blankQty))} ${unit}`
                }
                return true
              },
            }}
          />
        )}
      </FormRow>
      <FormRow columns={2}>
        <FormQtyField<IssueValues>
          name="weight"
          label={stoneKind ? (holdMode ? 'TL cả gói đá (ct)' : 'TL đá xuất (ct)') : 'TL cân lúc xuất (g)'}
          required={kind === 'METAL' || stoneKind}
          helperText={
            blankWeight != null
              ? `Phôi của đơn còn ${formatQty(String(blankWeight))} g`
              : kind === 'METAL'
                ? 'Cộng vào bạc vào khâu'
                : weightOnly
                  ? `Đá tính theo ${unit} — SL cấp ${formatQty(qty || '0')} ${unit} suy từ TL gói`
                  : holdMode
                    ? 'Mốc để tính đá đã dùng khi QC cân gói thừa'
                    : stoneKind
                      ? 'Đá luôn cân TL — mã tính theo viên nhập cả số viên lẫn TL'
                      : 'Không bắt buộc'
          }
          rules={{
            // `required` đổi theo loại NVL — ghi đè luật cũ react-hook-form còn giữ; luật thật nằm trong validate.
            required: false,
            validate: (value) => {
              if (kind === 'METAL' && !(Number(value) > 0)) return 'Bạc phải cân TL xuất'
              if (stoneKind && !(Number(value) > 0)) return holdMode ? 'Cân cả gói đá trước khi cấp' : 'Cân đá trước khi xuất'
              if (blankWeight != null && Number(value) > blankWeight) {
                return `Phôi của đơn chỉ còn ${formatQty(String(blankWeight))} g`
              }
              return true
            },
          }}
        />
        {stoneKind && !countStone ? (
          <FormTextField<IssueValues>
            name="stoneCount"
            label="Số viên đá (theo nhãn gói)"
            type="number"
            placeholder="Không bắt buộc"
            helperText="Đá tính theo TL — không đếm viên thì để trống"
            rules={{
              validate: (value) =>
                !value || (Number.isInteger(Number(value)) && Number(value) > 0) || 'Số viên phải từ 1',
            }}
          />
        ) : (
          <Box />
        )}
      </FormRow>
    </CrudDialogShell>
  )
}

type RejectValues = { reason: string }

export function RejectMaterialDialog({
  request,
  saving,
  onClose,
  onSave,
}: {
  request: MaterialRequest | null
  saving: boolean
  onClose: () => void
  onSave: (reason: string) => void
}) {
  const form = useForm<RejectValues>({ defaultValues: { reason: '' } })
  useEffect(() => {
    if (request) form.reset({ reason: '' })
  }, [request, form])
  const title = 'Không xuất theo yêu cầu'
  return (
    <CrudDialogShell<RejectValues>
      open={request != null}
      kind="create"
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={(values) => onSave(values.reason.trim())}
      saving={saving}
      submitLabel="Từ chối"
      maxWidth="xs"
      onClose={onClose}
      onExited={() => undefined}
    >
      <FormTextField<RejectValues>
        name="reason"
        label="Lý do"
        required
        multiline
        minRows={2}
        sx={{ mt: 1 }}
      />
    </CrudDialogShell>
  )
}

// ---------------------------------------------------------------- Bảng NVL của một phiếu

/**
 * NVL thợ đã xin / đã xuất cho một phiếu (con hoặc mẹ) và hao hụt cả phiếu. Thợ đang giữ khâu
 * xin xuất được; kho / người giao (không phải thợ) xuất hoặc từ chối.
 */
export function MaterialRequestsCard({
  order,
  ticketNo,
  materials,
  userId,
  canHandle,
  isAdmin,
}: {
  order: ProductionOrderDetail
  /** null = phiếu mẹ. */
  ticketNo: number | null
  materials: TicketMaterials
  userId: string | null
  /** Tài khoản không phải chỉ-thợ: được xuất / từ chối. */
  canHandle: boolean
  isAdmin: boolean
}) {
  const code = order.code
  const ticket = ticketNo != null ? order.subTickets.find((item) => item.no === ticketNo) : null
  const ticketCode = ticket?.code ?? code
  const openEntryId = ticket ? ticket.openEntryId : (order.workTicket?.openEntryId ?? null)
  const openEntry = openEntryId ? order.stages.find((entry) => entry.id === openEntryId) : undefined
  const requests = order.materialRequests.filter((request) =>
    ticketNo == null ? request.subTicketNo == null : request.subTicketNo === ticketNo,
  )

  const [requesting, setRequesting] = useState(false)
  const [issuing, setIssuing] = useState<MaterialRequest | null>(null)
  const [rejecting, setRejecting] = useState<MaterialRequest | null>(null)

  const create = useOrderMutation(
    code,
    (payload: MaterialRequestPayload) => requestMaterialApi(code, ticketNo, payload),
    `Đã gửi yêu cầu xuất ${requestNoun(openEntry?.stage)}`,
  )
  const cancel = useOrderMutation(code, (id: string) => cancelMaterialRequestApi(id), 'Đã huỷ yêu cầu')
  const issue = useOrderMutation(
    code,
    (payload: IssueMaterialPayload) => issueMaterialRequestApi(issuing?.id ?? '', payload),
    'Đã xuất NVL cho thợ',
  )
  const reject = useOrderMutation(
    code,
    (reason: string) => rejectMaterialRequestApi(rejecting?.id ?? '', reason),
    'Đã từ chối yêu cầu',
  )
  const [returningStone, setReturningStone] = useState(false)
  const returnStone = useOrderMutation(
    code,
    (payload: EarlyStoneReturnPayload) => returnStoneEarlyApi(code, openEntry?.id ?? '', payload),
    'Đã ghi trả lại túi đá cho thủ kho — phần trả về kho đã nhả giữ chỗ',
  )

  const holder = openEntry && !openEntry.submittedAt && (openEntry.craftsmanUserId === userId || isAdmin)
  const canRequest = Boolean(holder) && !order.finishedGoods && stageIssuesStock(openEntry?.stage)
  /** Thủ kho nhận lại túi đá thợ trả giữa khâu Vào đá (đổi size) — chỉ phiếu con còn túi đang giữ. */
  const canReturnStone =
    canHandle &&
    ticketNo != null &&
    openEntry?.stage === 'STONE_SETTING' &&
    openEntry.stoneLines.some((line) => Number(line.weight) > 0)

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 1 }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            NVL xuất theo phiếu {ticketCode}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {canReturnStone ? (
            <Button size="small" variant="outlined" onClick={() => setReturningStone(true)}>
              Trả lại túi đá cho thủ kho
            </Button>
          ) : null}
          {canRequest ? (
            <Button size="small" variant="contained" onClick={() => setRequesting(true)}>
              Xin xuất {requestNoun(openEntry?.stage)}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
          gap: 1,
          mb: 1.5,
        }}
      >
        <Stat label="Bạc vào phiếu" value={materials.silverIn != null ? `${formatQty(materials.silverIn)} g` : '—'} />
        <Stat
          label="Bạc đã xuất (giao + xin thêm)"
          value={Number(materials.issuedMetalWeight) ? `${formatQty(materials.issuedMetalWeight)} g` : '—'}
        />
        <Stat
          label="Hao hụt bạc (khâu đã QC)"
          value={
            materials.silverLoss != null ? (
              <LossText loss={materials.silverLoss} percent={materials.silverLossPercent} unit="g" />
            ) : (
              '—'
            )
          }
        />
        <Stat
          label="Đá (vào · mất)"
          value={
            materials.stonesIn ? (
              <>
                {materials.stonesIn} viên
                {materials.stoneLoss != null ? (
                  <>
                    {' · '}
                    <LossText loss={materials.stoneLoss} percent={materials.stoneLossPercent} unit="viên" />
                  </>
                ) : null}
              </>
            ) : (
              '—'
            )
          }
        />
      </Box>

      {materials.lines.length ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Đã xuất:{' '}
          {materials.lines
            .map(
              (line) =>
                `${materialLabel(line)} ${formatQty(line.qty)} ${line.unit}` +
                (line.weight ? ` (${line.kind === 'STONE' ? formatCt(line.weight) : `${formatQty(line.weight)} g`})` : '') +
                (line.times > 1 ? ` · ${line.times} lần` : ''),
            )
            .join('; ')}
        </Typography>
      ) : null}

      {requests.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa xuất NVL nào cho phiếu này.
        </Typography>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table
            size="small"
            sx={{
              minWidth: 720,
              borderCollapse: 'separate',
              borderSpacing: 0,
              '& td, & th': { px: 1, py: 0.6, fontSize: '0.82rem', borderColor: '#e9e0d4' },
              '& th': { fontWeight: 700, bgcolor: '#f8f3eb' },
              '& .MuiTableRow-hover:hover .dt-sticky-end': { bgcolor: '#f8f1e5' },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Lúc xin</TableCell>
                <TableCell>Khâu</TableCell>
                <TableCell>Mã NVL</TableCell>
                <TableCell align="right">Xin</TableCell>
                <TableCell align="right">Đã xuất</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell className="dt-sticky-end" sx={STICKY_END_HEAD_SX}>
                  Thao tác
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((request) => {
                const meta = requestStatusMeta(request)
                const pending = request.status === 'PENDING'
                const mine = request.requestedByUserId === userId
                return (
                  <TableRow key={request.id} hover>
                    <TableCell>
                      {formatDateShort(request.requestedAt)}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {request.requestedByName}
                      </Typography>
                    </TableCell>
                    <TableCell>{request.stage ? STAGE_LABEL[request.stage] : '—'}</TableCell>
                    <TableCell>
                      {materialLabel(request.material)}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {request.material.warehouseName}
                        {request.note ? ` · ${request.note}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {request.atHandover ? (
                        <Typography variant="caption" color="text.secondary">
                          xuất lúc giao
                        </Typography>
                      ) : (
                        <>
                          {stoneAmountText({
                            qty: request.requestedQty,
                            weight: request.requestedWeight,
                            unit: request.material.unit,
                          })}
                        </>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {request.status === 'ISSUED' ? (
                        <>
                          {formatQty(request.issuedQty ?? '0')} {request.material.unit}
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {[
                              request.issuedWeight
                                ? request.kind === 'STONE'
                                  ? formatCt(request.issuedWeight)
                                  : `${formatQty(request.issuedWeight)} g`
                                : null,
                              request.issuedStoneCount ? `${request.issuedStoneCount} viên` : null,
                              KIND_LABEL[request.kind],
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Typography>
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={meta.color} variant="outlined" label={meta.label} />
                      {request.handledByName && !pending ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {request.handledByName} · {formatDateShort(request.handledAt)}
                        </Typography>
                      ) : null}
                      {request.rejectReason ? (
                        <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                          {request.rejectReason}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell className="dt-sticky-end" sx={STICKY_END_CELL_SX}>
                      {pending ? (
                        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                          {canHandle && (!mine || isAdmin) ? (
                            <>
                              <Button size="small" variant="contained" onClick={() => setIssuing(request)}>
                                Xuất
                              </Button>
                              <Button size="small" color="error" onClick={() => setRejecting(request)}>
                                Từ chối
                              </Button>
                            </>
                          ) : null}
                          {mine || isAdmin ? (
                            <Button
                              size="small"
                              color="inherit"
                              disabled={cancel.isPending}
                              onClick={() => cancel.mutate(request.id)}
                            >
                              Huỷ
                            </Button>
                          ) : null}
                        </Stack>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <MaterialRequestDialog
        open={requesting}
        ticketCode={ticketCode}
        stage={openEntry?.stage ?? null}
        saving={create.isPending}
        onClose={() => setRequesting(false)}
        onSave={(payload) => create.mutate(payload, { onSuccess: () => setRequesting(false) })}
      />
      <IssueMaterialDialog
        request={issuing}
        saving={issue.isPending}
        onClose={() => setIssuing(null)}
        onSave={(payload) => issue.mutate(payload, { onSuccess: () => setIssuing(null) })}
      />
      <RejectMaterialDialog
        request={rejecting}
        saving={reject.isPending}
        onClose={() => setRejecting(null)}
        onSave={(reason) => reject.mutate(reason, { onSuccess: () => setRejecting(null) })}
      />
      <EarlyStoneReturnDialog
        entry={returningStone ? (openEntry ?? null) : null}
        ticketCode={ticketCode}
        saving={returnStone.isPending}
        onClose={() => setReturningStone(false)}
        onSave={(payload) => returnStone.mutate(payload, { onSuccess: () => setReturningStone(false) })}
      />
    </Box>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ p: 1, borderRadius: 1, bgcolor: '#fbf7f0' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Box>
  )
}

// ---------------------------------------------------------------- Xuất NVL lúc giao khâu

/** Một dòng NVL chọn trong hộp thoại giao khâu — các ô đều là chuỗi của form. */
export type HandoverMaterialLine = {
  materialId: string
  kind: MaterialRequestKind
  qty: string
  weight: string
  stoneCount: string
}

export const EMPTY_HANDOVER_LINE: HandoverMaterialLine = {
  materialId: '',
  kind: 'METAL',
  qty: '',
  weight: '',
  stoneCount: '',
}

const GRAM_UNITS = new Set(['g', 'gr', 'gram', 'gam'])

/** Gợi ý loại theo đơn vị trước, `metalKind` sau — dữ liệu kho đang gắn cả đá là bạc. */
function suggestKindOf(unit: string, metalKind: string | null | undefined): MaterialRequestKind {
  const key = unit.trim().toLowerCase()
  // nvl-options trả nhãn ("Đá"), chỗ khác trả mã ("STONE") — đá tính gram không được đoán thành bạc.
  const stone = metalKind === 'STONE' || metalKind === 'Đá'
  if (stone || COUNT_UNITS.has(key) || key === 'ct') return 'STONE'
  if (GRAM_UNITS.has(key) || metalKind) return 'METAL'
  return 'OTHER'
}

/** TL gửi API (g) của một dòng giao: dòng đá nhập theo ct. */
export function handoverLineGram(line: Pick<HandoverMaterialLine, 'kind' | 'weight'>) {
  return (line.kind === 'STONE' ? ctToGram(line.weight) : line.weight) || null
}

/** Tổng gram bạc / kim loại của các dòng — cộng vào TL hàng để ra bạc vào khâu. */
export function handoverMetalWeight(lines: readonly HandoverMaterialLine[]) {
  return lines
    .filter((line) => line.kind === 'METAL')
    .reduce((sum, line) => sum + (Number(line.weight) || 0), 0)
}

/**
 * Các dòng NVL người lên đơn chọn xuất kho cho thợ ngay lúc giao khâu. Bấm xác nhận giao là
 * mỗi dòng thành một phiếu xuất gắn mã đơn và trừ tồn.
 */
export function HandoverMaterialsField<T extends { materials: HandoverMaterialLine[] }>({
  form,
  stage,
  blank,
}: {
  form: UseFormReturn<T>
  stage: StageCode | null
  /** Phôi sau đúc của đơn còn chưa xuất — tổng xuất mã phôi không được vượt (khớp BE). */
  blank?: { materialId: string; leftQty: number; leftWeight: number } | null
}) {
  const stoneStage = stage === 'STONE_SETTING'
  const sources = stageSources(stage)
  // Form của hộp thoại giao có thêm các ô khác; ở đây chỉ động tới mảng `materials`.
  const control = form.control as unknown as UseFormReturn<{ materials: HandoverMaterialLine[] }>['control']
  const setValue = form.setValue as unknown as UseFormReturn<{ materials: HandoverMaterialLine[] }>['setValue']
  const lines = useFieldArray({ control, name: 'materials' })
  const values = useWatch({ control, name: 'materials' }) ?? []
  // Nguội / Vào đá bắt buộc xuất kho lúc giao: luôn giữ ít nhất một dòng.
  const required = sources.length > 0
  // Cộng mọi dòng cùng mã phôi: tách hai dòng cũng không lách được mốc.
  const blankTotals = values.reduce(
    (sum, item) =>
      blank && item?.materialId === blank.materialId
        ? { qty: sum.qty + (Number(item.qty) || 0), weight: sum.weight + (Number(item.weight) || 0) }
        : sum,
    { qty: 0, weight: 0 },
  )
  const { fields, append } = lines
  // Mở hộp thoại chỉ có sẵn một dòng; muốn thêm thì bấm "Thêm NVL". Đọc số dòng từ form (cập nhật
  // ngay khi append) thay vì `fields` — StrictMode chạy effect hai lần sẽ không thêm trùng dòng.
  useEffect(() => {
    const current = (form.getValues as unknown as () => { materials?: HandoverMaterialLine[] })().materials
    if (required && (current?.length ?? 0) === 0) {
      append({ ...EMPTY_HANDOVER_LINE })
    }
  }, [required, fields.length, append, form])

  const nvlOptions = useQuery({
    queryKey: ['nvl-options'],
    queryFn: () => listNvlOptionsApi(),
    enabled: sources.includes('NVL'),
    staleTime: 60_000,
  })
  const btpOptions = useQuery({
    queryKey: ['btp-options'],
    queryFn: () => listBtpOptionsApi(),
    enabled: sources.includes('BTP'),
    staleTime: 60_000,
  })
  const picks = useMemo(() => {
    const pick = (
      warehouse: string,
      item: { id: string; sku: string | null; name: string; unit: string; qty: string; metalKind?: string | null } &
        Partial<StockSnapshot>,
      images: Array<{ url: string }>,
    ) => ({
      id: item.id,
      unit: item.unit,
      kind: suggestKindOf(item.unit, item.metalKind),
      item: {
        id: item.id,
        label: materialLabel(item),
        summary: `${warehouse} · ${stockSummary(item)}`,
        thumb: images[0]?.url ?? null,
      } satisfies CatalogPickerItem,
    })
    return [
      ...(sources.includes('NVL') ? (nvlOptions.data ?? []) : []).map((item) =>
        pick('Kho NVL chính', item, item.images),
      ),
      // Phôi BTP là bạc — tính gram để vào bạc vào khâu.
      ...(sources.includes('BTP') ? (btpOptions.data ?? []) : []).map((item) => ({
        ...pick('Kho BTP', { ...item, metalKind: null }, item.images),
        kind: 'METAL' as const,
      })),
    ]
  }, [nvlOptions.data, btpOptions.data, sources.join()])
  const pickerItems = useMemo(() => picks.map((pick) => pick.item), [picks])
  const kindOptions = (['METAL', 'STONE', 'OTHER'] as const)
    .filter((value) => value !== 'STONE' || stoneStage)
    .map((value) => ({ value, label: KIND_LABEL[value] }))

  if (!required) {
    return (
      <Typography variant="body2" color="text.secondary">
        Khâu {stage ? STAGE_LABEL[stage] : 'này'} không xuất kho.
      </Typography>
    )
  }

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.25 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            NVL xuất kho cho thợ *
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Xác nhận giao là trừ tồn và tạo phiếu xuất gắn mã đơn.
            {sourcesNote(stage)}
          </Typography>
        </Box>
        <Button size="small" onClick={() => lines.append({ ...EMPTY_HANDOVER_LINE })}>
          Thêm NVL
        </Button>
      </Stack>
      <Stack spacing={1}>
        {lines.fields.map((field, index) => {
          const line = values[index] ?? EMPTY_HANDOVER_LINE
          const selected = picks.find((pick) => pick.id === line.materialId)
          const unit = selected?.unit ?? ''
          // Đá: mã ct / g chỉ nhập TL (số lượng suy từ TL), mã viên nhập cả số viên lẫn TL.
          const stoneUnit = line.kind === 'STONE' ? stoneUnitKind(unit) : null
          const weightOnly = stoneUnit === 'weight'
          const countStone = stoneUnit === 'count'
          const name = (key: keyof HandoverMaterialLine) => `materials.${index}.${key}` as const
          return (
            <Box
              key={field.id}
              sx={{ p: 1, borderRadius: 1, bgcolor: '#fbf7f0', display: 'grid', gap: 1 }}
            >
              <Controller
                control={control}
                name={name('materialId')}
                rules={{ required: 'Chọn mã NVL' }}
                render={({ field: picker, fieldState }) => (
                  <CatalogPicker
                    value={picker.value}
                    options={pickerItems}
                    label={`Mã NVL ${index + 1}`}
                    placeholder="Tìm theo mã hoặc tên"
                    loadingText="Đang tải kho…"
                    noOptionsText="Không có mã còn tồn"
                    loading={nvlOptions.isLoading || btpOptions.isLoading}
                    required
                    errorText={fieldState.error?.message}
                    inputRef={picker.ref}
                    onBlur={picker.onBlur}
                    onChange={(id) => {
                      picker.onChange(id)
                      const chosen = picks.find((pick) => pick.id === id)
                      if (chosen) {
                        const kind = chosen.kind === 'STONE' && !stoneStage ? 'OTHER' : chosen.kind
                        setValue(name('kind'), kind)
                        const typed = values[index]?.weight
                        if (kind === 'STONE' && stoneUnitKind(chosen.unit) === 'weight' && Number(typed) > 0) {
                          setValue(name('qty'), stoneQtyFromCt(chosen.unit, typed))
                        }
                      }
                    }}
                  />
                )}
              />
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: { xs: '1fr 1fr', sm: '1.2fr 1fr 1fr 1fr auto' },
                  alignItems: 'start',
                }}
              >
                <Controller
                  control={control}
                  name={name('kind')}
                  render={({ field: select }) => (
                    <SelectInput<MaterialRequestKind>
                      label="Tính theo"
                      options={kindOptions}
                      value={select.value as MaterialRequestKind}
                      onChange={(value) => select.onChange(value || 'OTHER')}
                    />
                  )}
                />
                {weightOnly ? (
                  <Box />
                ) : (
                  <Controller
                    control={control}
                    name={name('qty')}
                    rules={{
                      validate: (value) => {
                        if (!(Number(value) > 0)) return 'SL phải lớn hơn 0'
                        if (countStone && !Number.isInteger(Number(value))) return 'Số viên phải là số nguyên'
                        if (blank && line.materialId === blank.materialId && blankTotals.qty > blank.leftQty) {
                          return `Phôi của đơn chỉ còn ${formatQty(String(blank.leftQty))} ${unit || 'chiếc'}`
                        }
                        return true
                      },
                    }}
                    render={({ field: input, fieldState }) => (
                      <TextInput
                        label={countStone ? 'Số viên' : `SL xuất${unit ? ` (${unit})` : ''}`}
                        required
                        value={formatQtyInput(String(input.value ?? ''))}
                        inputRef={input.ref}
                        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                        errorText={fieldState.error?.message}
                        onChange={(event) => {
                          const next = parseQtyInput(
                            typedDecimalAsComma(event.target, (event.nativeEvent as InputEvent).data),
                          )
                          input.onChange(next)
                          if (line.kind === 'METAL' && GRAM_UNITS.has(unit.trim().toLowerCase())) {
                            setValue(name('weight'), next)
                          }
                        }}
                        onPaste={(event) => {
                          event.preventDefault()
                          const next = pasteIntoQty(event.target as HTMLInputElement, event.clipboardData.getData('text'))
                          input.onChange(next)
                          if (line.kind === 'METAL' && GRAM_UNITS.has(unit.trim().toLowerCase())) {
                            setValue(name('weight'), next)
                          }
                        }}
                      />
                    )}
                  />
                )}
                <Controller
                  control={control}
                  name={name('weight')}
                  rules={{
                    // `required` đổi theo loại NVL — ghi đè luật cũ react-hook-form còn giữ; luật thật nằm trong validate.
                    required: false,
                    validate: (value) => {
                      if (line.kind === 'METAL' && !(Number(value) > 0)) return 'Bạc phải cân TL'
                      if (line.kind === 'STONE' && !(Number(value) > 0)) return 'Đá phải cân TL (ct)'
                      if (blank && line.materialId === blank.materialId && blankTotals.weight > blank.leftWeight) {
                        return `Phôi của đơn chỉ còn ${formatQty(String(blank.leftWeight))} g`
                      }
                      return true
                    },
                  }}
                  render={({ field: input, fieldState }) => (
                    <TextInput
                      label={line.kind === 'STONE' ? 'TL cân (ct)' : 'TL cân (g)'}
                      required={line.kind === 'METAL' || line.kind === 'STONE'}
                      value={formatQtyInput(String(input.value ?? ''))}
                      inputRef={input.ref}
                      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                      errorText={fieldState.error?.message}
                      helperText={
                        weightOnly
                          ? `Đá tính theo ${unit} — chỉ nhập TL`
                          : line.kind === 'STONE'
                            ? undefined
                            : gramReadout(String(input.value ?? '')) || undefined
                      }
                      onChange={(event) => {
                        const next = parseQtyInput(
                          typedDecimalAsComma(event.target, (event.nativeEvent as InputEvent).data),
                        )
                        input.onChange(next)
                        if (weightOnly) setValue(name('qty'), stoneQtyFromCt(unit, next))
                      }}
                      onPaste={(event) => {
                        event.preventDefault()
                        const next = pasteIntoQty(event.target as HTMLInputElement, event.clipboardData.getData('text'))
                        input.onChange(next)
                        if (weightOnly) setValue(name('qty'), stoneQtyFromCt(unit, next))
                      }}
                    />
                  )}
                />
                {line.kind === 'STONE' && !countStone ? (
                  <Controller
                    control={control}
                    name={name('stoneCount')}
                    rules={{
                      // Số viên không bắt buộc — đá tấm / nhỏ chỉ cân TL.
                      validate: (value) =>
                        !value || (Number.isInteger(Number(value)) && Number(value) > 0) || 'Số viên phải từ 1',
                    }}
                    render={({ field: input, fieldState }) => (
                      <TextInput
                        label="Số viên"
                        placeholder="Không bắt buộc"
                        value={input.value}
                        inputRef={input.ref}
                        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                        errorText={fieldState.error?.message}
                        onChange={(event) => input.onChange(event.target.value.replace(/[^\d]/g, ''))}
                      />
                    )}
                  />
                ) : (
                  <Box />
                )}
                <Button
                  size="small"
                  color="error"
                  disabled={lines.fields.length <= 1}
                  onClick={() => lines.remove(index)}
                  sx={{ mt: 0.5 }}
                >
                  Bỏ
                </Button>
              </Box>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
