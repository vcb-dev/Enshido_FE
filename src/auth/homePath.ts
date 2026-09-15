import { can, Permission } from './permissions'
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
  if (p === '/kho') return hasAnyWarehouse(user)
  if (p.startsWith('/kho/')) {
    const code = p.split('/')[2] ?? ''
    return canSeeWarehouse(user, code)
  }
  if (p === '/cau-hinh') {
    return can(user, Permission.SCREEN_LOCATIONS) || can(user, Permission.SCREEN_CATALOGS)
  }
  if (p.startsWith('/cau-hinh/vi-tri')) {
    return can(user, Permission.SCREEN_LOCATIONS)
  }
  if (p.startsWith('/cau-hinh/danh-muc')) return can(user, Permission.SCREEN_CATALOGS)
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
