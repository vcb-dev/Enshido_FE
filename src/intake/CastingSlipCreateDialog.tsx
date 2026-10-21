import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
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
import { useController, useWatch } from 'react-hook-form'
import { useAppForm } from '../components/ui/form/useAppForm'
import {
  listCastingSlipCandidatesApi,
  listCastWorkersApi,
  type CastCastWorkerOption,
  type CastingSlipCandidate,
  type CreateCastingSlipPayload,
} from '../api/castingSlips'
import { DialogForm, FormAutocomplete, FormCheckbox, SearchInput } from '../components/ui'
import { CastingSlipMetalTable } from './CastingSlipMetalTable'
import { silverEstimateFromWax } from './castingEstimate'
import { formatQty } from '../api/inventory'
import { useIsMobile } from '../hooks/useBreakpoint'
import { formatDateShort } from '../orders/catalog'

type Values = {
  picked: CastingSlipCandidate[]
  assignedUserId: string | null
  isServiceCast: boolean
}

function emptyValues(): Values {
  return {
    picked: [],
    assignedUserId: null,
    isServiceCast: false,
  }
}

/**
 * Bước 7: thủ kho lọc các đơn đã có sáp (E), gom vào một lần đúc, nhập bạc + hội cấp theo
 * định mức. Lưu xong phiếu ở Chờ cấp vật tư; cấp xong các đơn sang Chờ đúc (F).
 */
