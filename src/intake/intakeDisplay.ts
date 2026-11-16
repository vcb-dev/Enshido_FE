import { formatQty } from '../api/inventory'

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
