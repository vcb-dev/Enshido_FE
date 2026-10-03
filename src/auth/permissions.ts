export type RoleCode = 'ADMIN' | 'USER' | 'WORKER'

export const Permission = {
  USERS_MANAGE: 'users.manage',
  SCREEN_DASHBOARD: 'screen.dashboard',
  SCREEN_WAREHOUSE_NVL_CHINH: 'screen.warehouse.nvl-chinh',
  SCREEN_WAREHOUSE_BTP: 'screen.warehouse.btp-cho-vao-da',
  SCREEN_WAREHOUSE_TIEU_HAO: 'screen.warehouse.nvl-tieu-hao',
  SCREEN_WAREHOUSE_THANH_PHAM: 'screen.warehouse.thanh-pham',
  SCREEN_LOCATIONS: 'screen.locations',
  SCREEN_CATALOGS: 'screen.catalogs',
  SCREEN_INTAKE_ORDERS: 'screen.intake-orders',
  SCREEN_PRODUCTION_ORDERS: 'screen.production-orders',
  SCREEN_CASTING_ORDERS: 'screen.casting-orders',
  SCREEN_MY_TICKETS: 'screen.my-tickets',
  /** Thợ sản xuất: tự nhận phiếu con ở màn "Phiếu của tôi". */
  PRODUCTION_WORKER: 'production.worker',
  /** Bước 1: tạo đơn. */
  INTAKE_CREATE: 'intake.create',
  /** Bước 2: thủ kho duyệt / từ chối / sửa / xoá đơn. */
  INTAKE_APPROVE: 'intake.approve',
  /** Bước 3–4: thợ 3D gắn link 3D, in sáp resin. */
  PRODUCTION_MODEL3D: 'production.model3d',
  /** Bước 5–6: thợ sáp cấy cây thông, bơm sáp. */
  PRODUCTION_WAX: 'production.wax',
  /** Bước 8–9: thợ đúc bắt đầu đúc và nhập kết quả. */
  PRODUCTION_CAST: 'production.cast',
  /** Thủ kho: xác nhận sáp / đúc xong, lên phiếu đúc, cắt cây thông (cân phôi), chia phiếu, duyệt xuất NVL. */
  WAREHOUSE_KEEPER: 'warehouse.keeper',
  /** KCS: nhận lại hàng, chốt Lỗi / Hoàn thiện. */
  PRODUCTION_QC: 'production.qc',
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

/** Có ít nhất một trong các quyền (admin luôn có). */
export function canAny(user: PermissionUser | undefined | null, ...permissions: PermissionCode[]) {
  return permissions.some((permission) => can(user, permission))
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
function isProductionStageWorker(user: PermissionUser): boolean {
  return (
    can(user, Permission.PRODUCTION_MODEL3D) ||
    can(user, Permission.PRODUCTION_WAX) ||
    can(user, Permission.PRODUCTION_CAST)
  )
}

export function isWorkerOnly(user: PermissionUser | undefined | null): boolean {
  if (!user) return false
  const roles = [user.roleCode, ...(user.extraRoles ?? [])].filter(Boolean)
  if (!roles.includes('WORKER') || roles.includes('ADMIN')) return false
  if (isProductionStageWorker(user)) return false
  return true
}
