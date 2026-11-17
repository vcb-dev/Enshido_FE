import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { listPlasterMaterialOptionsApi, type CastingSlip } from '../api/castingSlips'
import { formatMoney, formatQty } from '../api/inventory'
import { formatDateTime } from '../orders/catalog'
import { IntakeImageThumbs } from './IntakeImageThumbs'

function gram(value: string | null | undefined) {
  if (value == null || value === '') return '—'
  return `${formatQty(value)} g`
}

export function serviceCastPriceLines(slip: Pick<CastingSlip, 'orders' | 'serviceUnitPrice'>) {
  const priced = slip.orders.filter((row) => row.serviceUnitPrice != null && row.serviceUnitPrice !== '')
  if (priced.length > 0) {
    return priced.map((row) => `${row.code}: ${formatMoney(row.serviceUnitPrice!)} đ`)
  }
  if (slip.serviceUnitPrice != null && slip.serviceUnitPrice !== '') {
    return [`${formatMoney(slip.serviceUnitPrice)} đ`]
  }
  return [] as string[]
}

function ServiceCastPriceSummary({ slip }: { slip: Pick<CastingSlip, 'orders' | 'serviceUnitPrice'> }) {
  const lines = serviceCastPriceLines(slip)
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2">Đơn giá dịch vụ:</Typography>
      {lines.length ? (
        lines.map((line) => (
          <Typography key={line} variant="body2">
            <strong>{line}</strong>
          </Typography>
        ))
      ) : (
        <Typography variant="body2">
          <strong>—</strong>
        </Typography>
      )}
    </Stack>
  )
}

/**
 * Thủ kho xem lại đúng số liệu thợ đúc vừa nhập — không nhập lại, không cắt cây thông. Có thạch cao
 * thì chọn mã kho NVL tiêu hao để hệ thống xuất phần đã dùng; thiếu tồn thì không xác nhận được.
 */
