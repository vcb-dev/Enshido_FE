/**
 * Chia đều `total` sản phẩm cho `parts` phiếu; phần dư dồn cho các phiếu đầu (1000 / 3 → 334,
 * 333, 333) để tổng luôn đúng bằng số lượng đơn.
 */
export function evenSplit(total: number, parts: number): number[] {
  if (parts <= 0) return []
  const base = Math.floor(total / parts)
  const extra = total - base * parts
  return Array.from({ length: parts }, (_, index) => base + (index < extra ? 1 : 0))
}
