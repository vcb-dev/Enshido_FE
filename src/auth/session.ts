const SESSION_CACHE_KEY = 'enshido.session.v1'

export function hasCsrfCookie() {
  return typeof document !== 'undefined' && document.cookie.includes('enshido_csrf=')
}

/** Drop leftover UI cache from older builds. Auth is cookie-only. */
export function clearCachedSession() {
  try {
    localStorage.removeItem(SESSION_CACHE_KEY)
    sessionStorage.removeItem(SESSION_CACHE_KEY)
  } catch {
    /* ignore */
  }
}
