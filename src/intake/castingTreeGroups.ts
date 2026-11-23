import type { CastingSlipCandidate, CastingTreeInfo } from '../api/castingSlips'

/** Một cối (cây thông) trên màn Lên lệnh đúc — tích cối là chọn đủ các đơn cấy trên cây đó. */
export type CastingTreeGroup = {
  key: string
  /** null = đơn không có ảnh cây thông, hiện riêng từng đơn. */
  tree: CastingTreeInfo | null
  rows: CastingSlipCandidate[]
  qty: number
  waxGram: number
  /** Hạn trả sớm nhất trong cối. */
  dueDate: string | null
}

/** Gom dòng ứng viên theo cối, xếp Cối 1, 2… trước; đơn chưa có ảnh cây xuống cuối. */
export function groupCandidatesByTree(rows: CastingSlipCandidate[]): CastingTreeGroup[] {
  const groups = new Map<string, CastingTreeGroup>()
  for (const row of rows) {
    const key = row.castingTree ? `tree:${row.castingTree.no}` : `order:${row.id}`
    let group = groups.get(key)
    if (!group) {
      group = { key, tree: row.castingTree ?? null, rows: [], qty: 0, waxGram: 0, dueDate: null }
      groups.set(key, group)
    }
    group.rows.push(row)
    group.qty += row.qty
    group.waxGram += Number(row.waxWeightGram ?? 0)
    if (row.dueDate && (!group.dueDate || row.dueDate < group.dueDate)) group.dueDate = row.dueDate
  }
  return [...groups.values()].sort(
    (a, b) => (a.tree?.no ?? Number.MAX_SAFE_INTEGER) - (b.tree?.no ?? Number.MAX_SAFE_INTEGER),
  )
}

/** Số cối trong các dòng đã chọn (đơn không có ảnh cây tính mỗi đơn một cối). */
export function countPickedTrees(picked: CastingSlipCandidate[]) {
  return new Set(picked.map((row) => (row.castingTree ? `tree:${row.castingTree.no}` : `order:${row.id}`))).size
}
