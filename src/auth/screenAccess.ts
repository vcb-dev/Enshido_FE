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
  if (can(user, Permission.PRODUCTION_CAST)) return true
  return legacyOfficeIntakeCastingMenu(user)
}
