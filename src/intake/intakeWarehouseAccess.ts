import { can, Permission, type PermissionUser } from '../auth/permissions'

/** Thủ kho: quyền `warehouse.keeper` (admin luôn có). Khớp `canConfirmIntakeWarehouse` phía BE. */
export function canConfirmIntakeWarehouse(user: PermissionUser | null | undefined) {
  return can(user, Permission.WAREHOUSE_KEEPER)
}
