import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import {
  isChunkLoadError,
  isReloadingForNewVersion,
  reloadForNewVersion,
} from '../pwa/chunkReload'

interface Props {
  children: ReactNode
  /** Đổi giá trị (vd. đường dẫn) thì xoá lỗi cũ — chuyển sang màn khác là dùng tiếp được. */
  resetKey?: string
  /** `page`: chiếm cả màn hình (bọc ngoài cùng) · `inline`: nằm trong khung app, giữ menu. */
  variant?: 'page' | 'inline'
}

interface State {
  error: unknown
}

/**
 * Không có lớp này thì một lỗi lúc dựng giao diện làm React gỡ cả app — người dùng chỉ thấy
 * màn trắng. Ở đây: lỗi do thiếu file của bản cũ (sau deploy) → tự tải lại; lỗi khác → báo
 * lỗi kèm nút Tải lại.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadForNewVersion()) return
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error !== null && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (error === null) return this.props.children

    const page = this.props.variant === 'page'
    const frame = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      px: 3,
      py: 6,
      ...(page ? { minHeight: '100dvh' } : { flex: 1 }),
    }

    // vite:preloadError đã bấm tải lại rồi — import trả undefined nên lỗi rơi vào đây.
    if (isReloadingForNewVersion()) {
      return (
        <Box sx={frame}>
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Đang tải bản mới của Enshido…</Typography>
          </Stack>
        </Box>
      )
    }

    const chunk = isChunkLoadError(error)
    return (
      <Box sx={frame}>
        <Stack spacing={1.5} sx={{ alignItems: 'center', maxWidth: 420, textAlign: 'center' }}>
          <Typography variant="h6">
            {chunk ? 'Không tải được màn hình này' : 'Màn hình này gặp lỗi'}
          </Typography>
          <Typography color="text.secondary">
            {chunk
              ? 'Có thể mạng chập chờn hoặc app vừa cập nhật. Bấm Tải lại để thử lại.'
              : 'Bấm Tải lại để mở lại. Nếu vẫn lỗi, chụp màn hình gửi bộ phận kỹ thuật.'}
          </Typography>
          {!chunk && error instanceof Error ? (
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}
            >
              {error.message}
            </Typography>
          ) : null}
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => window.location.reload()}
            sx={{ mt: 1 }}
          >
            Tải lại
          </Button>
        </Stack>
      </Box>
    )
  }
}
