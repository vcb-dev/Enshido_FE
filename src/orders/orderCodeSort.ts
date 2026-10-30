import type { SortDir } from '../hooks/useTableParams'

/** Số của mã đơn hàng DH…; đơn lên thẳng (chưa có DH) trả null. */
export function intakeCodeNumber(code: string | null | undefined): number | null {
  const match = /^DH(\d+)$/i.exec(code?.trim() ?? '')
  return match ? Number(match[1]) : null
}

/** Cùng thứ tự với BE `orderCodeOrderBy`: số DH theo chiều sắp, đơn không có DH luôn xếp cuối. */
function comesBefore(a: number | null, b: number | null, dir: SortDir) {
  if (a == null) return false
  if (b == null) return true
  return dir === 'asc' ? a < b : a > b
}

export function sortByOrderCode<T>(items: T[], key: (item: T) => number | null, dir: SortDir) {
  return [...items].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    if (comesBefore(ka, kb, dir)) return -1
    if (comesBefore(kb, ka, dir)) return 1
    return 0
  })
}

/** BE giới hạn pageSize của danh sách lệnh SX. */
const MAX_PRODUCTION_TAKE = 200

/**
 * Đoạn lệnh SX cần tải cho một trang của bảng gộp (đơn tạo + lệnh SX) khi sắp theo mã.
 * Trước vị trí đầu trang có tối đa `intakeCount` đơn tạo, nên lệnh SX đầu trang nằm từ
 * `start - intakeCount` trở đi.
 */
export function codeSortedProductionWindow(page: number, pageSize: number, intakeCount: number) {
  const end = page * pageSize
  const prodStart = Math.max(0, (page - 1) * pageSize - intakeCount, end - MAX_PRODUCTION_TAKE)
  return { prodStart, prodTake: end - prodStart }
}

/**
 * Ghép một trang theo mã đơn hàng. `intake` là toàn bộ đơn tạo (đã sắp theo mã),
 * `production` là lệnh SX tải theo `codeSortedProductionWindow` (BE đã sắp cùng chiều).
 */
export function mergeCodeSortedPage<I, P>(input: {
  page: number
  pageSize: number
  dir: SortDir
  intake: I[]
  intakeKey: (row: I) => number | null
  production: P[]
  productionKey: (row: P) => number | null
  prodStart: number
}): Array<{ kind: 'intake'; row: I } | { kind: 'order'; row: P }> {
  const { dir, intake, intakeKey, production, productionKey, prodStart } = input
  const start = (input.page - 1) * input.pageSize
  const end = input.page * input.pageSize

  let skipped = 0
  if (prodStart > 0) {
    // Lệnh SX đầu đoạn đứng sau `prodStart` lệnh SX khác và mọi đơn tạo có mã đứng trước nó.
    const anchor = production[0]
    if (anchor === undefined) return []
    const anchorKey = productionKey(anchor)
    while (skipped < intake.length && comesBefore(intakeKey(intake[skipped]), anchorKey, dir)) {
      skipped += 1
    }
  }

  const rows: Array<{ kind: 'intake'; row: I } | { kind: 'order'; row: P }> = []
  let position = prodStart + skipped
  let i = skipped
  let p = 0
  while (position < end && (i < intake.length || p < production.length)) {
    const takeIntake =
      p >= production.length ||
      (i < intake.length && comesBefore(intakeKey(intake[i]), productionKey(production[p]), dir))
    const row = takeIntake
      ? { kind: 'intake' as const, row: intake[i++] }
      : { kind: 'order' as const, row: production[p++] }
    if (position >= start) rows.push(row)
    position += 1
  }
  return rows
}
