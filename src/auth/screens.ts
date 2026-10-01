import { can, canAny, isWorkerOnly, Permission, type PermissionCode, type PermissionUser } from './permissions'
import { WAREHOUSES, warehousePath, type WarehouseCode } from '../warehouses/catalog'

export type ScreenGroup = {
  label: string
  items: { key: PermissionCode; label: string }[]
}

export const SCREEN_GROUPS: ScreenGroup[] = [
  {
    label: 'Chung',
    items: [{ key: Permission.SCREEN_DASHBOARD, label: 'Tổng quan' }],
  },
  {
    label: 'Kho',
    items: [
      { key: Permission.SCREEN_WAREHOUSE_NVL_CHINH, label: 'Kho NVL chính' },
      { key: Permission.SCREEN_WAREHOUSE_BTP, label: 'Kho BTP' },
      { key: Permission.SCREEN_WAREHOUSE_TIEU_HAO, label: 'Kho NVL tiêu hao' },
      { key: Permission.SCREEN_WAREHOUSE_THANH_PHAM, label: 'Kho thành phẩm' },
    ],
  },
  {
    label: 'Sản xuất',
    items: [{ key: Permission.PRODUCTION_WORKER, label: 'Thợ sản xuất (nhận phiếu con)' }],
  },
  {
    label: 'Quy trình đơn hàng (việc được làm)',
    items: [
      { key: Permission.INTAKE_CREATE, label: 'Tạo đơn (bước 1)' },
      {
        key: Permission.PRODUCTION_MANAGER,
        label:
          'Quản lý xưởng = quản lý SX + thủ kho + KCS: duyệt đơn, xác nhận sáp / đúc xong, lên phiếu đúc, xác nhận đúc (cân phôi), chia phiếu, KCS nhận lại (bước 2, 5–9, 11–18)',
      },
      { key: Permission.PRODUCTION_MODEL3D, label: 'Thợ 3D: gắn link 3D, in sáp (bước 3–4)' },
      { key: Permission.PRODUCTION_WAX, label: 'Thợ sáp: cấy cây thông, bơm sáp (bước 5–6)' },
      { key: Permission.PRODUCTION_CAST, label: 'Thợ đúc: bắt đầu đúc, nhập kết quả (bước 8–9)' },
    ],
  },
  {
    label: 'Cấu hình',
    items: [
      { key: Permission.SCREEN_LOCATIONS, label: 'Vị trí' },
      { key: Permission.SCREEN_CATALOGS, label: 'Danh mục' },
    ],
  },
  {
    label: 'Hệ thống',
    items: [{ key: Permission.USERS_MANAGE, label: 'Nhân sự' }],
  },
]

const WAREHOUSE_SCREEN: Record<WarehouseCode, PermissionCode> = {
  'nvl-chinh': Permission.SCREEN_WAREHOUSE_NVL_CHINH,
  'btp-cho-vao-da': Permission.SCREEN_WAREHOUSE_BTP,
  'nvl-tieu-hao': Permission.SCREEN_WAREHOUSE_TIEU_HAO,
  'thanh-pham': Permission.SCREEN_WAREHOUSE_THANH_PHAM,
}

export function canSeeWarehouse(user: PermissionUser | undefined | null, code: string) {
  const permission = WAREHOUSE_SCREEN[code as WarehouseCode]
  if (!permission) return false
  return can(user, permission)
}

export function visibleWarehouses(user: PermissionUser | undefined | null) {
  return WAREHOUSES.filter((warehouse) => canSeeWarehouse(user, warehouse.code))
}

export function hasAnyWarehouse(user: PermissionUser | undefined | null) {
  return visibleWarehouses(user).length > 0
}

export function firstAllowedPath(user: PermissionUser | undefined | null): string {
  // Thợ vào thẳng phần việc của mình, kể cả khi được tick thêm màn hình khác.
  if (isWorkerOnly(user)) return '/my-tickets'
  if (can(user, Permission.SCREEN_DASHBOARD)) return '/'
  const firstWarehouse = visibleWarehouses(user)[0]
  if (firstWarehouse) return warehousePath(firstWarehouse)
  if (can(user, Permission.SCREEN_LOCATIONS)) return '/settings/locations'
  if (can(user, Permission.SCREEN_CATALOGS)) return '/settings/catalogs'
  if (can(user, Permission.USERS_MANAGE)) return '/users'
  if (can(user, Permission.PRODUCTION_WORKER)) return '/my-tickets'
  // Người chỉ có quyền theo việc (thợ 3D, thợ đúc…) vào thẳng màn của việc mình.
  if (canAny(user, Permission.INTAKE_CREATE, Permission.INTAKE_APPROVE)) return '/intake-orders'
  if (canAny(user, Permission.PRODUCTION_MODEL3D, Permission.PRODUCTION_WAX, Permission.PRODUCTION_CAST)) {
    return '/orders'
  }
  if (canAny(user, Permission.WAREHOUSE_KEEPER, Permission.PRODUCTION_QC)) return '/orders'
  return '/'
}
