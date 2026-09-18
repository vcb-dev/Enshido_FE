export type RoleCode = 'ADMIN' | 'USER' | 'WORKER'

export const Permission = {
  USERS_MANAGE: 'users.manage',
  SCREEN_DASHBOARD: 'screen.dashboard',
  SCREEN_WAREHOUSE_NVL_CHINH: 'screen.warehouse.nvl-chinh',
  SCREEN_WAREHOUSE_BTP: 'screen.warehouse.btp-cho-vao-da',
  SCREEN_WAREHOUSE_TIEU_HAO: 'screen.warehouse.nvl-tieu-hao',
  SCREEN_LOCATIONS: 'screen.locations',
  SCREEN_CATALOGS: 'screen.catalogs',
  /** Thợ sản xuất: tự nhận phiếu con ở màn "Phiếu của tôi". */
  PRODUCTION_WORKER: 'production.worker',
} as const

export type PermissionCode = (typeof Permission)[keyof typeof Permission]

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(Permission)

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Admin',
  USER: 'Nhân viên',
  WORKER: 'Thợ',
}

const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  ADMIN: ALL_PERMISSIONS,
  USER: [],
  // Thợ có sẵn quyền nhận phiếu con, không phải tick tay ở màn Nhân sự.
  WORKER: [Permission.PRODUCTION_WORKER],
}

export function permissionsForRoles(
  roleCode: RoleCode,
  extraRoles: readonly RoleCode[] = [],
): PermissionCode[] {
  return Array.from(
    new Set([roleCode, ...extraRoles].flatMap((r) => [...(ROLE_PERMISSIONS[r] ?? [])])),
  )
}

export type PermissionUser = {
  roleCode?: string
  extraRoles?: RoleCode[]
  permissions?: string[]
}

export function can(
  roleOrUser: RoleCode | PermissionUser | undefined | null,
  permission: PermissionCode,
) {
  if (!roleOrUser) return false
  if (typeof roleOrUser === 'object') {
    if (roleOrUser.roleCode === 'ADMIN') return true
    if (Array.isArray(roleOrUser.permissions)) {
      return roleOrUser.permissions.includes(permission)
    }
    if (roleOrUser.roleCode) {
      return permissionsForRoles(
        roleOrUser.roleCode as RoleCode,
        roleOrUser.extraRoles ?? [],
      ).includes(permission)
    }
    return false
  }
  return (ROLE_PERMISSIONS[roleOrUser] ?? []).includes(permission)
}

/**
 * Tài khoản chỉ làm thợ — dùng để CHẶN các màn quản lý đơn. Hệ quyền màn hình chỉ biết
 * "cho thêm" nên việc cấm phải hỏi tường minh ở đây. Thợ kiêm admin thì không bị chặn.
 */
export function isWorkerOnly(user: PermissionUser | undefined | null): boolean {
  if (!user) return false
  const roles = [user.roleCode, ...(user.extraRoles ?? [])].filter(Boolean)
  return roles.includes('WORKER') && !roles.includes('ADMIN')
}
