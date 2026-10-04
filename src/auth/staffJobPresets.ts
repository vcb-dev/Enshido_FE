import type { RoleCode, UserRow } from '../api/auth'
import { Permission, type PermissionCode } from './permissions'
import { SCREEN_GROUPS, type ScreenGroup } from './screens'

/** Vai trò nghiệp vụ khi thêm / sửa nhân sự (map xuống roleCode + allowedScreens). */
export type StaffJobPreset =
  | 'admin'
  | 'staff'
  | 'worker_sx'
  | 'worker_3d'
  | 'worker_wax'
  | 'worker_casting'
  | 'warehouse'
  | 'kcs'

export const STAFF_JOB_OPTIONS: { value: StaffJobPreset; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Nhân viên' },
  { value: 'worker_sx', label: 'Thợ sản xuất' },
  { value: 'worker_3d', label: 'Thợ 3D' },
  { value: 'worker_wax', label: 'Thợ sáp' },
  { value: 'worker_casting', label: 'Thợ đúc' },
  { value: 'warehouse', label: 'Thủ kho' },
  { value: 'kcs', label: 'KCS' },
]

const HIDDEN_STAFF_JOB_PRESETS = new Set<StaffJobPreset>(['staff'])

/** Vai trò chọn trên form thêm / sửa — không có Nhân viên (xưởng chỉ có thủ kho, KCS, các loại thợ). */
export function staffJobSelectOptions() {
  return STAFF_JOB_OPTIONS.filter((o) => !HIDDEN_STAFF_JOB_PRESETS.has(o.value))
}

/** Tài khoản Nhân viên cũ — mở form sửa thì chọn sẵn KCS, admin đổi vai trò mới. */
export function staffJobPresetForEditForm(preset: StaffJobPreset): StaffJobPreset {
  return HIDDEN_STAFF_JOB_PRESETS.has(preset) ? 'kcs' : preset
}

const WAREHOUSE_SCREENS: PermissionCode[] = [
  Permission.SCREEN_WAREHOUSE_NVL_CHINH,
  Permission.SCREEN_WAREHOUSE_BTP,
  Permission.SCREEN_WAREHOUSE_TIEU_HAO,
  Permission.SCREEN_WAREHOUSE_THANH_PHAM,
]

export function staffJobPresetHint(preset: StaffJobPreset): string {
  switch (preset) {
    case 'admin':
      return 'Xem được mọi màn hình.'
    case 'worker_sx':
      return 'Màn Phiếu của tôi.'
    case 'worker_3d':
      return 'Lệnh sản xuất: link 3D, in sáp.'
    case 'worker_wax':
      return 'Lệnh sản xuất: bơm sáp, cây thông.'
    case 'worker_casting':
      return 'Màn Lệnh đúc.'
    case 'warehouse':
      return 'Tạo / duyệt đơn, các kho, xác nhận số liệu.'
    case 'kcs':
      return 'Nhận lại hàng từ thợ.'
    case 'staff':
      return 'Chọn màn được xem ở bước chỉnh sửa nhân sự.'
  }
}

/** Quyền theo việc — gắn với Vai trò (Thủ kho / KCS / Thợ 3D / sáp / đúc / SX), không tick trên form màn hình. */
export const STAGE_ROLE_PERMISSIONS: PermissionCode[] = [
  Permission.PRODUCTION_MODEL3D,
  Permission.PRODUCTION_WAX,
  Permission.PRODUCTION_CAST,
  Permission.PRODUCTION_WORKER,
  Permission.WAREHOUSE_KEEPER,
  Permission.PRODUCTION_QC,
  Permission.INTAKE_CREATE,
  Permission.INTAKE_APPROVE,
]

function isStageRolePermission(key: PermissionCode): boolean {
  return STAGE_ROLE_PERMISSIONS.includes(key)
}

/** Checkbox trên form sửa — chỉ màn hình menu (kho, Lệnh SX, …). */
export const USER_EDIT_SCREEN_KEYS: PermissionCode[] = SCREEN_GROUPS.flatMap((group) =>
  group.items.map((item) => item.key),
).filter((key) => !isStageRolePermission(key))

export function screenGroupsForUserEdit(): ScreenGroup[] {
  return SCREEN_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !isStageRolePermission(item.key)),
  })).filter((group) => group.items.length > 0)
}

export function presetShowsScreenEditor(preset: StaffJobPreset): boolean {
  return preset !== 'admin'
}

