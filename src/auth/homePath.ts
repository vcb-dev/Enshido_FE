export function homePathForUser(_user: { roleCode?: string }): string {
  return '/'
}

export function canAccessPath(
  user: { roleCode?: string; permissions?: string[] },
  path: string,
): boolean {
  const p = (path.split('?')[0] || '/').replace(/\/$/, '') || '/'
  if (p === '/' || p === '') return true
  if (p === '/warehouses' || p.startsWith('/warehouses/')) return true
  if (p === '/settings' || p.startsWith('/settings/')) return true
  if (p === '/orders' || p.startsWith('/orders/')) return true
  if (p === '/finished-goods' || p.startsWith('/finished-goods/')) return true
  if (p === '/users') {
    return user.roleCode === 'ADMIN' || user.permissions?.includes('users.manage') === true
  }
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
