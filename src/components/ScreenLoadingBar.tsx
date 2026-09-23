import { useEffect, useState } from 'react'
import { LinearProgress } from '@mui/material'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

/** Việc xong trong khoảng này thì không hiện vạch — tránh nháy khi mạng nhanh. */
const SHOW_DELAY_MS = 150

/**
 * Vạch chạy trên cùng màn hình khi màn đang chờ máy chủ vì việc người dùng vừa làm: mở màn,
 * sang trang, đổi bộ lọc (query có người xem mà chưa có dữ liệu) hoặc đang lưu.
 *
 * Làm mới nền không tính: poll định kỳ, invalidate sau khi lưu, prefetch lúc rê chuột — màn
 * đã có dữ liệu thì không cần giật vạch. Thao tác của thợ đang nằm chờ mạng (paused) cũng
 * không tính, không thì vạch chạy mãi suốt lúc ngoại tuyến.
 */
export function ScreenLoadingBar() {
  const loading = useIsFetching({
    predicate: (query) => query.state.data === undefined && query.getObserversCount() > 0,
  })
  const saving = useIsMutating({ predicate: (mutation) => !mutation.state.isPaused })
  return loading + saving > 0 ? <TopProgressBar /> : null
}

/** Vạch chạy ghim trên cùng màn hình; dựng lên thì chờ một nhịp ngắn rồi mới hiện. */
export function TopProgressBar() {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [])

  if (!shown) return null
  return (
    <LinearProgress
      aria-label="Đang tải"
      sx={{
        position: 'fixed',
        top: 'env(safe-area-inset-top)',
        left: 0,
        right: 0,
        height: 3,
        zIndex: (theme) => theme.zIndex.appBar + 1,
      }}
    />
  )
}
