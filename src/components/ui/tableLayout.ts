/** Bố cục cột cố định: chỗ tối thiểu cho cột không khai `width`. */
const AUTO_COLUMN_MIN_WIDTH = 140

/**
 * Bố cục cột cố định mà bảng hẹp hơn tổng `width` các cột thì trình duyệt bóp cột không khai
 * `width` về 0 và chữ tràn đè sang cột bên cạnh. Giữ bảng không hẹp hơn tổng đó — thiếu chỗ thì
 * cuộn ngang.
 */
export function fixedLayoutMinWidth(
  columns: readonly { width?: number | string }[],
  leadWidth: number,
  minWidth: number | string | undefined,
): number | string {
  const total = columns.reduce(
    (sum, column) => sum + (typeof column.width === 'number' ? column.width : AUTO_COLUMN_MIN_WIDTH),
    leadWidth,
  )
  if (minWidth == null) return total
  if (typeof minWidth === 'number') return Math.max(minWidth, total)
  return `max(${minWidth}, ${total}px)`
}
