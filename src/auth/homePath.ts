import { can, isWorkerOnly, Permission } from './permissions'
import { canSeeWarehouse, firstAllowedPath, hasAnyWarehouse } from './screens'

export function homePathForUser(user: { roleCode?: string; permissions?: string[] }): string {
  return firstAllowedPath(user)
}

export function canAccessPath(
  user: { roleCode?: string; permissions?: string[] },
  path: string,
): boolean {
  const p = (path.split('?')[0] || '/').replace(/\/$/, '') || '/'
  if (p === '/' || p === '') {
    return can(user, Permission.SCREEN_DASHBOARD) || firstAllowedPath(user) === '/'
  }
  if (p === '/warehouses') return hasAnyWarehouse(user)
  if (p.startsWith('/warehouses/')) {
    const code = p.split('/')[2] ?? ''
    return canSeeWarehouse(user, code)
  }
  // Thợ không vào màn quản lý đơn và trang in phiếu; riêng /orders/:code rơi vào bản
  // chỉ-đọc "Thông tin đơn (tham khảo)" để QR trên phiếu giấy đã in vẫn dùng được.
  if (p === '/orders' || p.endsWith('/print')) return !isWorkerOnly(user)
  if (p.startsWith('/orders/')) return true
  // Trang phiếu con mở từ QR — ai đăng nhập cũng xem được, chỉ thợ mới bấm nhận.
  if (p.startsWith('/tickets/')) return true
  if (p === '/my-tickets') return can(user, Permission.PRODUCTION_WORKER)
  if (p === '/finished-goods' || p.startsWith('/finished-goods/')) return !isWorkerOnly(user)
  if (p === '/settings') {
    return can(user, Permission.SCREEN_LOCATIONS) || can(user, Permission.SCREEN_CATALOGS)
  }
  if (p.startsWith('/settings/locations')) {
    return can(user, Permission.SCREEN_LOCATIONS)
  }
  if (p.startsWith('/settings/catalogs')) return can(user, Permission.SCREEN_CATALOGS)
  if (p === '/users') return can(user, Permission.USERS_MANAGE)
  return false
}

export function resolvePostLoginPath(
  user: { roleCode?: string; permissions?: string[] },
  from?: string | null,
): string {
  const home = homePathForUser(user)
  if (from && from !== '/login' && canAccessPath(user, from)) return from
  return home
}
