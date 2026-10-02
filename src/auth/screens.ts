import { can, canAny, isWorkerOnly, Permission, type PermissionCode, type PermissionUser } from './permissions'
import { WAREHOUSES, warehousePath, type WarehouseCode } from '../warehouses/catalog'
import {
  canAccessProductionOrdersPage,
  canSeeCastingSlipsPage,
  canUseMyTickets,
} from '../intake/intake3dAccess'
import { canSeeCastingOrdersMenu, canSeeIntakeOrdersMenu } from './screenAccess'

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
    label: 'Sản xuất (màn hình menu)',
    items: [
      { key: Permission.SCREEN_INTAKE_ORDERS, label: 'Tạo đơn' },
      { key: Permission.SCREEN_PRODUCTION_ORDERS, label: 'Lệnh sản xuất' },
      { key: Permission.SCREEN_CASTING_ORDERS, label: 'Lệnh đúc' },
      { key: Permission.SCREEN_MY_TICKETS, label: 'Phiếu của tôi' },
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
  if (isWorkerOnly(user)) return '/my-tickets'
  if (can(user, Permission.SCREEN_DASHBOARD)) return '/'
  if (canSeeIntakeOrdersMenu(user)) return '/intake-orders'
  if (canAccessProductionOrdersPage(user)) return '/orders'
  if (canSeeCastingOrdersMenu(user) || canSeeCastingSlipsPage(user)) return '/casting'
  const firstWarehouse = visibleWarehouses(user)[0]
  if (firstWarehouse) return warehousePath(firstWarehouse)
  if (can(user, Permission.SCREEN_LOCATIONS)) return '/settings/locations'
  if (can(user, Permission.SCREEN_CATALOGS)) return '/settings/catalogs'
  if (can(user, Permission.USERS_MANAGE)) return '/users'
  if (canUseMyTickets(user)) return '/my-tickets'
  if (canAny(user, Permission.WAREHOUSE_KEEPER, Permission.PRODUCTION_QC)) return '/orders'
  return '/'
}
