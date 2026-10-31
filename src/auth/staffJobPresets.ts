import type { RoleCode, UserRow } from '../api/auth'
import type { StageCode } from '../api/productionOrders'
import { Permission, permissionsForRoles, type PermissionCode, type PermissionUser } from './permissions'
import { SCREEN_GROUPS, type ScreenGroup } from './screens'

/** Vai trò nghiệp vụ khi thêm / sửa nhân sự (map xuống roleCode + allowedScreens). */
export type StaffJobPreset =
  | 'admin'
  | 'staff'
  | 'worker_3d'
  | 'worker_wax'
  | 'worker_casting'
  | 'worker_filing'
  | 'worker_stone'
  | 'worker_engrave'
  | 'worker_polish'
  | 'worker_plate'
  | 'vcb'
  | 'warehouse'
  | 'kcs'
  | 'accountant'

/**
 * Vai trò thợ lệnh sản xuất (Nguội → Xi): mỗi vai trò một khâu. Người làm nhiều khâu chọn
 * một vai trò chính rồi bấm "+ Thêm vai trò" để thêm vai trò thợ khâu khác.
 */
export const STAGE_WORKER_ROLES = [
  { preset: 'worker_filing', stage: 'FILING', label: 'Thợ nguội' },
  { preset: 'worker_stone', stage: 'STONE_SETTING', label: 'Thợ đá' },
  { preset: 'worker_engrave', stage: 'ENGRAVING', label: 'Thợ khắc' },
  { preset: 'worker_polish', stage: 'POLISHING', label: 'Thợ đánh bóng' },
  { preset: 'worker_plate', stage: 'PLATING', label: 'Thợ xi' },
] as const satisfies readonly { preset: StaffJobPreset; stage: StageCode; label: string }[]

export type StageWorkerPreset = (typeof STAGE_WORKER_ROLES)[number]['preset']

export function isStageWorkerPreset(preset: StaffJobPreset | ''): preset is StageWorkerPreset {
  return STAGE_WORKER_ROLES.some((role) => role.preset === preset)
}

export const STAFF_JOB_OPTIONS: { value: StaffJobPreset; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Nhân viên' },
  { value: 'vcb', label: 'VCB' },
  { value: 'worker_3d', label: 'Thợ 3D' },
  { value: 'worker_wax', label: 'Thợ sáp' },
  { value: 'worker_casting', label: 'Thợ đúc' },
  ...STAGE_WORKER_ROLES.map((role) => ({ value: role.preset, label: role.label })),
  { value: 'warehouse', label: 'Thủ kho' },
  { value: 'kcs', label: 'QC' },
  { value: 'accountant', label: 'Kế toán' },
]

const HIDDEN_STAFF_JOB_PRESETS = new Set<StaffJobPreset>(['staff'])

/** Vai trò chọn trên form thêm / sửa — không có Nhân viên (xưởng chỉ có thủ kho, QC, kế toán, VCB, các loại thợ). */
export function staffJobSelectOptions() {
  return STAFF_JOB_OPTIONS.filter((o) => !HIDDEN_STAFF_JOB_PRESETS.has(o.value))
}

/** Tài khoản Nhân viên cũ — mở form sửa thì chọn sẵn QC, admin đổi vai trò mới. */
export function staffJobPresetForEditForm(preset: StaffJobPreset): StaffJobPreset {
  return preset === 'staff' ? 'kcs' : preset
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
    case 'worker_3d':
      return 'Lệnh sản xuất: link 3D, in sáp.'
    case 'worker_wax':
      return 'Phiếu của tôi: Cấy cây thông. Lệnh sản xuất: bơm sáp.'
    case 'worker_casting':
      return 'Màn Lệnh đúc.'
    case 'worker_filing':
    case 'worker_stone':
    case 'worker_engrave':
    case 'worker_polish':
    case 'worker_plate':
      return 'Màn Phiếu của tôi — nhận và xem phiếu khâu của mình.'
    case 'vcb':
      return 'Khách ngoài xưởng: chỉ lên đơn, xem đơn, sửa đơn đang chờ duyệt.'
    case 'warehouse':
      return 'Tạo / duyệt đơn, các kho, xác nhận số liệu.'
    case 'kcs':
      return 'Nhận lại hàng từ thợ.'
    case 'accountant':
      return 'Kho thành phẩm: xác nhận phiếu xuất hàng.'
    case 'staff':
      return 'Chọn màn được xem ở bước chỉnh sửa nhân sự.'
  }
}

