import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * Ô số có dấu chấm nghìn: mỗi lần gõ, React ghi lại chuỗi đã format nên trình duyệt đưa con trỏ về cuối
 * — gõ tiếp vào giữa số thì chữ số rơi xuống cuối, số "chạy loạn". Ghi lại cách tính vị trí con trỏ lúc
 * gõ (`place`), sau khi render thì đặt con trỏ theo chuỗi mới.
 */
export function useFormattedCaret(value: unknown) {
  const input = useRef<HTMLInputElement | null>(null)
  const pending = useRef<((formatted: string) => number) | null>(null)

  useLayoutEffect(() => {
    const el = input.current
    const place = pending.current
    pending.current = null
    if (!el || !place || document.activeElement !== el) return
    const pos = place(el.value)
    el.setSelectionRange(pos, pos)
  }, [value])

  const place = useCallback((fn: (formatted: string) => number) => {
    pending.current = fn
  }, [])

  return { input, place }
}
