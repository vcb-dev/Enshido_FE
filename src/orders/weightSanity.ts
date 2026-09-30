import { formatQty } from '../api/inventory'

/**
 * Kiểm tra chéo các số gram trong cùng một form — không dùng mốc tối đa cố định. Nhầm dấu
 * chấm / phẩy làm một số lệch đúng 1.000 lần so với số liên quan, nên so tỉ lệ giữa hai số
 * là bắt được mà không cần biết một lần đúc thường nặng bao nhiêu.
 */
export function ratioWarning(
  value: number,
  valueLabel: string,
  base: number,
  baseLabel: string,
  range: { min: number; max: number; note?: string },
): string | null {
  if (!(value > 0) || !(base > 0)) return null
  const ratio = value / base
  if (ratio >= range.min && ratio <= range.max) return null
  const times = ratio >= 1 ? `gấp ${formatQty(String(Math.round(ratio * 10) / 10))} lần` : `chỉ bằng ${formatQty(String(Math.round(ratio * 10000) / 100))}%`
  return `${valueLabel} ${formatQty(String(value))} g ${times} ${baseLabel} ${formatQty(String(base))} g${range.note ? ` (${range.note})` : ''}`
}

/** Có số bất thường thì hỏi lại trước khi lưu; không có thì cho qua. */
export function confirmWeights(warnings: Array<string | null>): boolean {
  const list = warnings.filter((item): item is string => Boolean(item))
  if (!list.length) return true
  return window.confirm(
    `Kiểm tra lại số liệu — có thể nhầm dấu chấm / phẩy (dấu phẩy là thập phân: 12,5 g):\n\n• ${list.join('\n• ')}\n\nVẫn lưu?`,
  )
}
