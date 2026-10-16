import type { ReactNode } from 'react'
import { Box, Paper, Stack, Typography } from '@mui/material'

/** Màu theo vai trò, dùng chung cho thẻ số, thanh công đoạn và biểu đồ (đã kiểm mù màu). */
export const OVERVIEW_COLOR = {
  actual: '#1baf7a',
  plan: '#a8a69f',
  working: '#1baf7a',
  waiting: '#a8a69f',
  info: '#2a78d6',
  danger: '#b52c1d',
  track: '#ece8df',
}

export const fmt = (value: number) => value.toLocaleString('vi-VN')

export function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0
}

/** "15/10" từ "2026-10-15". */
export function dayLabel(key: string) {
  const [, m, d] = key.split('-')
  return `${Number(d)}/${Number(m)}`
}

/** Khung một khối trên trang Tổng quan: tiêu đề + mô tả, nút / chú thích ghim phải. */
export function OverviewCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {action}
      </Stack>
      {children}
    </Paper>
  )
}

/** Thanh ngang chia đoạn theo tỉ lệ, không có chữ. */
export function SplitBar({ parts }: { parts: { value: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  return (
    <Box
      sx={{
        display: 'flex',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        bgcolor: OVERVIEW_COLOR.track,
      }}
    >
      {total > 0
        ? parts.map((part, i) =>
            part.value > 0 ? (
              <Box key={i} sx={{ width: `${(part.value / total) * 100}%`, bgcolor: part.color }} />
            ) : null,
          )
        : null}
    </Box>
  )
}