export function CastingSlipCreateDialog({
  open,
  preselectId,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  /** Mở từ nút "Lên lệnh đúc" trên một dòng đơn — tích sẵn đơn đó. */
  preselectId?: string | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CreateCastingSlipPayload) => void
}) {
  const fullScreen = useIsMobile()
  // Ô lọc danh sách đơn — không phải dữ liệu của phiếu nên không nằm trong form.
  const [search, setSearch] = useState('')
  const form = useAppForm<Values>({ defaultValues: emptyValues() })
  const pickedField = useController({
    control: form.control,
    name: 'picked',
    rules: { validate: (value) => (value.length ? true : 'Chọn ít nhất một đơn đi đúc') },
  })

  const castWorkers = useQuery({
    queryKey: ['cast-workers'],
    queryFn: listCastWorkersApi,
    enabled: open,
    staleTime: 60_000,
  })

  const candidates = useQuery({
    queryKey: ['casting-slip-candidates', search],
    queryFn: () => listCastingSlipCandidatesApi(search),
    enabled: open,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!open) return
    setSearch('')
    form.reset(emptyValues())
  }, [open, form])

  // Tích sẵn đơn được mở từ dòng Lệnh sản xuất khi danh sách tải về.
  useEffect(() => {
    if (!open || !preselectId || !candidates.data) return
    const row = candidates.data.find((item) => item.id === preselectId)
    if (!row) return
    const current = form.getValues('picked')
    if (!current.some((item) => item.id === row.id)) form.setValue('picked', [...current, row])
  }, [open, preselectId, candidates.data, form])

  const rows = candidates.data ?? []
  const [picked, assignedUserId, isServiceCast] = useWatch({
    control: form.control,
    name: ['picked', 'assignedUserId', 'isServiceCast'],
  })
  useEffect(() => {
    if (isServiceCast && assignedUserId) form.setValue('assignedUserId', null)
  }, [isServiceCast, assignedUserId, form])
  const selected = useMemo(() => new Set(picked.map((row) => row.id)), [picked])
  const waxTotal = useMemo(
    () => picked.reduce((sum, row) => sum + Number(row.waxWeightGram ?? 0), 0),
    [picked],
  )
  const estimate = silverEstimateFromWax(waxTotal)
  const gramText = (value: number) => (value > 0 ? String(value) : null)
  const allVisibleChecked = rows.length > 0 && rows.every((row) => selected.has(row.id))
  const formError = pickedField.fieldState.error?.message ?? form.formState.errors.root?.message

  function setPicked(next: CastingSlipCandidate[]) {
    pickedField.field.onChange(next)
  }

  function toggle(row: CastingSlipCandidate, checked: boolean) {
    const rest = picked.filter((item) => item.id !== row.id)
    setPicked(checked ? [...rest, row] : rest)
  }

  function toggleAll(checked: boolean) {
    const ids = new Set(rows.map((row) => row.id))
    const rest = picked.filter((item) => !ids.has(item.id))
    setPicked(checked ? [...rest, ...rows] : rest)
  }

  function submit(values: Values) {
    const picked = silverEstimateFromWax(
      values.picked.reduce((sum, row) => sum + Number(row.waxWeightGram ?? 0), 0),
    )
    onSave({
      intakeOrderIds: values.picked.map((row) => row.id),
      isServiceCast: values.isServiceCast,
      assignedUserId: values.isServiceCast ? undefined : values.assignedUserId!,
      estimateS999Gram: picked.s999 || undefined,
      estimateMasterAlloyGram: picked.masterAlloy || undefined,
      estimateS925Gram: picked.s925 || undefined,
    })
  }

  const busy = saving
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="lg">
      <DialogTitle>Lên phiếu đúc</DialogTitle>
      <DialogForm form={form} onSubmit={submit}>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Lọc đơn chờ đúc</Typography>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Mã đơn, mã SX, mã SP, tên sản phẩm…"
                sx={{ maxWidth: 420 }}
              />
              <Table size="small" sx={{ '& td, & th': { px: 1 } }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={allVisibleChecked}
                      indeterminate={!allVisibleChecked && rows.some((row) => selected.has(row.id))}
                      onChange={(event) => toggleAll(event.target.checked)}
                      disabled={!rows.length}
                    />
                  </TableCell>
                  <TableCell>Mã đơn</TableCell>
                  <TableCell>Mã SP</TableCell>
                  <TableCell>Sản phẩm</TableCell>
                  <TableCell align="right">SL</TableCell>
                  <TableCell align="right">TL sáp (g)</TableCell>
                  <TableCell>Cần trả</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover onClick={() => toggle(row, !selected.has(row.id))} sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.has(row.id)} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{row.code}</TableCell>
                    <TableCell>{row.trackingCode ?? '—'}</TableCell>
                    <TableCell>{row.productName || '—'}</TableCell>
                    <TableCell align="right">{row.qty}</TableCell>
                    <TableCell align="right">{row.waxWeightGram ? formatQty(row.waxWeightGram) : '—'}</TableCell>
                    <TableCell>{row.dueDate ? formatDateShort(row.dueDate) : '—'}</TableCell>
                  </TableRow>
                ))}
                {!rows.length ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 2 }}>
                      {candidates.isFetching ? 'Đang tải…' : 'Không có đơn nào đã có sáp chờ đúc'}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
              <Typography variant="body2">
                Đã chọn <strong>{picked.length}</strong> đơn · Trọng lượng sáp (cây thông) giao:{' '}
                <strong>{formatQty(String(waxTotal))} g</strong>
              </Typography>
            </Stack>

            <FormCheckbox<Values>
              name="isServiceCast"
              label="Đúc dịch vụ"
              disabled={busy}
              helperText="Gửi ngoài xưởng — không giao thợ đúc trong hệ thống."
            />

            {isServiceCast ? null : (
              <FormAutocomplete<Values, CastCastWorkerOption>
                name="assignedUserId"
                valueKey="id"
                label="Giao cho thợ"
                required
                rules={{ required: isServiceCast ? false : 'Chọn thợ đúc được giao phiếu' }}
                options={castWorkers.data ?? []}
                getOptionLabel={(option) => option.fullName}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                loading={castWorkers.isLoading}
                disabled={busy}
                helperText={
                  castWorkers.isError
                    ? 'Không tải được danh sách thợ đúc'
                    : !castWorkers.isLoading && (castWorkers.data?.length ?? 0) === 0
                      ? 'Chưa có tài khoản thợ đúc — tick quyền Thợ đúc ở Nhân sự.'
                      : 'Chỉ hiện nhân sự vai trò Thợ đúc (Nhân sự).'
                }
                noOptionsText="Không có thợ đúc"
              />
            )}

            <CastingSlipMetalTable
              estimateS999Gram={gramText(estimate.s999)}
              estimateMasterAlloyGram={gramText(estimate.masterAlloy)}
              estimateS925Gram={gramText(estimate.s925)}
              estimateTotalGram={gramText(estimate.total)}
            />
            <Typography variant="caption" color="text.secondary">
              Lưu và in phiếu trước. Thủ kho nhập trọng lượng thực xuất lúc cấp vật tư — để trống thì lấy số
              ước tính.
            </Typography>

            {formError ? <Alert severity="error">{formError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={busy || (!isServiceCast && !assignedUserId)}>
            {saving ? 'Đang lưu…' : `Lưu và in phiếu (${picked.length} đơn)`}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  )
}
