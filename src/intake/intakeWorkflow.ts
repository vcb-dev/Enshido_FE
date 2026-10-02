import type { IntakeOrder } from '../api/intakeOrders'
import { can, Permission, type PermissionUser } from '../auth/permissions'
import { intakeNeedsCastingTreeSpecs, intakeNeedsProductSpecs } from './intakeActions'
import { isIntake3dScoped, isIntakeWaxScoped } from './intake3dAccess'

export function intake3dWorkerOnly(user: PermissionUser | null | undefined): boolean {
  return isIntake3dScoped(user) && !isIntakeWaxScoped(user)
}

export function intakeWaxWorkerOnly(user: PermissionUser | null | undefined): boolean {
  return isIntakeWaxScoped(user) && !isIntake3dScoped(user)
}

/** Thợ 3D xong phần việc — chỉ còn xem chi tiết (không khuôn: sau khi in sáp; có khuôn: từ bước đã có 3D). */
export function intake3dActionsDone(order: IntakeOrder): boolean {
  if (order.status === 'WAX_PRINTED') return true
  if (order.status === 'READY_FOR_PRODUCTION' && order.hasMold === true) return true
  if (
    order.status === 'PENDING_WAREHOUSE_CONFIRMATION' ||
    order.status === 'WAX_CONFIRMED' ||
    order.status === 'WAIT_CASTING'
  ) {
    return true
  }
  return false
}

/** Thợ sáp — cây thông: có khuôn ở Chờ SX · Đã có 3D; không khuôn ở Chờ SX · Đã in sáp. */
export function intakeWaxNeedsCastingTree(order: IntakeOrder): boolean {
  if (order.hasMold === true) {
    return order.status === 'READY_FOR_PRODUCTION'
  }
  return intakeNeedsCastingTreeSpecs(order)
}

/** Thợ 3D — số liệu SP trước in sáp (đơn chưa có khuôn). */
export function intake3dNeedsProductSpecs(order: IntakeOrder): boolean {
  return intakeNeedsProductSpecs(order) && order.hasMold !== true
}

export function userCanIntake3dAct(user: PermissionUser | null | undefined): boolean {
  if (!user) return false
  if (user.roleCode === 'ADMIN' || user.extraRoles?.includes('ADMIN')) return true
  return can(user, Permission.PRODUCTION_MODEL3D)
}

export function userCanIntakeWaxAct(user: PermissionUser | null | undefined): boolean {
  if (!user) return false
  if (user.roleCode === 'ADMIN' || user.extraRoles?.includes('ADMIN')) return true
  return can(user, Permission.PRODUCTION_WAX)
}
