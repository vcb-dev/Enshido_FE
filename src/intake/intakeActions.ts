import type { IntakeOrder } from '../api/intakeOrders'

/** Cần dán link 3D (đã duyệt, chưa có khuôn). */
export function intakeNeedsModel3d(row: IntakeOrder) {
  return row.status === 'APPROVED' && row.hasMold === false
}

/** Chờ SX · Đã có 3D (C) — nhập cân nặng + ảnh (in sáp hoặc bơm sáp). */
export function intakeNeedsProductSpecs(row: IntakeOrder) {
  if (row.status !== 'READY_FOR_PRODUCTION') return false
  if (row.requestType !== 'BULK') return true
  return (row.remainingQty ?? row.qty) > 0
}

/** Đơn đã in sáp — nhập số liệu cây thông (không đổi trạng thái). */
export function intakeNeedsCastingTreeSpecs(row: IntakeOrder) {
  if (row.status !== 'WAX_PRINTED') return false
  if (row.requestType !== 'BULK') return true
  return (row.remainingQty ?? row.qty) > 0
}

/** SL đã nhập lúc in / bơm sáp — SX SLL lấy số đã tách, không thì tổng đơn. */
export function intakeWaxEnteredQty(row: IntakeOrder) {
  if (row.requestType === 'BULK') return row.waxReleasedQty || row.qty
  return row.qty
}

/** SX SLL hiện SL kèm TL sáp; đơn SL 1 không cần. */
export function intakeShowsWaxQty(row: IntakeOrder) {
  return row.requestType === 'BULK' && intakeWaxEnteredQty(row) !== 1
}

/**
 * Đã nhập TL sáp thì sửa được (ghi đè lô đã tách / phiếu đúc nếu có). Chưa nhập thì dùng bước
 * in / bơm sáp, không hiện nút sửa.
 */
export function intakeCanEditWaxWeight(row: IntakeOrder) {
  if ((row.waxReleasedQty ?? 0) > 0) return true
  if (row.castingSlip) return true
  return Boolean(row.productWeightGram)
}

/** Đơn có khuôn bơm theo luồng cũ (bơm sáp + cây thông một lần), còn chờ thủ kho xác nhận. */
export function intakeIsLegacyMoldWax(row: IntakeOrder) {
  return row.hasMold === true && row.status === 'PENDING_WAREHOUSE_CONFIRMATION'
}

/** Đã nhập TL cây thông / đã có sáp — lên phiếu đúc trên màn Lệnh đúc. */
export function intakeNeedsCastingSlip(row: IntakeOrder) {
  return row.status === 'WAX_CONFIRMED' || row.status === 'PENDING_WAREHOUSE_CONFIRMATION'
}

/** Snapshot live có thể chỉ có trạng thái, chưa kèm mã A… của phiếu. */
export function intakeHasEnteredProduction(row: Pick<IntakeOrder, 'status' | 'productionOrderCode'>) {
  return row.status === 'WAIT_COOLING' || Boolean(row.productionOrderCode)
}
