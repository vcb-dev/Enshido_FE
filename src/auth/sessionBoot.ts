import { restoreSessionApi, type SessionResponse } from '../api/auth'
import { clearCachedSession, hasCsrfCookie } from './session'

clearCachedSession()

declare global {
  interface Window {
    __ENSHIDO_SESSION__?: Promise<SessionResponse | null>
  }
}

function existingBoot() {
  if (typeof window === 'undefined') return undefined
  return window.__ENSHIDO_SESSION__
}

export const sessionBoot: Promise<SessionResponse | null> =
  existingBoot() ??
  (hasCsrfCookie() ? restoreSessionApi().catch(() => null) : Promise.resolve(null))
