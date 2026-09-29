import type { AuthUser } from '../api/auth'
import { can, Permission } from '../auth/permissions'

const WAREHOUSE_KEEPER_PERMISSIONS = [
  Permission.SCREEN_WAREHOUSE_NVL_CHINH,
  Permission.SCREEN_WAREHOUSE_BTP,
  Permission.SCREEN_WAREHOUSE_TIEU_HAO,
  Permission.SCREEN_WAREHOUSE_THANH_PHAM,
] as const

/** Admin hoặc user có quyền ít nhất một màn kho (thủ kho). */
export function canConfirmIntakeWarehouse(user: AuthUser | null | undefined) {
  if (!user) return false
  if (user.roleCode === 'ADMIN' || user.extraRoles?.includes('ADMIN')) return true
  return WAREHOUSE_KEEPER_PERMISSIONS.some((permission) => can(user, permission))
}