export function roleAndScreensForPreset(preset: StaffJobPreset): {
  roleCode: RoleCode
  allowedScreens: PermissionCode[]
} {
  switch (preset) {
    case 'admin':
      return { roleCode: 'ADMIN', allowedScreens: [] }
    case 'staff':
      return { roleCode: 'USER', allowedScreens: [] }
    case 'worker_sx':
      return {
        roleCode: 'WORKER',
        allowedScreens: [Permission.SCREEN_MY_TICKETS, Permission.PRODUCTION_WORKER],
      }
    case 'worker_3d':
      return { roleCode: 'WORKER', allowedScreens: [Permission.PRODUCTION_MODEL3D] }
    case 'worker_wax':
      return { roleCode: 'WORKER', allowedScreens: [Permission.PRODUCTION_WAX] }
    case 'worker_casting':
      return {
        roleCode: 'WORKER',
        allowedScreens: [
          Permission.PRODUCTION_CAST,
          Permission.SCREEN_CASTING_ORDERS,
          Permission.SCREEN_MY_TICKETS,
        ],
      }
    case 'warehouse':
      return {
        roleCode: 'USER',
        allowedScreens: [
          ...WAREHOUSE_SCREENS,
          Permission.SCREEN_PRODUCTION_ORDERS,
          Permission.WAREHOUSE_KEEPER,
          Permission.INTAKE_CREATE,
          Permission.INTAKE_APPROVE,
        ],
      }
    case 'kcs':
      return {
        roleCode: 'USER',
        allowedScreens: [
          Permission.SCREEN_DASHBOARD,
          Permission.SCREEN_PRODUCTION_ORDERS,
          Permission.PRODUCTION_QC,
        ],
      }
  }
}

export function allowedScreensForSave(
  preset: StaffJobPreset,
  pickedScreens: PermissionCode[],
): PermissionCode[] {
  if (preset === 'admin') return []
  const screenKeys = new Set(USER_EDIT_SCREEN_KEYS)
  const fromForm = pickedScreens.filter((key) => screenKeys.has(key))
  const fromPreset = roleAndScreensForPreset(preset).allowedScreens
  if (
    preset === 'worker_sx' ||
    preset === 'worker_3d' ||
    preset === 'worker_wax' ||
    preset === 'worker_casting'
  ) {
    return Array.from(new Set([...fromForm, ...fromPreset]))
  }
  const stage = fromPreset.filter((key) => isStageRolePermission(key))
  return Array.from(new Set([...fromForm, ...stage]))
}

export function inferStaffJobPreset(user: Pick<UserRow, 'roleCode' | 'allowedScreens'>): StaffJobPreset {
  if (user.roleCode === 'ADMIN') return 'admin'
  const screens = new Set(user.allowedScreens ?? [])
  if (user.roleCode === 'WORKER') {
    if (screens.has(Permission.PRODUCTION_MODEL3D)) return 'worker_3d'
    if (screens.has(Permission.PRODUCTION_WAX)) return 'worker_wax'
    if (
      screens.has(Permission.SCREEN_CASTING_ORDERS) ||
      screens.has(Permission.PRODUCTION_CAST)
    ) {
      return 'worker_casting'
    }
    return 'worker_sx'
  }
  if (screens.has(Permission.PRODUCTION_QC) && screens.has(Permission.SCREEN_DASHBOARD)) {
    return 'kcs'
  }
  if (
    screens.has(Permission.WAREHOUSE_KEEPER) &&
    WAREHOUSE_SCREENS.some((key) => screens.has(key)) &&
    !screens.has(Permission.PRODUCTION_MODEL3D) &&
    !screens.has(Permission.PRODUCTION_WAX)
  ) {
    return 'warehouse'
  }
  return 'staff'
}

function legacyProductionOrdersTick(
  preset: StaffJobPreset,
  picked: PermissionCode[],
): boolean {
  if (picked.includes(Permission.SCREEN_PRODUCTION_ORDERS)) return false
  if (preset === 'warehouse') {
    return (
      !picked.includes(Permission.SCREEN_DASHBOARD) &&
      WAREHOUSE_SCREENS.some((key) => picked.includes(key))
    )
  }
  if (preset === 'staff' || preset === 'kcs') {
    return picked.includes(Permission.SCREEN_DASHBOARD)
  }
  return false
}

export function screensFromUserForPreset(
  user: Pick<UserRow, 'roleCode' | 'allowedScreens'>,
  preset: StaffJobPreset,
): PermissionCode[] {
  if (preset === 'admin') return []
  const keys = new Set(USER_EDIT_SCREEN_KEYS)
  const picked = ((user.allowedScreens ?? []) as PermissionCode[]).filter((key) => keys.has(key))
  const roleDefaults = roleAndScreensForPreset(preset).allowedScreens.filter((key) => keys.has(key))
  const merged = Array.from(new Set([...picked, ...roleDefaults]))
  if (legacyProductionOrdersTick(preset, merged)) {
    merged.push(Permission.SCREEN_PRODUCTION_ORDERS)
  }
  return merged
}

export function defaultEditScreensForPreset(preset: StaffJobPreset): PermissionCode[] {
  if (preset === 'admin') return []
  const keys = new Set(USER_EDIT_SCREEN_KEYS)
  const fromRole = roleAndScreensForPreset(preset).allowedScreens.filter((key) => keys.has(key))
  return Array.from(new Set(fromRole))
}

export function staffJobLabel(user: Pick<UserRow, 'roleCode' | 'allowedScreens'>): string {
  const preset = inferStaffJobPreset(user)
  const match = STAFF_JOB_OPTIONS.find((option) => option.value === preset)
  return match?.label ?? user.roleCode
}
