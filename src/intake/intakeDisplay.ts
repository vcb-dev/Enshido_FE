import { formatCt, formatQty } from '../api/inventory'

/**
 * Phần cây còn lại sau cắt cây: tổng, kèm tách S925 / bạc thu hồi khi có, vd
 * "1.000 g (S925 600 g · bạc thu hồi 400 g)". null = chưa cắt cây.
 */
export function formatCutRest(rest: {
  restWeightGram?: string | null
  restS925Gram?: string | null
  restRecoveredGram?: string | null
}): string | null {
  const total = formatIntakeGram(rest.restWeightGram)
  if (!total) return null
  const parts = [
    Number(rest.restS925Gram) > 0 ? `S925 ${formatIntakeGram(rest.restS925Gram)}` : null,
    Number(rest.restRecoveredGram) > 0 ? `bạc thu hồi ${formatIntakeGram(rest.restRecoveredGram)}` : null,
  ].filter(Boolean)
  return parts.length ? `${total} (${parts.join(' · ')})` : total
}

export function formatIntakeGram(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return `${formatQty(String(n))} g`
}

/**
 * Đá theo file 3D: "2 viên · 0,82 ct / sp — cả đơn 8 viên · 3,28 ct". Form 3D nhập theo 1 sp,
 * DB lưu tổng cả đơn. null = chưa khai; "Không có đá" khi đơn ghi rõ 0 viên / 0 ct.
 */
export function formatStone3d(order: {
  qty?: number | null
  stoneCount3d?: number | null
  stoneWeight3dGram?: string | null
  stoneCount3dPerPiece?: number | null
  stoneWeight3dPerPieceGram?: string | null
}): string | null {
  const weight = order.stoneWeight3dGram
  if (order.stoneCount3d === 0 || (weight != null && weight !== '' && Number(weight) === 0)) {
    return 'Không có đá'
  }
  const qty = order.qty && order.qty > 0 ? order.qty : 1
  const hasWeight = weight != null && weight !== ''
  const perGram = order.stoneWeight3dPerPieceGram ?? (hasWeight ? String(Number(weight) / qty) : null)
  const perCount = order.stoneCount3dPerPiece ?? (order.stoneCount3d != null ? order.stoneCount3d / qty : null)
  const part = (count: number | null | undefined, gram: string | null | undefined) =>
    [
      count != null ? `${formatQty(String(Math.round(count * 100) / 100))} viên` : null,
      gram != null && gram !== '' ? formatCt(gram) : null,
    ]
      .filter(Boolean)
      .join(' · ')
  const per = part(perCount, perGram)
  if (!per) return null
  if (qty <= 1) return `${per} / sp`
  return `${per} / sp — cả đơn ${part(order.stoneCount3d, weight)}`
}
