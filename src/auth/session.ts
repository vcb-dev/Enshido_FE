import type { AuthUser } from '../api/auth'

const KEY = 'enshido.session.v1'

export type CachedSession = {
  user: AuthUser
  expiresAt?: string
}

export function hasCsrfCookie() {
  return document.cookie.includes('enshido_csrf=')
}

export function readCachedSession(): CachedSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedSession
    if (!parsed?.user?.id) return null
    return parsed
  } catch {
    return null
  }
}

export function writeCachedSession(session: CachedSession) {
  sessionStorage.setItem(KEY, JSON.stringify(session))
}

export function clearCachedSession() {
  sessionStorage.removeItem(KEY)
}