export function CastingSlipConfirmDialog({
  slip,
  saving,
  onClose,
  onConfirm,
}: {
  slip: CastingSlip | null
  saving: boolean
  onClose: () => void
  onConfirm: (payload: { plasterMaterialId?: string }) => void
}) {
  const plasterGram = slip && !slip.isServiceCast ? Number(slip.plasterUsedGram ?? 0) : 0
  const needsPlaster = plasterGram > 0
  const plasterOptions = useQuery({
    queryKey: ['casting-plaster-material-options'],
    queryFn: listPlasterMaterialOptionsApi,
    enabled: Boolean(slip) && needsPlaster,
    staleTime: 10_000,
  })
  const [plasterId, setPlasterId] = useState('')
  useEffect(() => {
    if (!slip) setPlasterId('')
  }, [slip])
  useEffect(() => {
    if (!plasterId && plasterOptions.data?.defaultId) setPlasterId(plasterOptions.data.defaultId)
  }, [plasterId, plasterOptions.data?.defaultId])
  const plaster = plasterOptions.data?.items.find((item) => item.id === plasterId) ?? null
  const plasterQty = plaster ? plasterGram / plaster.gramsPerUnit : null
  const plasterAvailable = plaster ? Number(plaster.availableQty ?? plaster.onHandQty ?? 0) : null
  const plasterShort =
    plaster != null && plasterQty != null && plasterAvailable != null && plasterAvailable + 1e-9 < plasterQty
  const blocked = needsPlaster && (!plaster || plasterShort)

  const resultThumbs = (slip?.resultImages ?? []).map((image, index) => ({
    kind: 'CASTING_TREE' as const,
    url: image.url,
    publicId: image.publicId,
    width: image.width,
    height: image.height,
    sortOrder: index,
  }))

  return (
    <Dialog open={Boolean(slip)} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Xác nhận — {slip?.code ?? ''}</DialogTitle>
      <DialogContent>
        {slip ? (
          <Stack spacing={1.25} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Số liệu thợ đúc{slip.submittedByName ? ` (${slip.submittedByName})` : ''} vừa nhập
              {slip.submittedAt ? ` · ${formatDateTime(slip.submittedAt)}` : ''}. Kiểm tra rồi xác nhận
              để chuyển phiếu sang Đúc xong.
            </Typography>
            <Typography variant="body2">
              Tổng vật tư giao: <strong>{gram(slip.issueTotalGram)}</strong>
            </Typography>
            <Typography variant="body2">
              TL cây thông sau đúc — Trả: <strong>{gram(slip.castTreeWeightGram)}</strong>
            </Typography>
            <Typography variant="body2">
              Bạc đã dùng: <strong>{gram(slip.silverUsedGram)}</strong>
            </Typography>
            {slip.isServiceCast ? (
              <ServiceCastPriceSummary slip={slip} />
            ) : (
              <Typography variant="body2">
                Thạch cao đã dùng: <strong>{gram(slip.plasterUsedGram)}</strong>
              </Typography>
            )}
            {needsPlaster ? (
              <Stack spacing={0.75}>
                <TextField
                  select
                  size="small"
                  label="Mã thạch cao xuất kho (kho NVL tiêu hao)"
                  value={plaster ? plasterId : ''}
                  onChange={(event) => setPlasterId(event.target.value)}
                  disabled={saving || plasterOptions.isLoading}
                  helperText={
                    plasterOptions.isLoading
                      ? 'Đang tải mã thạch cao…'
                      : plaster && plasterQty != null
                        ? `Xuất ${formatQty(String(plasterQty))} ${plaster.unit} · còn ${formatQty(String(plasterAvailable ?? 0))} ${plaster.unit}`
                        : 'Chọn mã để hệ thống xuất thạch cao đã dùng'
                  }
                >
                  {(plasterOptions.data?.items ?? []).map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {[item.sku, item.name].filter(Boolean).join(' — ')} · còn{' '}
                      {formatQty(item.availableQty ?? item.onHandQty ?? '0')} {item.unit}
                    </MenuItem>
                  ))}
                </TextField>
                {plasterOptions.data && plasterOptions.data.items.length === 0 ? (
                  <Alert severity="error" sx={{ py: 0.25 }}>
                    Kho NVL tiêu hao chưa có mã thạch cao (đơn vị gram / kg) — tạo mã trước khi xác nhận.
                  </Alert>
                ) : null}
                {plasterShort && plaster ? (
                  <Alert severity="error" sx={{ py: 0.25 }}>
                    Không đủ thạch cao: cần {formatQty(String(plasterQty))} {plaster.unit}, kho chỉ còn{' '}
                    {formatQty(String(plasterAvailable ?? 0))} {plaster.unit}. Nhập thêm thạch cao vào kho NVL
                    tiêu hao rồi xác nhận.
                  </Alert>
                ) : null}
              </Stack>
            ) : null}
            {slip.leftoverGram != null ? (
              <Typography variant="body2">
                Bạc giao chưa dùng (trả kho): <strong>{gram(slip.leftoverGram)}</strong>
              </Typography>
            ) : null}
            {slip.castLossGram != null ? (
              <Typography
                variant="body2"
                sx={{ fontWeight: 700 }}
                color={Number(slip.castLossGram) < 0 ? 'error' : undefined}
              >
                Hao hụt đúc: {gram(slip.castLossGram)}
                {slip.castLossPercent != null ? ` (${slip.castLossPercent}%)` : ''}
              </Typography>
            ) : null}
            {resultThumbs.length ? <IntakeImageThumbs label="Ảnh cân cây thông sau đúc" images={resultThumbs} /> : null}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button
          variant="contained"
          disabled={saving || !slip || blocked}
          onClick={() => onConfirm(needsPlaster && plaster ? { plasterMaterialId: plaster.id } : {})}
        >
          {saving ? 'Đang xác nhận…' : 'Xác nhận'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
