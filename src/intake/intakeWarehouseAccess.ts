import type { AuthUser } from '../api/auth'
import { can, Permission } from '../auth/permissions'

/** Thủ kho: quyền `warehouse.keeper` (admin luôn có). Khớp `canConfirmIntakeWarehouse` phía BE. */
export function canConfirmIntakeWarehouse(user: AuthUser | null | undefined) {
  return can(user, Permission.WAREHOUSE_KEEPER)
}
