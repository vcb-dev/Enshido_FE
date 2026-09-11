import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export type PageHeaderProps = {
  title: ReactNode
  subtitle?: ReactNode
  /** Nút / control ghim bên phải tiêu đề. */
  actions?: ReactNode
  /** Breadcrumbs phía trên tiêu đề. Tự ẩn dưới `sm` để nhường chiều dọc. */
  breadcrumbs?: ReactNode
  /** Chip / badge đặt ngay cạnh tiêu đề. */
  titleAdornment?: ReactNode
  /** Nội dung phụ dưới subtitle (công thức, ghi chú…). */
  children?: ReactNode
  /** Ẩn subtitle dưới `sm` — cho trang đã có Tabs mang sẵn thông tin đó. */
  compactSubtitle?: boolean
  sx?: SxProps<Theme>
}

/**
 * Tiêu đề trang dùng chung: breadcrumbs + tiêu đề + subtitle + cụm nút.
 * Xuống một cột dưới `sm`, và bỏ breadcrumbs để dành chiều dọc cho dữ liệu.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  titleAdornment,
  children,
  compactSubtitle,
  sx,
}: PageHeaderProps) {
  return (
    <Stack spacing={1} sx={{ flexShrink: 0, ...sx }}>
      {breadcrumbs ? <Box sx={{ display: { xs: 'none', sm: 'block' } }}>{breadcrumbs}</Box> : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ alignItems: { sm: 'flex-start' }, justifyContent: 'space-between', gap: 1.5 }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h5">{title}</Typography>
            {titleAdornment}
          </Stack>
          {subtitle ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={compactSubtitle ? { display: { xs: 'none', sm: 'block' } } : undefined}
            >
              {subtitle}
            </Typography>
          ) : null}
          {children}
        </Stack>

        {actions ? (
          <Box sx={{ flexShrink: 0, alignSelf: { sm: 'center' } }}>{actions}</Box>
        ) : null}
      </Stack>
    </Stack>
  )
}
