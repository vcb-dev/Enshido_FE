import type { StoneLine } from '../api/productionOrders'

const COUNT_UNITS = new Set(['viên', 'vien'])

/**
 * Xem trước đá thừa của một mã khi KCS cân gói thừa — khớp cách BE tính: viên thừa = viên cấp ×
 * TL thừa / TL cấp; SL xuất = SL cấp × (TL cấp − TL thừa) / TL cấp (mã tính theo viên làm tròn).
 * BE chia theo từng lần cấp nên con số cuối có thể lệch ±1 viên khi một mã được cấp nhiều lần.
 */
export function stoneReturnPreview(line: Pick<StoneLine, 'qty' | 'stoneCount' | 'weight' | 'unit'>, returned: number) {
  const weight = Number(line.weight)
  if (!(weight > 0) || !(returned >= 0)) return null
  const ratio = Math.min(returned / weight, 1)
  const qty = Number(line.qty) * (1 - ratio)
  return {
    /** null = đá tính theo ct / g không đếm viên. */
    returnedCount: line.stoneCount != null ? Math.round(line.stoneCount * ratio) : null,
    usedQty: COUNT_UNITS.has(line.unit.trim().toLowerCase())
      ? Math.round(qty)
      : Math.round(qty * 10_000) / 10_000,
  }
}
