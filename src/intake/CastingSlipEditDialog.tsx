import { useEffect, useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useWatch } from 'react-hook-form'
import { useAppForm } from '../components/ui/form/useAppForm'
import {
  getCastingSlipApi,
  listCastWorkersApi,
  listRestMaterialOptionsApi,
  type CastCastWorkerOption,
  type CastingSlip,
  type UpdateCastingSlipPayload,
} from '../api/castingSlips'
import { formatQty, qtyFromApi } from '../api/inventory'
import {
  DialogForm,
  FormAutocomplete,
  FormEditReasonBlock,
  FormMoneyField,
  FormQtyField,
  FormSelect,
} from '../components/ui'
import { formatDateTime } from '../orders/catalog'
import { CastingSlipMetalFormTable, CastingSlipMetalTable } from './CastingSlipMetalTable'
import { SlipStatusChip } from './CastingSlipStatusChip'

type MetalKey = 's999' | 'hoi' | 's925' | 'gold'

const METALS = [
  { key: 's999', gram: 'issueS999Gram', material: 'issueS999MaterialId', label: 'Bạc S999' },
  { key: 'hoi', gram: 'issueMasterAlloyGram', material: 'issueMasterAlloyMaterialId', label: 'Hội' },
  { key: 's925', gram: 'issueS925Gram', material: 'issueS925MaterialId', label: 'Bạc S925' },
  { key: 'gold', gram: 'issueGoldGram', material: 'issueGoldMaterialId', label: 'Vàng' },
] as const

type Values = {
  editReason: string
  assignedUserId: string | null
  grams: Record<MetalKey, string>
  materials: Record<MetalKey, string>
  tree: string
  silver: string
  plaster: string
  servicePrices: Record<string, string>
}

function gramText(value: string | null | undefined) {
  return value != null && value !== '' ? qtyFromApi(value) : ''
}

function formatGram(value: string | null | undefined) {
  return value != null && value !== '' ? formatQty(value) : '—'
}

function num(raw: string) {
  const n = raw.trim() ? Number(raw) : NaN
  return Number.isFinite(n) ? n : null
}

/** Cộng số thực lệch ở chữ số rất nhỏ — so ở 4 chữ số như lúc hiển thị. */
function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

function valuesOf(slip: CastingSlip | null): Values {
  const materialIds = slip?.issueMaterialIds ?? {}
  return {
    editReason: '',
    assignedUserId: slip?.startedByUserId ?? null,
    grams: Object.fromEntries(METALS.map((m) => [m.key, gramText(slip?.[m.gram])])) as Record<MetalKey, string>,
    materials: Object.fromEntries(METALS.map((m) => [m.key, materialIds[m.gram] ?? ''])) as Record<
      MetalKey,
      string
    >,
    tree: gramText(slip?.castTreeWeightGram),
    silver: gramText(slip?.silverUsedGram),
    plaster: gramText(slip?.plasterUsedGram),
    servicePrices: Object.fromEntries(
      (slip?.orders ?? []).map((line) => [
        line.intakeOrderId,
        line.serviceUnitPrice != null && line.serviceUnitPrice !== '' ? String(Number(line.serviceUnitPrice)) : '',
      ]),
    ),
  }
}

/** Thủ kho sửa được tới lúc chờ xác nhận; admin sửa được cả phiếu Đúc xong. */
export function canEditCastingSlip(slip: Pick<CastingSlip, 'status'>, isAdmin: boolean) {
  if (slip.status === 'CAST_FAILED') return false
  return slip.status !== 'DONE' || isAdmin
}

/**
 * Sửa phiếu đúc chưa đúc xong, cùng bố cục với phiếu xem chi tiết. Thợ đúc: trước khi thợ nhận phiếu.
 * Vật tư cấp: sau khi cấp (hoàn kho rồi trừ lại). Kết quả: khi chờ thủ kho xác nhận (đổi TL cây thì
 * nhập lại Kho BTP).
 */
