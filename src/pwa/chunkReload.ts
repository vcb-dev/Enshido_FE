/**
 * Màn trắng sau deploy: tab mở từ bản cũ chuyển sang trang chưa tải lần nào thì xin file
 * JS mang mã băm cũ (vd. IntakeOrdersPage-<cũ>.js). Bản mới không còn file đó nên import
 * hỏng — không ai bắt thì React gỡ cả app. Cách chữa duy nhất là tải lại trang để lấy
 * index.html mới, nên tự tải lại một lần.
 */

const STORAGE_KEY = 'enshido:chunk-reload-at'
// Vừa tải lại vì lỗi này mà vẫn hỏng (mạng chết, server lỗi thật) thì thôi, không lặp vô hạn.
const RETRY_WINDOW_MS = 30_000

let reloading = false

/** Lỗi do không tải được file JS/CSS của một trang — khác lỗi code trong trang. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return (
    // Chrome/Edge — kể cả khi server trả HTML thay vì JS (lỗi MIME).
    /Failed to fetch dynamically imported module/i.test(message) ||
    // Firefox
    /error loading dynamically imported module/i.test(message) ||
    // Safari
    /Importing a module script failed/i.test(message) ||
    /Unable to preload CSS/i.test(message) ||
    /'text\/html' is not a valid JavaScript MIME type/i.test(message)
  )
}

/** Đang tải lại để lên bản mới — giao diện chỉ cần báo chờ, không hiện lỗi. */
export function isReloadingForNewVersion() {
  return reloading
}

/**
 * Tải lại trang để lấy bản mới. Trả false nếu vừa tải lại vì lỗi này cách đây chưa lâu —
 * khi đó lỗi không phải do deploy, để giao diện báo lỗi cho người dùng tự xử lý.
 */
export function reloadForNewVersion(now = Date.now()): boolean {
  if (reloading) return true
  let last = 0
  try {
    last = Number(sessionStorage.getItem(STORAGE_KEY)) || 0
  } catch {
    // Safari chế độ riêng tư có thể chặn sessionStorage — vẫn cho tải lại.
  }
  if (now - last < RETRY_WINDOW_MS) return false
  try {
    sessionStorage.setItem(STORAGE_KEY, String(now))
  } catch {
    // như trên
  }
  reloading = true
  window.location.reload()
  return true
}

/** Vite báo import trang hỏng qua sự kiện này (xem vite build.modulePreload). */
export function installChunkErrorReload() {
  window.addEventListener('vite:preloadError', (event) => {
    // preventDefault: import trả undefined thay vì ném lỗi — trang sắp tải lại nên không sao.
    if (reloadForNewVersion()) event.preventDefault()
  })
}
