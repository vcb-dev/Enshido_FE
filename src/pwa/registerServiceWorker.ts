import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'

// Trong khoảng này coi như vừa mở app, chưa ai kịp nhập gì — tải lại thẳng.
const FRESH_LOAD_MS = 20_000

function isTyping() {
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  )
}

/**
 * Service worker phục vụ bản app đã lưu: deploy xong, lần mở đầu vẫn chạy bản cũ, phải mở
 * lại lần nữa mới lên bản mới. Nên khi bản mới cài xong:
 * - vừa mở app, chưa gõ gì → tải lại luôn;
 * - đang dùng dở (tab mở lâu, tab khác vừa kéo bản mới về, hoặc đang gõ) → hiện nút
 *   "Tải lại" cho người dùng tự bấm, không tự tải lại làm mất chữ đang nhập.
 */
export function registerServiceWorker() {
  registerSW({
    immediate: true,
    onNeedReload() {
      if (performance.now() < FRESH_LOAD_MS && !isTyping()) {
        window.location.reload()
        return
      }
      toast('Đã có bản mới của Enshido', {
        duration: Infinity,
        action: { label: 'Tải lại', onClick: () => window.location.reload() },
      })
    },
  })
}
