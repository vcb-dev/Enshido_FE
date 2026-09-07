import { useEffect, useState } from 'react'

/** Trả về `value` sau khi ngừng thay đổi `delay` ms. Dùng cho ô tìm kiếm. */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