/** Quyền theo việc — gắn với Vai trò (Thủ kho / QC / Thợ 3D / sáp / đúc / SX), không tick trên form màn hình. */
export const STAGE_ROLE_PERMISSIONS: PermissionCode[] = [
  Permission.PRODUCTION_MODEL3D,
  Permission.PRODUCTION_WAX,
  Permission.PRODUCTION_CAST,
  Permission.PRODUCTION_WORKER,
  Permission.WAREHOUSE_KEEPER,
  Permission.PRODUCTION_QC,
  Permission.INTAKE_CREATE,
  Permission.INTAKE_APPROVE,
  Permission.ACCOUNTING_APPROVE,
  Permission.CUSTOMER,
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

/** Một vai trò hoặc cả danh sách vai trò của một tài khoản (vai trò chính + vai trò thêm). */
export type JobPresetInput = StaffJobPreset | readonly StaffJobPreset[]

function asList(input: JobPresetInput): readonly StaffJobPreset[] {
  return typeof input === 'string' ? [input] : input
}

/** Vai trò làm việc ở xưởng (có quyền việc riêng); còn lại là vai trò văn phòng. */
function isWorkerKindPreset(preset: StaffJobPreset): boolean {
  return isStageWorkerPreset(preset) || preset === 'worker_3d' || preset === 'worker_wax' || preset === 'worker_casting'
}

/**
 * Danh sách vai trò từ vai trò chính + các ô "Thêm vai trò". Khách VCB bị khoá riêng nên luôn
 * đứng một mình; ô chưa chọn, ô trùng và vai trò Nhân viên cũ bị bỏ.
 */
export function jobPresetsOf(
  primary: StaffJobPreset,
  extras: readonly (StaffJobPreset | '')[] = [],
): StaffJobPreset[] {
  if (primary === 'vcb') return ['vcb']
  const picked = extras.filter((preset): preset is StaffJobPreset => preset !== '' && preset !== 'vcb' && preset !== 'staff')
  return Array.from(new Set<StaffJobPreset>([primary, ...picked]))
}

/** Vai trò chọn thêm được: mọi vai trò trừ VCB (khách bị khoá riêng), bỏ những vai trò đã có. */
export function extraJobOptions(taken: readonly StaffJobPreset[]) {
  return staffJobSelectOptions().filter((option) => option.value !== 'vcb' && !taken.includes(option.value))
}

/**
 * Role lưu cho tài khoản: có Admin thì Admin; toàn vai trò thợ thì Thợ (chỉ làm trên phiếu của
 * mình); còn lại — có vai trò văn phòng kiêm thợ cũng vậy — là Nhân viên để không bị chặn các màn
 * quản lý. Quyền của từng vai trò nằm ở `allowedScreens`.
 */
export function roleCodeForPresets(input: JobPresetInput): RoleCode {
  const presets = asList(input)
  if (presets.includes('admin')) return 'ADMIN'
  if (presets.includes('vcb')) return 'USER'
  return presets.length > 0 && presets.every(isWorkerKindPreset) ? 'WORKER' : 'USER'
}

/** Màn hình tích thêm: Admin xem mọi màn, khách VCB cố định màn Tạo đơn — không cho tích. */
export function presetShowsScreenEditor(input: JobPresetInput): boolean {
  const presets = asList(input)
  return !presets.includes('admin') && !presets.includes('vcb')
}

export function roleAndScreensForPreset(preset: StaffJobPreset): {
  roleCode: RoleCode
  allowedScreens: PermissionCode[]
} {
  if (isStageWorkerPreset(preset)) {
    return {
      roleCode: 'WORKER',
      allowedScreens: [Permission.SCREEN_MY_TICKETS, Permission.PRODUCTION_WORKER],
    }
  }
  switch (preset) {
    case 'admin':
      return { roleCode: 'ADMIN', allowedScreens: [] }
    case 'staff':
      return { roleCode: 'USER', allowedScreens: [] }
    case 'worker_3d':
      return { roleCode: 'WORKER', allowedScreens: [Permission.PRODUCTION_MODEL3D] }
    case 'worker_wax':
      return {
        roleCode: 'WORKER',
        allowedScreens: [Permission.PRODUCTION_WAX, Permission.SCREEN_WAX_TREE],
      }
    case 'worker_casting':
      return {
        roleCode: 'WORKER',
        allowedScreens: [
          Permission.PRODUCTION_CAST,
          Permission.SCREEN_CASTING_ORDERS,
          Permission.SCREEN_MY_TICKETS,
        ],
      }
    case 'vcb':
      // Khách VCB ngoài xưởng: chỉ lên đơn, xem và sửa đơn — mã CUSTOMER khoá mọi việc khác.
      return {
        roleCode: 'USER',
        allowedScreens: [Permission.SCREEN_INTAKE_ORDERS, Permission.INTAKE_CREATE, Permission.CUSTOMER],
      }
    case 'warehouse':
      return {
        roleCode: 'USER',
        allowedScreens: [
          ...WAREHOUSE_SCREENS,
          Permission.SCREEN_PRODUCTION_ORDERS,
          Permission.SCREEN_CASTING_CUTS,
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
          Permission.SCREEN_QC_TICKETS,
          Permission.PRODUCTION_QC,
        ],
      }
    case 'accountant':
      return {
        roleCode: 'USER',
        allowedScreens: [
          Permission.SCREEN_DASHBOARD,
          Permission.SCREEN_WAREHOUSE_THANH_PHAM,
          Permission.ACCOUNTING_APPROVE,
        ],
      }
  }
}

/** Quyền việc của một vai trò (Thủ kho: duyệt đơn; QC; Thợ …) — không gồm màn hình menu. */
function jobPermissionsOf(preset: StaffJobPreset): PermissionCode[] {
  return roleAndScreensForPreset(preset).allowedScreens.filter(isStageRolePermission)
}

export function allowedScreensForSave(input: JobPresetInput, pickedScreens: PermissionCode[]): PermissionCode[] {
  const presets = asList(input)
  // Khách VCB: đúng bộ quyền cố định, bỏ mọi màn còn tick từ vai trò cũ.
  if (presets.includes('vcb')) return roleAndScreensForPreset('vcb').allowedScreens
  // Admin xem mọi màn: chỉ lưu quyền việc của các vai trò kiêm để nhận diện vai trò.
  if (presets.includes('admin')) return Array.from(new Set(presets.flatMap(jobPermissionsOf)))
  const screenKeys = new Set(USER_EDIT_SCREEN_KEYS)
  const saved = new Set<PermissionCode>(pickedScreens.filter((key) => screenKeys.has(key)))
  for (const preset of presets) {
    const fromPreset = roleAndScreensForPreset(preset).allowedScreens
    // Vai trò thợ: cả màn lẫn quyền; vai trò văn phòng: chỉ quyền việc, màn do admin tích.
    for (const key of isWorkerKindPreset(preset) ? fromPreset : fromPreset.filter(isStageRolePermission)) saved.add(key)
  }
  return Array.from(saved)
}

/**
 * Khâu lưu kèm tài khoản = các vai trò thợ khâu trong danh sách (bỏ trùng, theo thứ tự luồng).
 * Vai trò khác không có khâu; một người kiêm vai trò văn phòng vẫn giữ khâu thợ của mình.
 */
export function workerStagesForSave(input: JobPresetInput): StageCode[] {
  const presets = asList(input)
  return STAGE_WORKER_ROLES.filter((role) => presets.includes(role.preset)).map((role) => role.stage)
}

/** Thứ tự vai trò khi một tài khoản có nhiều vai trò — khớp danh sách chọn ở form. */
const JOB_ORDER: StaffJobPreset[] = [
  'worker_3d',
  'worker_wax',
  'worker_casting',
  ...STAGE_WORKER_ROLES.map((role) => role.preset),
  'warehouse',
  'kcs',
  'accountant',
]

/**
 * Mọi vai trò của một tài khoản (đầu danh sách = vai trò chính, còn lại là vai trò thêm). Đọc từ
 * quyền việc đã lưu và khâu thợ; Admin đứng đầu, khách VCB đứng một mình. Khớp `inferStaffJobPresets`
 * ở BE.
 */
export function inferStaffJobPresets(
  user: Pick<UserRow, 'roleCode' | 'allowedScreens' | 'workerStages'>,
): StaffJobPreset[] {
  const screens = new Set(user.allowedScreens ?? [])
  const admin = user.roleCode === 'ADMIN'
  if (!admin && screens.has(Permission.CUSTOMER)) return ['vcb']
  const worker = user.roleCode === 'WORKER'
  const stages = user.workerStages ?? []
  const has = (preset: StaffJobPreset): boolean => {
    switch (preset) {
      case 'worker_3d':
        return screens.has(Permission.PRODUCTION_MODEL3D)
      case 'worker_wax':
        return screens.has(Permission.PRODUCTION_WAX)
      case 'worker_casting':
        return screens.has(Permission.PRODUCTION_CAST) || (worker && screens.has(Permission.SCREEN_CASTING_ORDERS))
      case 'warehouse':
        return screens.has(Permission.WAREHOUSE_KEEPER)
      case 'kcs':
        return screens.has(Permission.PRODUCTION_QC)
      case 'accountant':
        return screens.has(Permission.ACCOUNTING_APPROVE)
      default:
        return STAGE_WORKER_ROLES.some((role) => role.preset === preset && stages.includes(role.stage))
    }
  }
  const found = JOB_ORDER.filter(has)
  // Tài khoản Thợ cũ chưa gán khâu nào: coi là Thợ nguội (màn sửa cho chọn lại).
  if (worker && found.length === 0) found.push('worker_filing')
  if (admin) found.unshift('admin')
  if (found.length > 0) return found
  // Nhân viên cũ — màn sửa đổi sang QC.
  return ['staff']
}

/** Vai trò chính (đầu danh sách). */
export function inferStaffJobPreset(
  user: Pick<UserRow, 'roleCode' | 'allowedScreens' | 'workerStages'>,
): StaffJobPreset {
  return inferStaffJobPresets(user)[0]
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

/**
 * Tài khoản sau khi lưu form (vai trò + màn đã tích), dạng dùng được cho các hàm kiểm tra menu —
 * màn phân quyền dùng để hiện đúng mục sidebar sẽ thấy.
 */
export function permissionUserForForm(input: JobPresetInput, pickedScreens: PermissionCode[]): PermissionUser {
  const roleCode = roleCodeForPresets(input)
  return {
    roleCode,
    extraRoles: [],
    permissions: Array.from(
      new Set([...permissionsForRoles(roleCode), ...allowedScreensForSave(input, pickedScreens)]),
    ),
  }
}

/** Màn vai trò tích sẵn nhưng admin bỏ được: Phiếu QC (QC), Cắt cây thông (Thủ kho). */
const OPTIONAL_ROLE_DEFAULTS = new Set<PermissionCode>([
  Permission.SCREEN_QC_TICKETS,
  Permission.SCREEN_CASTING_CUTS,
])

export function screensFromUserForPreset(
  user: Pick<UserRow, 'roleCode' | 'allowedScreens'>,
  input: JobPresetInput,
): PermissionCode[] {
  const presets = asList(input)
  if (presets.includes('admin')) return []
  const keys = new Set(USER_EDIT_SCREEN_KEYS)
  const picked = ((user.allowedScreens ?? []) as PermissionCode[]).filter((key) => keys.has(key))
  // Màn chỉ tích sẵn lúc tạo, bỏ được: không tự tích lại khi mở form sửa (tài khoản cũ đã có
  // quyền này từ migration).
  const roleDefaults = presets.flatMap((preset) =>
    roleAndScreensForPreset(preset).allowedScreens.filter(
      (key) => keys.has(key) && !OPTIONAL_ROLE_DEFAULTS.has(key),
    ),
  )
  const merged = Array.from(new Set([...picked, ...roleDefaults]))
  if (presets.some((preset) => legacyProductionOrdersTick(preset, merged))) {
    merged.push(Permission.SCREEN_PRODUCTION_ORDERS)
  }
  return merged
}

export function defaultEditScreensForPreset(input: JobPresetInput): PermissionCode[] {
  const presets = asList(input)
  if (presets.includes('admin')) return []
  const keys = new Set(USER_EDIT_SCREEN_KEYS)
  return Array.from(
    new Set(presets.flatMap((preset) => roleAndScreensForPreset(preset).allowedScreens.filter((key) => keys.has(key)))),
  )
}

/**
 * Màn đang tích sau khi đổi danh sách vai trò: bỏ màn mặc định của vai trò vừa bỏ (nếu vai trò còn
 * lại không cần), thêm màn mặc định của vai trò vừa thêm. Màn admin đã tích tay và màn đã bỏ tích
 * của vai trò vẫn còn được giữ nguyên.
 */
export function screensAfterPresetChange(
  current: readonly PermissionCode[],
  before: JobPresetInput,
  after: JobPresetInput,
): PermissionCode[] {
  const was = new Set(defaultEditScreensForPreset(before))
  const now = new Set(defaultEditScreensForPreset(after))
  const removed = new Set([...was].filter((key) => !now.has(key)))
  const added = [...now].filter((key) => !was.has(key))
  return Array.from(new Set([...current.filter((key) => !removed.has(key)), ...added]))
}

/** "Thủ kho + QC + Thợ nguội" — các vai trò của tài khoản, thợ khâu theo thứ tự luồng. */
export function staffJobLabel(
  user: Pick<UserRow, 'roleCode' | 'allowedScreens' | 'workerStages'>,
): string {
  return inferStaffJobPresets(user)
    .map((preset) => STAFF_JOB_OPTIONS.find((option) => option.value === preset)?.label ?? user.roleCode)
    .join(' + ')
}
