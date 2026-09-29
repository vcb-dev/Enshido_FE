import type { IntakeOrder } from '../api/intakeOrders'

/** Cần dán link 3D (đã duyệt, chưa có khuôn). */
export function intakeNeedsModel3d(row: IntakeOrder) {
  return row.status === 'APPROVED' && row.hasMold === false
}

/** Chờ SX · Đã có 3D — nhập cân nặng + ảnh (in sáp hoặc có khuôn). */
export function intakeNeedsProductSpecs(row: IntakeOrder) {
  return row.status === 'READY_FOR_PRODUCTION'
}

/** Đơn đã in sáp — nhập số liệu cây thông (không đổi trạng thái). */
export function intakeNeedsCastingTreeSpecs(row: IntakeOrder) {
  return row.status === 'WAX_PRINTED'
}

/** Đã có sáp — mở phiếu đúc (Lên lệnh đúc). */
export function intakeNeedsCastingSlip(row: IntakeOrder) {
  return row.status === 'WAX_CONFIRMED'
}
