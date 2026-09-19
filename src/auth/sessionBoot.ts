import { restoreSessionApi, type SessionResponse } from '../api/auth'
import { hasCsrfCookie } from './session'

/** Không xác minh được phiên vì máy mất mạng — khác hẳn với "hết phiên". */
export type OfflineBoot = { offline: true }
export type BootResult = SessionResponse | OfflineBoot | null

export function isOffline(result: BootResult): result is OfflineBoot {
  return result != null && 'offline' in result
}

declare global {
  interface Window {
    __ENSHIDO_SESSION__?: Promise<BootResult>
  }
}

function existingBoot() {
  if (typeof window === 'undefined') return undefined
  return window.__ENSHIDO_SESSION__
}

export const sessionBoot: Promise<BootResult> =
  existingBoot() ??
  (hasCsrfCookie()
    ? restoreSessionApi().catch((): BootResult => (navigator.onLine ? null : { offline: true }))
    : Promise.resolve(null))
