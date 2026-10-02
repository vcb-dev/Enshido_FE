import type { IntakeOrder } from '../api/intakeOrders'

/** Một dòng cân nặng SP dưới chip — không tách in sáp / cây thông. */
export function intakeProductWeightCaption(row: IntakeOrder): string | null {
  // Đã có số thủ kho cân kiểm thì hiện số đó — cũng là số phiếu đúc dùng.
  const raw = row.waxCheckedWeightGram ?? row.castingTreeWeightGram ?? row.productWeightGram
  if (raw == null || raw === '') return null
  return `${String(raw).replace('.', ',')} g`
}

export function intakeShowsProductWeight(row: IntakeOrder) {
  return (
    row.status === 'WAX_PRINTED' ||
    row.status === 'PENDING_WAREHOUSE_CONFIRMATION' ||
    row.status === 'WAX_CONFIRMED' ||
    row.status === 'WAIT_CASTING' ||
    row.status === 'CASTING' ||
    row.status === 'CAST_PENDING_CONFIRMATION' ||
    row.status === 'CAST_DONE'
  )
}
