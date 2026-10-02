import { can, canAny, isWorkerOnly, Permission } from './permissions'
import {
  canAccessProductionOrdersPage,
  canSeeCastingSlipsPage,
  canUseMyTickets,
  isIntakePipelineScoped,
} from '../intake/intake3dAccess'
import { canSeeWarehouse, firstAllowedPath, hasAnyWarehouse } from './screens'
import { canSeeCastingOrdersMenu, canSeeIntakeOrdersMenu } from './screenAccess'
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
  if (p.startsWith('/casting/') && p.endsWith('/print')) {
    return !isWorkerOnly(user) && can(user, Permission.WAREHOUSE_KEEPER)
  }
  if (p === '/orders' || (p.endsWith('/print') && p.startsWith('/orders'))) {
    if (isWorkerOnly(user)) return false
    if (p === '/orders') return canAccessProductionOrdersPage(user)
    return !isWorkerOnly(user)
  }
  if (p === '/intake-orders') {
    if (isWorkerOnly(user)) return false
    return canSeeIntakeOrdersMenu(user)
  }
  if (p === '/casting' || p.startsWith('/casting/')) {
    if (isIntakePipelineScoped(user)) return false
    if (isWorkerOnly(user)) return false
    return canSeeCastingOrdersMenu(user) || canSeeCastingSlipsPage(user)
  }
  if (p === '/casting-cuts') {
    return !isWorkerOnly(user) && canAny(user, Permission.WAREHOUSE_KEEPER, Permission.PRODUCTION_QC)
  }
  if (p.startsWith('/orders/')) return true
  if (p.startsWith('/tickets/')) return true
  if (p === '/my-tickets') return canUseMyTickets(user)
  if (p === '/finished-goods' || p.startsWith('/finished-goods/')) {
    if (isWorkerOnly(user)) return false
    return canSeeWarehouse(user, 'thanh-pham') || user?.roleCode === 'ADMIN'
  }
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
