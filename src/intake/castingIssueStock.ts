import { formatQty } from '../api/inventory'

/** Cộng gram cấp theo từng mã — hai ô chọn cùng mã thì trừ một lần tồn. */
export function needByMaterialId(materialIds: Array<string | undefined>, issued: number[]) {
  const need = new Map<string, number>()
  materialIds.forEach((id, index) => {
    const grams = issued[index] ?? 0
    if (!id || grams <= 0) return
    need.set(id, (need.get(id) ?? 0) + grams)
  })
  return need
}

/** Lỗi thiếu tồn trên ô mã NVL — cùng nội dung với kho, hiện ngay khi chọn chứ không đợi Lưu. */
export function insufficientIssueStockMessage(params: {
  need: number
  availableQty?: string | null
  heldQty?: string | null
  onHandQty?: string | null
}): string | null {
  if (!(params.need > 0) || params.availableQty == null || params.availableQty === '') return null
  const available = Number(params.availableQty)
  if (!Number.isFinite(available) || params.need <= available) return null
  const held = Number(params.heldQty ?? 0)
  const onHand = Number(params.onHandQty ?? params.availableQty)
  const needText = formatQty(String(params.need))
  const availableText = formatQty(String(available))
  if (Number.isFinite(held) && held > 0) {
    return `Không đủ tồn để xuất (tồn thực ${formatQty(String(onHand))}, đang giữ chỗ ${formatQty(String(held))} — khả dụng ${availableText}, xuất ${needText})`
  }
  return `Không đủ tồn để xuất (sẵn có ${availableText}, xuất ${needText})`
}
