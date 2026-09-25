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
  requestMaterialApi,
  type IssueMaterialPayload,
  type MaterialRequest,
  type MaterialRequestKind,
  type MaterialRequestPayload,
  type MaterialRequestStatus,
  type ProductionOrderDetail,
  type StageCode,
  type TicketMaterials,
} from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import {
  CrudDialogShell,
  FormQtyField,
  FormRow,
  FormSelect,
  FormTextField,
  SelectInput,
  TextInput,
} from '../components/ui'
import { CatalogPicker, type CatalogPickerItem } from './CatalogPicker'
import { formatDateShort, SILVER_LOSS_TONE, silverLossLevel, STAGE_LABEL } from './catalog'
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

const COUNT_UNITS = new Set(['viên', 'vien'])

type StockSource = 'NVL' | 'BTP'

/**
 * Kho xuất theo khâu, khớp BE: Nguội lấy phôi ở kho BTP, Vào đá lấy ở kho NVL chính — hai khâu
 * này bắt buộc xuất lúc giao. Khắc / Bóng / Xi không xuất kho, chỉ chuyển hàng từ khâu trước.
 */
export function stageSources(stage: StageCode | null | undefined): StockSource[] {
  if (stage === 'FILING') return ['BTP']
  if (stage === 'STONE_SETTING') return ['NVL']
  return []
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

type RequestValues = { materialId: string; qty: string; note: string }
const EMPTY_REQUEST: RequestValues = { materialId: '', qty: '', note: '' }

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
  const sources = stageSources(stage)
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
      item: { id: string; sku: string | null; name: string; unit: string; qty: string },
      images: Array<{ url: string }>,
    ): StockPick => ({
      id: item.id,
      unit: item.unit,
      item: {
        id: item.id,
        label: materialLabel(item),
        summary: `${warehouse} · Tồn ${formatQty(item.qty)} ${item.unit}`,
        thumb: images[0]?.url ?? null,
      },
    })
    return [
      ...(sources.includes('NVL') ? (nvlOptions.data ?? []) : []).map((item) =>
        pick('Kho NVL chính', item, item.images),
      ),
      ...(sources.includes('BTP') ? (btpOptions.data ?? []) : []).map((item) => pick('Kho BTP', item, item.images)),
    ]
  }, [nvlOptions.data, btpOptions.data, sources.join()])
  const pickerItems = useMemo(() => picks.map((pick) => pick.item), [picks])
  const selected = picks.find((pick) => pick.id === materialId)

  useEffect(() => {
    if (open) form.reset(EMPTY_REQUEST)
  }, [open, form])

  const title = `Xin xuất NVL — phiếu ${ticketCode}`
  return (
    <CrudDialogShell<RequestValues>
      open={open}
      kind="create"
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={(values) =>
        onSave({ materialId: values.materialId, qty: values.qty, note: values.note.trim() || undefined })
      }
      saving={saving}
      submitLabel="Gửi yêu cầu"
      maxWidth="sm"
      onClose={onClose}
      onExited={() => undefined}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Xin thêm bạc / đá cho khâu {stageLabel ? <b>{stageLabel}</b> : 'đang làm'}. Kho cân và bấm xuất thì phần này
        mới trừ tồn và cộng vào bạc / đá vào khâu để tính hao hụt.{sourcesNote(stage)}
      </Typography>
      <Controller
        control={form.control}
        name="materialId"
        rules={{ required: 'Chọn mã cần xuất' }}
        render={({ field, fieldState }) => (
          <CatalogPicker
            value={field.value}
            options={pickerItems}
            label="Mã NVL"
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
        <FormQtyField<RequestValues>
          name="qty"
          label={`Số lượng xin${selected ? ` (${selected.unit})` : ''}`}
          required
          rules={{ validate: (value) => Number(value) > 0 || 'Số lượng phải lớn hơn 0' }}
        />
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
  const countUnit = COUNT_UNITS.has(unit.trim().toLowerCase())

  useEffect(() => {
    if (!request) return
    form.reset({
      kind: suggestedKind ?? request.kind,
      qty: request.requestedQty,
      weight: '',
      stoneCount: '',
    })
  }, [request, suggestedKind, form])

  // Đơn vị gram thì TL cân chính là số lượng xuất.
  useEffect(() => {
    if (kind === 'METAL' && ['g', 'gr', 'gram', 'gam'].includes(unit.trim().toLowerCase())) {
      form.setValue('weight', qty)
    }
  }, [kind, qty, unit, form])

  const title = request ? `Xuất NVL cho phiếu ${request.ticketCode}` : ''
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
          weight: values.weight || null,
          stoneCount: values.stoneCount ? Number(values.stoneCount) : null,
        })
      }
      saving={saving}
      submitLabel="Xuất kho"
      maxWidth="sm"
      onClose={onClose}
      onExited={() => undefined}
    >
      {request ? (
        <Alert severity="info" sx={{ mt: 1 }}>
          {request.requestedByName} xin <b>{formatQty(request.requestedQty)} {unit}</b>{' '}
          {materialLabel(request.material)} ({request.material.warehouseName})
          {request.stage ? ` cho khâu ${STAGE_LABEL[request.stage]}` : ''}.
          {request.note ? ` Ghi chú: ${request.note}` : ''}
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
        <FormQtyField<IssueValues>
          name="qty"
          label={`Số lượng xuất (${unit})`}
          required
          rules={{ validate: (value) => Number(value) > 0 || 'Số lượng phải lớn hơn 0' }}
        />
      </FormRow>
      <FormRow columns={2}>
        <FormQtyField<IssueValues>
          name="weight"
          label="TL cân lúc xuất (g)"
          required={kind === 'METAL'}
          helperText={kind === 'METAL' ? 'Cộng vào bạc vào khâu' : 'Không bắt buộc'}
          rules={{
            validate: (value) => kind !== 'METAL' || Number(value) > 0 || 'Bạc phải cân TL xuất',
          }}
        />
        {kind === 'STONE' ? (
          <FormTextField<IssueValues>
            name="stoneCount"
            label="Số viên đá"
            type="number"
            required={!countUnit}
            placeholder={countUnit ? `mặc định = số lượng xuất` : undefined}
            rules={{
              validate: (value) => {
                if (!value) return countUnit || `Mã tính theo ${unit} — nhập số viên`
                return (Number.isInteger(Number(value)) && Number(value) > 0) || 'Số viên phải từ 1'
              },
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
    'Đã gửi yêu cầu xuất NVL',
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

  const holder = openEntry && !openEntry.submittedAt && (openEntry.craftsmanUserId === userId || isAdmin)
  const canRequest = Boolean(holder) && !order.finishedGoods && stageIssuesStock(openEntry?.stage)

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
          <Typography variant="caption" color="text.secondary">
            Người lên đơn xuất lúc giao khâu; thiếu giữa chừng thợ xin thêm, kho cân và xuất. Mọi phần
            đã xuất cộng vào bạc / đá vào khâu.
          </Typography>
        </Box>
        {canRequest ? (
          <Button size="small" variant="contained" onClick={() => setRequesting(true)}>
            Xin xuất NVL
          </Button>
        ) : null}
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
          label="Hao hụt bạc (khâu đã KCS)"
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
                (line.weight ? ` (${formatQty(line.weight)} g)` : '') +
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
              '& td, & th': { px: 1, py: 0.6, fontSize: '0.82rem', borderColor: '#e9e0d4' },
              '& th': { fontWeight: 700, bgcolor: '#f8f3eb' },
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
                <TableCell>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((request) => {
                const meta = REQUEST_STATUS_META[request.status]
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
                          {formatQty(request.requestedQty)} {request.material.unit}
                        </>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {request.status === 'ISSUED' ? (
                        <>
                          {formatQty(request.issuedQty ?? '0')} {request.material.unit}
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {[
                              request.issuedWeight ? `${formatQty(request.issuedWeight)} g` : null,
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
                    <TableCell>
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
  if (metalKind === 'STONE' || COUNT_UNITS.has(key) || key === 'ct') return 'STONE'
  if (GRAM_UNITS.has(key) || (metalKind && metalKind !== 'STONE')) return 'METAL'
  return 'OTHER'
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
}: {
  form: UseFormReturn<T>
  stage: StageCode | null
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
  const { fields, append } = lines
  useEffect(() => {
    if (required && fields.length === 0) append({ ...EMPTY_HANDOVER_LINE })
  }, [required, fields.length, append])

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
      item: { id: string; sku: string | null; name: string; unit: string; qty: string; metalKind?: string | null },
      images: Array<{ url: string }>,
    ) => ({
      id: item.id,
      unit: item.unit,
      kind: suggestKindOf(item.unit, item.metalKind),
      item: {
        id: item.id,
        label: materialLabel(item),
        summary: `${warehouse} · Tồn ${formatQty(item.qty)} ${item.unit}`,
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
        Khâu {stage ? STAGE_LABEL[stage] : 'này'} không xuất kho — thợ nhận hàng từ khâu trước.
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
          const countUnit = COUNT_UNITS.has(unit.trim().toLowerCase())
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
                <Controller
                  control={control}
                  name={name('qty')}
                  rules={{ validate: (value) => Number(value) > 0 || 'SL phải lớn hơn 0' }}
                  render={({ field: input, fieldState }) => (
                    <TextInput
                      label={`SL xuất${unit ? ` (${unit})` : ''}`}
                      required
                      value={input.value}
                      inputRef={input.ref}
                      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                      errorText={fieldState.error?.message}
                      onChange={(event) => {
                        input.onChange(event.target.value)
                        if (line.kind === 'METAL' && GRAM_UNITS.has(unit.trim().toLowerCase())) {
                          setValue(name('weight'), event.target.value)
                        }
                      }}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={name('weight')}
                  rules={{
                    validate: (value) => line.kind !== 'METAL' || Number(value) > 0 || 'Bạc phải cân TL',
                  }}
                  render={({ field: input, fieldState }) => (
                    <TextInput
                      label="TL cân (g)"
                      required={line.kind === 'METAL'}
                      value={input.value}
                      inputRef={input.ref}
                      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                      errorText={fieldState.error?.message}
                      onChange={(event) => input.onChange(event.target.value)}
                    />
                  )}
                />
                {line.kind === 'STONE' ? (
                  <Controller
                    control={control}
                    name={name('stoneCount')}
                    rules={{
                      validate: (value) => {
                        if (!value) return countUnit || `Tính theo ${unit || 'đơn vị khác'} — nhập số viên`
                        return (Number.isInteger(Number(value)) && Number(value) > 0) || 'Số viên phải từ 1'
                      },
                    }}
                    render={({ field: input, fieldState }) => (
                      <TextInput
                        label="Số viên"
                        required={!countUnit}
                        placeholder={countUnit ? '= SL xuất' : undefined}
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
