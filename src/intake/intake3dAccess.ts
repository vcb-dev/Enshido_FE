import type { IntakeOrderStatus } from '../api/intakeOrders'
import { can, Permission, type PermissionUser } from '../auth/permissions'
import { canConfirmIntakeWarehouse } from './intakeWarehouseAccess'

/** Thợ 3D chỉ thấy các công đoạn này trên Lệnh sản xuất. */
export const INTAKE_3D_VISIBLE_STATUSES: IntakeOrderStatus[] = [
  'PENDING_APPROVAL',
  'APPROVED',
  'READY_FOR_PRODUCTION',
  'WAX_PRINTED',
]

export const INTAKE_WAX_VISIBLE_STATUSES: IntakeOrderStatus[] = [
  'READY_FOR_PRODUCTION',
  'WAX_PRINTED',
  'PENDING_WAREHOUSE_CONFIRMATION',
]

export function isIntake3dScoped(user: PermissionUser | null | undefined): boolean {
  if (!user) return false
  if (user.roleCode === 'ADMIN') return false
  if (!can(user, Permission.PRODUCTION_MODEL3D)) return false
  return !can(user, Permission.SCREEN_DASHBOARD)
}

export function isIntakeWaxScoped(user: PermissionUser | null | undefined): boolean {
  if (!user) return false
  if (user.roleCode === 'ADMIN') return false
  if (!can(user, Permission.PRODUCTION_WAX)) return false
  return !can(user, Permission.SCREEN_DASHBOARD)
}

export function isIntakePipelineScoped(user: PermissionUser | null | undefined): boolean {
  return isIntake3dScoped(user) || isIntakeWaxScoped(user)
}

/** Thợ 3D / thợ sáp không dùng Phiếu của tôi dù role WORKER kèm quyền thợ SX. */
export function canUseMyTickets(user: PermissionUser | null | undefined): boolean {
  if (!user) return false
  if (user.roleCode === 'ADMIN') return true
  if (isIntakePipelineScoped(user)) return false
  if (can(user, Permission.SCREEN_MY_TICKETS)) return true
  if (can(user, Permission.PRODUCTION_CAST)) return true
  if (!can(user, Permission.PRODUCTION_WORKER)) return false
  return true
}

export function canAccessProductionOrdersPage(user: PermissionUser | null | undefined): boolean {
  if (!user) return false
  if (user.roleCode === 'ADMIN') return true
  if (isIntakePipelineScoped(user)) return true
  if (can(user, Permission.SCREEN_PRODUCTION_ORDERS)) return true
  if (canConfirmIntakeWarehouse(user)) return true
  if (can(user, Permission.PRODUCTION_QC)) return true
  if (can(user, Permission.INTAKE_APPROVE)) return true
  const roles = [user.roleCode, ...(user.extraRoles ?? [])].filter(Boolean)
  if (roles.includes('USER') && can(user, Permission.SCREEN_DASHBOARD)) return true
  return false
}

export function canSeeCastingSlipsPage(user: PermissionUser | null | undefined): boolean {
  if (!user) return false
  if (user.roleCode === 'ADMIN') return true
  if (can(user, Permission.SCREEN_CASTING_ORDERS)) return true
  if (can(user, Permission.PRODUCTION_CAST)) return true
  if (can(user, Permission.WAREHOUSE_KEEPER)) return true
  return false
}
