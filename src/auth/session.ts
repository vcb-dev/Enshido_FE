import type { AuthUser } from '../api/auth'

const SESSION_CACHE_KEY = 'enshido.session.v1'

export function hasCsrfCookie() {
  return typeof document !== 'undefined' && document.cookie.includes('enshido_csrf=')
}

/**
 * Bản sao hồ sơ người đăng nhập, chỉ để dựng giao diện khi máy mất mạng. Quyền thật vẫn do
 * cookie httpOnly và server quyết định — có bản sao này cũng không gọi được API nào.
 */
export function saveCachedUser(user: AuthUser) {
  try {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(user))
  } catch {
    /* chế độ riêng tư / hết dung lượng — bỏ qua, chỉ mất tính năng xem offline */
  }
}

export function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function clearCachedSession() {
  try {
    localStorage.removeItem(SESSION_CACHE_KEY)
    sessionStorage.removeItem(SESSION_CACHE_KEY)
  } catch {
    /* ignore */
  }
}
