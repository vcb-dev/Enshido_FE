import { can, canAny, isWorkerOnly, Permission, type PermissionUser } from './permissions'
import { isIntakePipelineScoped } from '../intake/intake3dAccess'
import { canConfirmIntakeWarehouse } from '../intake/intakeWarehouseAccess'

function isAdmin(user: PermissionUser | null | undefined) {
  return user?.roleCode === 'ADMIN' || Boolean(user?.extraRoles?.includes('ADMIN'))
}

/** Nhân viên văn phòng (Tổng quan) — thấy Tạo đơn / Lệnh đúc mặc định. */
function legacyOfficeIntakeCastingMenu(user: PermissionUser | null | undefined): boolean {
  if (!user || isAdmin(user)) return false
  if (isIntakePipelineScoped(user)) return false
  if (canConfirmIntakeWarehouse(user)) return false
  if (isWorkerOnly(user)) return false
  const roles = [user.roleCode, ...(user.extraRoles ?? [])].filter(Boolean)
  return roles.includes('USER') && can(user, Permission.SCREEN_DASHBOARD)
}

export function canSeeIntakeOrdersMenu(user: PermissionUser | null | undefined): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (can(user, Permission.SCREEN_INTAKE_ORDERS)) return true
  if (canAny(user, Permission.INTAKE_CREATE, Permission.INTAKE_APPROVE)) return true
  return legacyOfficeIntakeCastingMenu(user)
}

export function canSeeCastingOrdersMenu(user: PermissionUser | null | undefined): boolean {
  if (!user) return false
  if (isAdmin(user)) return true
  if (can(user, Permission.SCREEN_CASTING_ORDERS)) return true
  // Lệnh đúc theo ô tích (tài khoản cũ đã được thêm quyền ở migration) — không tự mở cho
  // nhân viên văn phòng nữa, để bỏ tích là ẩn được.
  return can(user, Permission.PRODUCTION_CAST)
}

/**
 * Menu "Cắt cây thông": theo ô tích màn Cắt cây thông (vai trò Thủ kho tích sẵn), không cho tài
 * khoản chỉ thợ. Cân phôi / cắt cây vẫn cần `warehouse.keeper`. Sidebar và màn phân quyền dùng chung.
 */
export function canSeeCastingCutsMenu(user: PermissionUser | null | undefined): boolean {
  if (!user) return false
  return !isWorkerOnly(user) && can(user, Permission.SCREEN_CASTING_CUTS)
}

/** Báo cáo hao hụt thợ: chỉ thủ kho, kế toán, admin — QC không xem. */
export function canSeeLossReport(user: PermissionUser | null | undefined): boolean {
  if (!user || isWorkerOnly(user)) return false
  return canAny(user, Permission.WAREHOUSE_KEEPER, Permission.ACCOUNTING_APPROVE)
}

/**
 * Menu "Cấy cây thông": thợ sáp (quyền `production.wax`) hoặc ô tích màn Cấy cây thông.
 */
export function canSeeWaxTreeMenu(user: PermissionUser | null | undefined): boolean {
  if (!user) return false
  if (isWorkerOnly(user)) return false
  return canAny(user, Permission.PRODUCTION_WAX, Permission.SCREEN_WAX_TREE)
}
