import { ctToGram, formatCt, formatQty } from '../api/inventory'

/**
 * Cách nhập đá theo đơn vị của mã trong kho — một quy tắc cho mọi nơi cấp / xuất / xin đá:
 * - 'weight' (ct, g): chỉ nhập trọng lượng (ct); số lượng suy từ trọng lượng;
 * - 'count' (viên): nhập cả số lượng (viên) lẫn trọng lượng (ct).
 */
export type StoneUnitKind = 'weight' | 'count'

const COUNT_UNITS = new Set(['viên', 'vien'])
const WEIGHT_UNITS = new Set(['ct', 'g', 'gr', 'gram', 'gam'])

export function stoneUnitKind(unit: string | null | undefined): StoneUnitKind | null {
  const key = (unit ?? '').trim().toLowerCase()
  if (COUNT_UNITS.has(key)) return 'count'
  if (WEIGHT_UNITS.has(key)) return 'weight'
  return null
}

/** Số lượng theo đơn vị của mã ct / g suy từ TL ô nhập (ct): mã ct bằng chính TL, mã gram đổi ra g. */
export function stoneQtyFromCt(unit: string | null | undefined, ct: string) {
  if ((unit ?? '').trim().toLowerCase() === 'ct') return ct
  return ctToGram(ct)
}

/** Số thợ xin / kho xuất để hiện: đá ct / g là trọng lượng, đá viên là số viên kèm trọng lượng. */
export function stoneAmountText(input: {
  qty: string
  weight: string | null | undefined
  unit: string
}) {
  const kind = stoneUnitKind(input.unit)
  if (kind === 'weight' && input.weight) return formatCt(input.weight)
  if (kind === 'count' && input.weight) return `${formatQty(input.qty)} ${input.unit} · ${formatCt(input.weight)}`
  return `${formatQty(input.qty)} ${input.unit}`
}
