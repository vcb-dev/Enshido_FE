import type { RepairItem, RepairKeeperPart } from '../../api/repairs'

/**
 * PATCH /repairs/:id của thủ kho ghi đủ cả hai phần (thiếu ô nào BE ghi trống ô đó). Hộp thoại
 * Khách gửi sửa không có ô thủ kho nên gửi lại nguyên phần thủ kho từ dòng.
 */
export function keeperPartOf(item: RepairItem): RepairKeeperPart {
  return {
    returnedQty: item.returnedQty,
    returnedAt: item.returnedAt,
    note: item.note,
    transferConfirmedBy: item.transferConfirmedBy,
    issuerName: item.issuerName,
    repairedBy: item.repairedBy,
    returnedBy: item.returnedBy,
    receiverName: item.receiverName,
  }
}
