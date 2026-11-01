import { useEffect, useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
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

/** Phiếu đúc sửa được cho tới khi thủ kho xác nhận Đúc xong. */
export function canEditCastingSlip(slip: Pick<CastingSlip, 'status'>) {
  return slip.status !== 'DONE' && slip.status !== 'CAST_FAILED'
}

/**
 * Sửa phiếu đúc chưa đúc xong. Thợ đúc: trước khi thợ nhận phiếu. Vật tư cấp: sau khi cấp (hoàn kho
 * rồi trừ lại). Kết quả: khi chờ thủ kho xác nhận (đổi TL cây thì nhập lại Kho BTP).
 */
export function CastingSlipEditDialog({
  slip,
  saving,
  onClose,
  onSave,
}: {
  slip: CastingSlip | null
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
  const status = current?.status
  const isService = Boolean(current?.isServiceCast)
  const canWorker = !isService && (status === 'PENDING_ISSUE' || status === 'WAIT_CASTING')
  const canIssue = status === 'WAIT_CASTING' || status === 'CASTING' || status === 'PENDING_CONFIRMATION'
  const canResult = status === 'PENDING_CONFIRMATION'

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

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Sửa phiếu đúc — {slip?.code ?? ''}</DialogTitle>
      <DialogForm form={form} onSubmit={submit}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {detail.isError ? <Alert severity="error">Không tải được phiếu — đóng rồi mở lại.</Alert> : null}
            {current ? (
              <Typography variant="body2" color="text.secondary">
                Đơn trong lô: {current.batchOrderCodes} · Sáp {formatQty(current.waxWeightGram)} g
              </Typography>
            ) : null}
            {nothingEditable ? (
              <Alert severity="info">
                Đúc dịch vụ đang chờ cấp vật tư — chưa có gì để sửa. Huỷ phiếu nếu lên nhầm đơn.
              </Alert>
            ) : null}

            {canWorker ? (
              <FormAutocomplete<Values, CastCastWorkerOption>
                name="assignedUserId"
                valueKey="id"
                label="Giao cho thợ"
                required
                rules={{ required: 'Chọn thợ đúc được giao phiếu' }}
                options={workers.data ?? []}
                getOptionLabel={(option) => option.fullName}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                loading={workers.isLoading}
                disabled={busy}
              />
            ) : null}

            {canIssue ? (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Vật tư cấp (g)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Lưu là hoàn phiếu xuất cũ rồi trừ kho NVL chính theo số mới. Để 0 nếu không cấp loại đó.
                </Typography>
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                  {METALS.map((m) => (
                    <Stack key={m.key} spacing={1}>
                      <FormQtyField<Values>
                        name={`grams.${m.key}`}
                        label={`${m.label} (g)`}
                        size="small"
                        fullWidth
                        disabled={busy}
                      />
                      <FormSelect<Values>
                        name={`materials.${m.key}`}
                        label={`Mã NVL ${m.label}`}
                        options={materialOptions}
                        placeholder="Chọn mã NVL"
                        disabled={busy}
                        rules={{
                          validate: (value, all) =>
                            (num(all.grams[m.key]) ?? 0) > 0 && !value ? `Chọn mã NVL xuất cho ${m.label}` : true,
                        }}
                      />
                    </Stack>
                  ))}
                </Box>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Tổng vật tư giao: <strong>{formatQty(String(issuedTotal))} g</strong>
                </Typography>
              </Box>
            ) : null}

            {canResult ? (
              <Stack spacing={2}>
                <Typography variant="subtitle2">Kết quả đúc</Typography>
                <FormQtyField<Values>
                  name="tree"
                  label="TL cây thông sau đúc — Trả (g)"
                  required
                  rules={{
                    validate: (value, all) => {
                      const treeGram = num(String(value ?? ''))
                      if (treeGram == null || treeGram <= 0) return 'Nhập trọng lượng cây thông sau đúc (g)'
                      const used = num(all.silver)
                      if (used != null && round4(treeGram) > round4(used)) {
                        const over = round4(treeGram - used)
                        return `TL cây thông sau đúc nặng hơn bạc đã dùng ${formatQty(String(over))} g (cây ${formatQty(String(treeGram))} g, bạc đã dùng ${formatQty(String(used))} g)`
                      }
                      return true
                    },
                  }}
                  helperText="Đổi số này thì phiếu nhập Kho BTP sau đúc được nhập lại theo số mới."
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
                        return `Bạc đã dùng vượt tổng vật tư giao (${formatQty(String(issuedTotal))} g)`
                      }
                      return true
                    },
                  }}
                  size="small"
                  fullWidth
                  disabled={busy}
                />
                {isService ? (
                  current?.orders.map((line) => (
                    <FormMoneyField<Values>
                      key={line.intakeOrderId}
                      name={`servicePrices.${line.intakeOrderId}`}
                      label={`Đơn giá dịch vụ — ${line.code} (đ)`}
                      required
                      rules={{ validate: (value) => (num(String(value ?? '')) == null ? 'Nhập đơn giá dịch vụ' : true) }}
                      size="small"
                      fullWidth
                      disabled={busy}
                    />
                  ))
                ) : (
                  <FormQtyField<Values>
                    name="plaster"
                    label="Thạch cao đã dùng (g)"
                    required
                    rules={{ validate: (value) => (num(String(value ?? '')) == null ? 'Nhập thạch cao đã dùng (g)' : true) }}
                    size="small"
                    fullWidth
                    disabled={busy}
                  />
                )}
              </Stack>
            ) : null}

            {current && !nothingEditable ? (
              <FormEditReasonBlock<Values> name="editReason" entityType="casting_slip" entityId={current.id} required />
            ) : null}
            {rootError ? <Alert severity="error">{rootError}</Alert> : null}
          </Stack>
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
