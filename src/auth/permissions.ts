export type RoleCode = 'ADMIN' | 'USER'

export const Permission = {
  USERS_MANAGE: 'users.manage',
  SCREEN_DASHBOARD: 'screen.dashboard',
  SCREEN_WAREHOUSE_NVL_CHINH: 'screen.warehouse.nvl-chinh',
  SCREEN_WAREHOUSE_BTP: 'screen.warehouse.btp-cho-vao-da',
  SCREEN_WAREHOUSE_TIEU_HAO: 'screen.warehouse.nvl-tieu-hao',
  SCREEN_LOCATIONS: 'screen.locations',
  SCREEN_CATALOGS: 'screen.catalogs',
} as const

export type PermissionCode = (typeof Permission)[keyof typeof Permission]

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(Permission)

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Admin',
  USER: 'Nhân viên',
}

const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  ADMIN: ALL_PERMISSIONS,
  USER: [],
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
