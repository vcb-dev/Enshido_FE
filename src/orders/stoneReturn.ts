import type { StoneLine } from '../api/productionOrders'

const COUNT_UNITS = new Set(['viên', 'vien'])

/**
 * Xem trước đá thừa của một mã khi QC cân gói thừa — khớp cách BE tính: viên thừa = viên cấp ×
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

/** Nguồn của TL đá gắn — hiện kèm số để QC biết hệ thống lấy từ đâu. */
export type StoneSetSource = '3d' | 'pack' | 'count' | 'handed'

export const STONE_SET_SOURCE_LABEL: Record<StoneSetSource, string> = {
  '3d': 'theo TL đá 3D',
  pack: 'TL đá cấp − gói thừa',
  count: 'chia theo số viên gắn',
  handed: 'TL đá đã cấp',
}

/**
 * TL đá gắn lên BTP ở khâu Vào đá (g) — khớp thứ tự BE dùng khi QC nhận lại:
 * 1. Đơn có TL đá 3D: chia theo số hàng giao (mô tả luồng bước 18);
 * 2. Mọi gói cấp đều cân: TL đá đã cấp − TL gói thừa QC cân;
 * 3. Dòng cấp cũ đếm viên: chia TL đã cấp theo số viên gắn / số viên đã cấp;
 * 4. Còn lại: nguyên TL đá đã cấp.
 * Trả null khi không có số nào để tính.
 */
export function stoneSetWeight(input: {
  /** TL đá trên 3D của cả đơn (g). */
  stone3dGram: number | null
  orderQty: number
  handedQty: number
  /** TL đá đã cấp cho khâu (g), đã trừ túi thợ trả giữa khâu; null = chưa cấp đá cân gói. */
  handedGram: number | null
  /** Mọi dòng cấp đều có TL gói. */
  allWeighed: boolean
  /** Tổng TL gói đá thừa QC cân (g). */
  returnedPackGram: number
  /** Số viên đã cấp (đã trừ trả giữa khâu); null = không đếm viên. */
  stonesHanded: number | null
  /** Số viên thợ trả lại (dòng cấp cũ đếm viên). */
  returnedCount: number
}): { gram: number; source: StoneSetSource } | null {
  const round = (value: number) => Math.round(value * 10_000) / 10_000
  if (input.stone3dGram != null && input.orderQty > 0) {
    return { gram: round((input.stone3dGram * input.handedQty) / input.orderQty), source: '3d' }
  }
  if (input.handedGram == null) return null
  if (input.allWeighed) {
    return { gram: round(Math.max(input.handedGram - input.returnedPackGram, 0)), source: 'pack' }
  }
  if (input.stonesHanded != null && input.stonesHanded > 0) {
    const set = Math.max(0, input.stonesHanded - input.returnedCount)
    return { gram: round((input.handedGram * set) / input.stonesHanded), source: 'count' }
  }
  return { gram: round(input.handedGram), source: 'handed' }
}
