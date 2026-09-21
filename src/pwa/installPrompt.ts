import { useSyncExternalStore } from 'react'
import { installHint, type InstallHint } from './installHint'

/**
 * Chrome/Edge/Samsung Internet báo "cài được" bằng sự kiện beforeinstallprompt, thường bắn
 * ngay sau khi tải trang — trước cả khi AppShell kịp dựng. Nên bắt từ lúc nạp module
 * (import sớm ở main.tsx) và giữ lại cho nút "Cài đặt" gọi sau.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
// Cài xong thì tab trình duyệt vẫn mở tiếp — đừng mời cài lần nữa ở tab đó.
let installed = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Thay thanh mời cài mặc định của Chrome bằng lời nhắc trong app, hiện ở mọi màn.
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

type PromptState = 'idle' | 'ready' | 'installed'

function promptState(): PromptState {
  if (installed) return 'installed'
  return deferred ? 'ready' : 'idle'
}

/** Lời nhắc cài app hợp với máy đang mở — dùng chung cho banner và icon trên thanh trên. */
export function useInstallHint(): InstallHint {
  const state = useSyncExternalStore(subscribe, promptState, () => 'idle' as const)
  if (state === 'installed') return 'none'
  return installHint({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: isStandalone(),
    canPrompt: state === 'ready',
  })
}

/** Mở hộp thoại cài của trình duyệt. Trả true nếu người dùng đồng ý cài. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  // Mỗi sự kiện chỉ prompt() được một lần.
  deferred = null
  emit()
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === 'accepted'
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