export function CastingSlipEditDialog({
  slip,
  isAdmin,
  saving,
  onClose,
  onSave,
}: {
  slip: CastingSlip | null
  isAdmin: boolean
  saving: boolean
  onClose: () => void
  onSave: (payload: UpdateCastingSlipPayload) => void
}) {
  const open = Boolean(slip)
  const detail = useQuery({
    queryKey: ['casting-slip', 'edit', slip?.id],
    queryFn: () => getCastingSlipApi(slip!.id),
    enabled: open,
    staleTime: 0,
  })
  const current = detail.data ?? null
  const view = current ?? slip
  const status = current?.status
  const isService = Boolean(current?.isServiceCast)
  const canWorker = !isService && (status === 'PENDING_ISSUE' || status === 'WAIT_CASTING')
  const adminDone = status === 'DONE' && isAdmin
  const canIssue =
    status === 'WAIT_CASTING' || status === 'CASTING' || status === 'PENDING_CONFIRMATION' || adminDone
  const canResult = status === 'PENDING_CONFIRMATION' || adminDone
  const isCut = current?.restWeightGram != null

  const workers = useQuery({
    queryKey: ['casting-cast-workers'],
    queryFn: listCastWorkersApi,
    enabled: open && canWorker,
    staleTime: 60_000,
  })
  const materials = useQuery({
    queryKey: ['casting-rest-material-options'],
    queryFn: listRestMaterialOptionsApi,
    enabled: open && canIssue,
    staleTime: 0,
  })
  const materialOptions = useMemo(
    () =>
      (materials.data?.items ?? []).map((item) => ({
        value: item.id,
        label: item.sku ? `${item.sku} · ${item.name}` : item.name,
      })),
    [materials.data?.items],
  )

  const form = useAppForm<Values>({ defaultValues: valuesOf(null), mode: 'onChange' })
  useEffect(() => {
    if (current) form.reset(valuesOf(current))
  }, [current, form])

  const [grams, tree, silver] = useWatch({ control: form.control, name: ['grams', 'tree', 'silver'] })
  const issuedTotal = round4(
    (['s999', 'hoi', 's925'] as const).reduce((sum, key) => sum + (num(grams?.[key] ?? '') ?? 0), 0),
  )
  const treeGram = num(tree ?? '')
  const usedGram = num(silver ?? '')
  useEffect(() => {
    if (!canResult) return
    if (form.getFieldState('tree').isDirty) void form.trigger('tree')
    if (form.getFieldState('silver').isDirty) void form.trigger('silver')
  }, [canResult, tree, silver, issuedTotal, form])

  function submit(values: Values) {
    if (!current) return
    const initial = valuesOf(current)
    const payload: UpdateCastingSlipPayload = { editReason: values.editReason.trim() }
    if (canWorker && values.assignedUserId && values.assignedUserId !== initial.assignedUserId) {
      payload.assignedUserId = values.assignedUserId
    }
    if (canIssue) {
      const changed = METALS.some(
        (m) => values.grams[m.key] !== initial.grams[m.key] || values.materials[m.key] !== initial.materials[m.key],
      )
      if (changed) {
        for (const m of METALS) {
          payload[m.gram] = num(values.grams[m.key]) ?? 0
          if (values.materials[m.key]) payload[m.material] = values.materials[m.key]
        }
      }
    }
    if (canResult) {
      if (values.tree !== initial.tree) payload.castTreeWeightGram = num(values.tree)!
      if (values.silver !== initial.silver) payload.silverUsedGram = num(values.silver)!
      if (!isService && values.plaster !== initial.plaster) payload.plasterUsedGram = num(values.plaster)!
      if (
        isService &&
        current.orders.some((line) => values.servicePrices[line.intakeOrderId] !== initial.servicePrices[line.intakeOrderId])
      ) {
        payload.servicePrices = current.orders.map((line) => ({
          intakeOrderId: line.intakeOrderId,
          serviceUnitPrice: num(values.servicePrices[line.intakeOrderId] ?? '') ?? 0,
        }))
      }
    }
    if (Object.keys(payload).length === 1) {
      form.setError('root', { message: 'Chưa có thay đổi nào để lưu' })
      return
    }
    onSave(payload)
  }

  const busy = saving || detail.isFetching
  const rootError = form.formState.errors.root?.message
  const nothingEditable = current && !canWorker && !canIssue && !canResult
  const leftover = usedGram != null && issuedTotal > 0 ? round4(issuedTotal - usedGram) : null
  const castLoss = usedGram != null && treeGram != null ? round4(usedGram - treeGram) : null

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', fontWeight: 800 }}>SỬA PHIẾU ĐÚC — {slip?.code ?? ''}</DialogTitle>
      <DialogForm form={form} onSubmit={submit}>
        <DialogContent>
          {detail.isError ? <Alert severity="error">Không tải được phiếu — đóng rồi mở lại.</Alert> : null}
          {view ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <SlipStatusChip status={view.status} />
                {detail.isFetching && !current ? <CircularProgress size={16} /> : null}
              </Stack>
              <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1.5, columnGap: 2.5, alignItems: 'center' }}>
                <Typography variant="body2">
                  <strong>Ngày:</strong> {view.slipDate}
                </Typography>
                {canWorker ? (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 260 }}>
                      <FormAutocomplete<Values, CastCastWorkerOption>
                        name="assignedUserId"
                        valueKey="id"
                        label="Giao cho thợ"
                        rules={{ required: 'Chọn thợ đúc được giao phiếu' }}
                        options={workers.data ?? []}
                        getOptionLabel={(option) => option.fullName}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        loading={workers.isLoading}
                        disabled={busy}
                      />
                    </Box>
                  </Stack>
                ) : (
                  <Typography variant="body2">
                    <strong>{view.isServiceCast ? 'Hình thức:' : 'Giao cho thợ:'}</strong>{' '}
                    {view.isServiceCast ? 'Đúc dịch vụ' : (view.startedByName ?? '—')}
                  </Typography>
                )}
                {view.createdByName ? (
                  <Typography variant="body2">
                    <strong>Thủ kho lập:</strong> {view.createdByName}
                  </Typography>
                ) : null}
              </Stack>

              <Table size="small" sx={{ '& td, & th': { px: 1 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Đơn trong lô</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Mã SP</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Sản phẩm</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      SL
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      TL sáp (g)
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.orders.map((line) => (
                    <TableRow key={line.intakeOrderId}>
                      <TableCell sx={{ fontWeight: 700 }}>{line.code}</TableCell>
                      <TableCell>{line.trackingCode ?? '—'}</TableCell>
                      <TableCell>{line.productName || '—'}</TableCell>
                      <TableCell align="right">{line.qty}</TableCell>
                      <TableCell align="right">{formatGram(line.waxWeightGram)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={4} align="right" sx={{ fontWeight: 700 }}>
                      Trọng lượng sáp (cây thông) giao
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatGram(view.waxWeightGram)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {canIssue ? (
                <>
                  <CastingSlipMetalFormTable<Values>
                    issueNames={{ s999: 'grams.s999', hoi: 'grams.hoi', s925: 'grams.s925', gold: 'grams.gold' }}
                    estimate={{
                      s999: Number(view.estimateS999Gram ?? 0),
                      masterAlloy: Number(view.estimateMasterAlloyGram ?? 0),
                      s925: Number(view.estimateS925Gram ?? 0),
                      total: Number(view.estimateTotalGram ?? 0),
                    }}
                    goldEstimate={Number(view.estimateGoldGram ?? 0)}
                    issueTotal={issuedTotal}
                    disabled={busy}
                  />
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      Xuất từ kho NVL chính
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Đổi thực xuất thì phiếu xuất cũ được hoàn kho rồi trừ lại theo số mới. Để 0 nếu không cấp loại đó.
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1.5,
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                      }}
                    >
                      {METALS.map((m) => (
                        <FormSelect<Values>
                          key={m.key}
                          name={`materials.${m.key}`}
                          label={`Mã NVL ${m.label}`}
                          options={materialOptions}
                          placeholder="Chọn mã NVL"
                          disabled={busy || (num(grams?.[m.key] ?? '') ?? 0) <= 0}
                          rules={{
                            validate: (value, all) =>
                              (num(all.grams[m.key]) ?? 0) > 0 && !value ? `Chọn mã NVL xuất cho ${m.label}` : true,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </>
              ) : (
                <CastingSlipMetalTable
                  estimateS999Gram={view.estimateS999Gram}
                  estimateMasterAlloyGram={view.estimateMasterAlloyGram}
                  estimateS925Gram={view.estimateS925Gram}
                  estimateGoldGram={view.estimateGoldGram}
                  estimateTotalGram={view.estimateTotalGram}
                  issueS999Gram={view.issueS999Gram}
                  issueMasterAlloyGram={view.issueMasterAlloyGram}
                  issueS925Gram={view.issueS925Gram}
                  issueGoldGram={view.issueGoldGram}
                  issueTotalGram={view.issueTotalGram}
                  returnTotalGram={view.returnTotalGram}
                />
              )}

              {view.startedAt ? (
                <Typography variant="body2">
                  <strong>Bắt đầu đúc:</strong> {formatDateTime(view.startedAt)}
                  {view.startedByName ? ` · ${view.startedByName}` : ''}
                </Typography>
              ) : null}

              {adminDone ? (
                <Alert severity="warning">
                  Phiếu đã Đúc xong — chỉ admin sửa được. Số vật tư và kết quả lưu lại sẽ đổi tồn kho NVL chính, Kho
                  BTP và báo cáo hao hụt đúc.
                  {isCut ? ' Cây đã cắt: TL cây thông không được nhỏ hơn tổng phôi + phần còn lại.' : ''}
                </Alert>
              ) : null}

              {canResult ? (
                <Stack spacing={1.5}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Kết quả sau đúc{view.submittedByName ? ` (${view.submittedByName})` : ''}
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 1.5,
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                    }}
                  >
                    <FormQtyField<Values>
                      name="tree"
                      label="TL cây thông (trả) (g)"
                      required
                      rules={{
                        validate: (value, all) => {
                          const t = num(String(value ?? ''))
                          if (t == null || t <= 0) return 'Nhập trọng lượng cây thông sau đúc (g)'
                          const used = num(all.silver)
                          if (used != null && round4(t) > round4(used)) {
                            return `Nặng hơn bạc đã dùng ${formatQty(String(round4(t - used)))} g`
                          }
                          return true
                        },
                      }}
                      size="small"
                      fullWidth
                      disabled={busy}
                    />
                    <FormQtyField<Values>
                      name="silver"
                      label="Bạc đã dùng (g)"
                      required
                      rules={{
                        validate: (value) => {
                          const used = num(String(value ?? ''))
                          if (used == null || used < 0) return 'Nhập trọng lượng bạc đã dùng (g)'
                          if (issuedTotal > 0 && round4(used) > issuedTotal) {
                            return `Vượt tổng vật tư giao (${formatQty(String(issuedTotal))} g)`
                          }
                          return true
                        },
                      }}
                      size="small"
                      fullWidth
                      disabled={busy}
                    />
                    {isService ? null : (
                      <FormQtyField<Values>
                        name="plaster"
                        label="Thạch cao đã dùng (g)"
                        required
                        rules={{
                          validate: (value) => (num(String(value ?? '')) == null ? 'Nhập thạch cao đã dùng (g)' : true),
                        }}
                        size="small"
                        fullWidth
                        disabled={busy}
                      />
                    )}
                  </Box>
                  {isService ? (
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1.5,
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                      }}
                    >
                      {view.orders.map((line) => (
                        <FormMoneyField<Values>
                          key={line.intakeOrderId}
                          name={`servicePrices.${line.intakeOrderId}`}
                          label={`Đơn giá dịch vụ — ${line.code} (đ)`}
                          required
                          rules={{
                            validate: (value) => (num(String(value ?? '')) == null ? 'Nhập đơn giá dịch vụ' : true),
                          }}
                          size="small"
                          fullWidth
                          disabled={busy}
                        />
                      ))}
                    </Box>
                  ) : null}
                  <Typography variant="body2" color="text.secondary">
                    Bạc giao chưa dùng (trả kho):{' '}
                    <strong>{leftover != null ? `${formatQty(String(leftover))} g` : '—'}</strong> · Hao hụt đúc:{' '}
                    <strong>{castLoss != null ? `${formatQty(String(castLoss))} g` : '—'}</strong>. Đổi TL cây thông thì
                    phiếu nhập Kho BTP sau đúc được nhập lại theo số mới.
                  </Typography>
                </Stack>
              ) : null}

              {nothingEditable ? (
                <Alert severity="info">
                  Đúc dịch vụ đang chờ cấp vật tư — chưa có gì để sửa. Huỷ phiếu nếu lên nhầm đơn.
                </Alert>
              ) : null}
              {current && !nothingEditable ? (
                <FormEditReasonBlock<Values> name="editReason" entityType="casting_slip" entityId={current.id} required />
              ) : null}
              {rootError ? <Alert severity="error">{rootError}</Alert> : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !current || Boolean(nothingEditable)}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
