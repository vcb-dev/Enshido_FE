import { getPushPublicKeyApi, subscribePushApi, unsubscribePushApi } from '../api/notifications'
import { isIos } from '../pwa/installHint'
import { isStandalone } from '../pwa/installPrompt'

/**
 * Trạng thái thông báo ngoài app trên máy đang mở:
 * - `unsupported`: trình duyệt không có Web Push (Zalo, trình duyệt cũ, http không an toàn…).
 * - `needs-install`: iPhone / iPad chỉ nhận Web Push khi mở từ app đã thêm vào màn hình chính.
 * - `default`: chưa hỏi quyền — hiện nút "Bật thông báo".
 * - `granted` / `denied`: đã bật / đã chặn trong cài đặt trình duyệt.
 */
export type PushState = 'unsupported' | 'needs-install' | 'default' | 'granted' | 'denied'

function supported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function pushState(): PushState {
  if (typeof navigator !== 'undefined' && isIos(navigator.userAgent, navigator.maxTouchPoints) && !isStandalone()) {
    return 'needs-install'
  }
  if (!supported()) return 'unsupported'
  return Notification.permission === 'default' ? 'default' : Notification.permission
}

/** Khoá VAPID dạng base64url → bytes cho `applicationServerKey`. */
function keyBytes(base64url: string) {
  const padded = `${base64url}${'='.repeat((4 - (base64url.length % 4)) % 4)}`
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

async function registration() {
  // Service worker chỉ có trên bản build (pnpm build / preview) — dev server không đăng ký.
  const found = await navigator.serviceWorker.getRegistration()
  return found ? navigator.serviceWorker.ready : null
}

async function linkSubscription() {
  const reg = await registration()
  if (!reg) throw new Error('Chưa cài xong app trên máy này — tải lại trang rồi thử lại')
  const { publicKey } = await getPushPublicKeyApi()
  if (!publicKey) throw new Error('Máy chủ chưa bật thông báo ngoài app')
  const existing = await reg.pushManager.getSubscription()
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    }))
  await subscribePushApi(subscription.toJSON())
}

/** Người dùng bấm "Bật thông báo": hỏi quyền rồi gắn máy này vào tài khoản. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return pushState()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return pushState()
  await linkSubscription()
  return 'granted'
}

/**
 * Mỗi lần vào app (đăng nhập / mở lại): máy đã cho phép thì gắn lại endpoint vào tài khoản
 * đang đăng nhập — đổi người dùng trên cùng máy, hoặc endpoint trình duyệt tự đổi.
 */
export async function syncPush() {
  if (pushState() !== 'granted') return
  await linkSubscription().catch(() => undefined)
}

/** Đăng xuất: gỡ máy khỏi tài khoản để người khác dùng máy này không nhận thông báo cũ. */
export async function unlinkPush() {
  if (!supported()) return
  const reg = await registration()
  const subscription = await reg?.pushManager.getSubscription()
  if (!subscription) return
  await unsubscribePushApi(subscription.endpoint).catch(() => undefined)
  await subscription.unsubscribe().catch(() => undefined)
}
