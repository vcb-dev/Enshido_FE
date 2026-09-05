export type RoleCode = 'ADMIN' | 'USER'

export const Permission = {
  USERS_MANAGE: 'users.manage',
} as const

export type PermissionCode = (typeof Permission)[keyof typeof Permission]

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Admin',
  USER: 'User',
}

const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  ADMIN: Object.values(Permission),
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

export function can(
  roleOrUser:
    | RoleCode
    | { roleCode?: RoleCode; extraRoles?: RoleCode[]; permissions?: string[] }
    | undefined
    | null,
  permission: PermissionCode,
) {
  if (!roleOrUser) return false
  if (typeof roleOrUser === 'object') {
    if (roleOrUser.permissions?.length) {
      return roleOrUser.permissions.includes(permission)
    }
    if (roleOrUser.roleCode) {
      return permissionsForRoles(
        roleOrUser.roleCode,
        roleOrUser.extraRoles ?? [],
      ).includes(permission)
    }
    return false
  }
  return (ROLE_PERMISSIONS[roleOrUser] ?? []).includes(permission)
}
