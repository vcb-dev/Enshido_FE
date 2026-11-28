import type { RepairCustomerPart, RepairItem, RepairKeeperPart } from '../../api/repairs'

/**
 * PATCH /repairs/:id của thủ kho ghi đủ cả hai phần (thiếu ô nào BE ghi trống ô đó). Hai hộp thoại
 * tách riêng — Khách gửi sửa / Thủ kho xác nhận — nên phần không sửa thì gửi lại nguyên từ dòng.
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

export function customerPartOf(item: RepairItem): RepairCustomerPart {
  return {
    receivedAt: item.receivedAt,
    stage: item.stage,
    ticketCode: item.ticketCode,
    productCode: item.productCode,
    productName: item.productName,
    qty: item.qty,
    content: item.content,
    senderName: item.senderName,
  }
}
