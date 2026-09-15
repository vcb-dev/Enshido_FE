import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import type { Breakpoint } from '@mui/material/styles'

/** Dưới `sm` (600px): điện thoại. Dialog chuyển fullScreen, bộ lọc gom vào drawer. */
export function useIsMobile() {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.down('sm'))
}

/** Dưới `md` (900px): điện thoại + tablet dọc — cùng ngưỡng với drawer tạm của AppShell. */
export function useIsCompact() {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.down('md'))
}

/**
 * Bảng có đang ở chế độ thẻ không, theo ngưỡng riêng của từng bảng.
 * Hook không được gọi có điều kiện nên luôn dựng chuỗi query rồi gọi một lần;
 * `false` nghĩa là bảng đó không bao giờ chuyển sang thẻ.
 */
export function useIsCardMode(breakpoint: Breakpoint | false) {
  const theme = useTheme()
  const query = breakpoint ? theme.breakpoints.down(breakpoint) : theme.breakpoints.up('xl')
  const matches = useMediaQuery(query)
  return breakpoint ? matches : false
}
