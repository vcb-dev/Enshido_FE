import type { CastingSlip } from '../api/castingSlips'
import type { ProductionStatus } from '../api/productionOrders'
import { STATUS_META } from '../orders/catalog'

export function hasCastingSlipCutData(slip: CastingSlip) {
  return slip.restWeightGram != null || slip.orders.some(
    (line) => line.blankQty != null || line.blankWeightGram != null,
  )
}

export function canCutCastingSlip(slip: CastingSlip) {
  return getCastingSlipCutBlockedReason(slip) === null
}

export function getCastingSlipCutBlockedReason(slip: CastingSlip): string | null {
  if (slip.status !== 'DONE') return 'Phiếu chưa Đúc xong.'
  if (hasCastingSlipCutData(slip)) return 'Phiếu đã cắt cây, không thể cắt lại.'
  if (!(Number(slip.castTreeWeightGram) > 0)) return 'Chưa có trọng lượng cây thông sau đúc.'
  if (!slip.orders.length) return 'Phiếu chưa có đơn để cắt cây.'
  const blocked = slip.orders.filter((line) => line.status !== 'CAST_DONE' || line.productionOrderCode)
  if (blocked.length) {
    return `Đơn ${blocked.map((line) => line.code).join(', ')} đã chuyển bước hoặc đã có lệnh sản xuất; không thể cắt cây.`
  }
  return null
}

function asProductionStatus(value: string | null | undefined): ProductionStatus | null {
  if (!value) return null
  if (value === 'WAIT_COOLING') return 'WAIT_FILING'
  return value in STATUS_META ? (value as ProductionStatus) : null
}

/** Trạng thái lộ trình các đơn trên phiếu — sau cắt cây hiện từ Chờ nguội trở đi. */
export function slipJourneyStatuses(slip: CastingSlip): ProductionStatus[] {
  const seen = new Set<ProductionStatus>()
  const statuses: ProductionStatus[] = []
  for (const line of slip.orders) {
    const status = asProductionStatus(line.orderStatus ?? line.status)
    if (!status || seen.has(status)) continue
    seen.add(status)
    statuses.push(status)
  }
  return statuses
}
