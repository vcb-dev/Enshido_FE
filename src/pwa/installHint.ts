/**
 * Chọn lời nhắc cài app hợp với máy đang mở. Tách khỏi phần bắt sự kiện để test được
 * trong môi trường node, chỉ cần chuỗi user agent.
 *
 * - `prompt`: Chrome/Edge/Samsung trên Android đã báo cài được — hiện nút "Cài đặt".
 * - `ios`: Safari iOS không bao giờ tự mời cài, phải chỉ đường qua nút Chia sẻ.
 * - `in-app`: trình duyệt nhúng trong Zalo/Messenger… không cài được app, camera cũng
 *   hay bị chặn — nhắc mở bằng Chrome/Safari.
 * - `manual`: máy cảm ứng khác (Android chưa bắn beforeinstallprompt, Firefox…) — không
 *   tự mời được, chỉ đường qua menu trình duyệt khi người dùng bấm icon cài app.
 */
export type InstallHint = 'none' | 'prompt' | 'ios' | 'in-app' | 'manual'

const IN_APP_BROWSER =
  /\bZalo\b|FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|\bLine\/|MicroMessenger|TikTok|musical_ly/i

export function isInAppBrowser(userAgent: string) {
  return IN_APP_BROWSER.test(userAgent)
}

/** iPadOS 13+ tự nhận là Mac — chỉ phân biệt được nhờ màn cảm ứng. */
export function isIos(userAgent: string, maxTouchPoints: number) {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

export function installHint(env: {
  userAgent: string
  maxTouchPoints: number
  /** Đang chạy như app đã cài (mở từ màn hình chính). */
  standalone: boolean
  /** Trình duyệt đã bắn beforeinstallprompt và sự kiện còn dùng được. */
  canPrompt: boolean
}): InstallHint {
  if (env.standalone) return 'none'
  if (isInAppBrowser(env.userAgent)) return 'in-app'
  if (isIos(env.userAgent, env.maxTouchPoints)) return 'ios'
  // Máy tính của quản lý cũng nhận được sự kiện — chỉ mời cài trên máy cảm ứng.
  if (env.maxTouchPoints === 0) return 'none'
  return env.canPrompt ? 'prompt' : 'manual'
}
