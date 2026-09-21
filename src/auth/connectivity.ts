import { onlineManager } from '@tanstack/react-query'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'
const PROBE_INTERVAL = 5_000

/**
 * `navigator.onLine` chỉ biết máy có nối wifi hay không. Ngoài xưởng thợ vẫn bắt được
 * sóng AP mà không ra được internet — lúc đó trình duyệt báo "online" trong khi mọi lời
 * gọi API đều hỏng, và react-query sẽ cho thao tác của thợ chết thay vì xếp hàng lại.
 *
 * Nên: gọi API hỏng vì mạng thì tự hạ cờ xuống ngoại tuyến, rồi cứ vài giây hỏi thăm
 * máy chủ một lần cho tới khi nó trả lời. Cờ lên lại là react-query tự gửi hàng chờ.
 */
let probeTimer: ReturnType<typeof setInterval> | undefined

function stopProbe() {
  if (probeTimer == null) return
  clearInterval(probeTimer)
  probeTimer = undefined
}

async function serverAnswers(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
      cache: 'no-store',
    })
    // 401 vẫn là máy chủ trả lời — mạng đã thông, phiên hết hạn là chuyện khác.
    return res.ok || res.status === 401
  } catch {
    return false
  }
}

function startProbe() {
  if (probeTimer != null) return
  probeTimer = setInterval(() => {
    // Điện thoại nằm trong túi thì đừng dò — vừa tốn pin vừa vô ích, mở app ra là dò lại.
    if (typeof document !== 'undefined' && document.hidden) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    void serverAnswers().then((ok) => {
      if (ok) onlineManager.setOnline(true)
    })
  }, PROBE_INTERVAL)
}

/** Gọi khi một request chết vì mạng (fetch ném TypeError), không phải vì máy chủ trả lỗi. */
export function reportNetworkFailure() {
  if (!onlineManager.isOnline()) return
  onlineManager.setOnline(false)
  startProbe()
}

/** Gắn một lần lúc khởi động: có mạng lại thì thôi hỏi thăm. */
export function watchConnectivity() {
  return onlineManager.subscribe((isOnline) => {
    if (isOnline) stopProbe()
    else startProbe()
  })
}
