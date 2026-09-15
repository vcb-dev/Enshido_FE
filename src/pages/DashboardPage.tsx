import type { ReactNode } from 'react'
import { Chip, Divider, Paper, Stack, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import { SCREEN_GROUPS } from '../auth/screens'
import { PageHeader } from '../components/ui'

export function DashboardPage() {
  const { user } = useAuth()
  const screenLabels = SCREEN_GROUPS.flatMap((group) => group.items)
    .filter((item) => user?.permissions?.includes(item.key))
    .map((item) => item.label)

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Tổng quan"
        subtitle="Phiên làm việc hiện tại trên hệ thống quản lý xưởng."
      />
      <Paper sx={{ px: { xs: 1.5, sm: 2 }, py: 0.5 }}>
        <Stack divider={<Divider flexItem />}>
          <InfoRow label="Họ tên" value={user?.fullName} />
          <InfoRow label="Tài khoản" value={user?.username} />
          <InfoRow label="Vai trò" value={user?.roleLabel ?? user?.roleCode} />
          <InfoRow label="Bộ phận" value={user?.department ?? '—'} />
          <InfoRow label="Quyền">
            {screenLabels.length ? (
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {screenLabels.map((label) => (
                  <Chip key={label} size="small" label={label} variant="outlined" />
                ))}
              </Stack>
            ) : (
              '—'
            )}
          </InfoRow>
        </Stack>
      </Paper>
    </Stack>
  )
}

/** Một dòng nhãn / giá trị: nằm ngang từ `sm`, xuống hai dòng trên điện thoại. */
function InfoRow({
  label,
  value,
  children,
}: {
  label: string
  value?: string | null
  children?: ReactNode
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 0.25, sm: 2 }}
      sx={{ py: 1.25, alignItems: { sm: 'baseline' } }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ width: { sm: 180 }, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ minWidth: 0 }}>
        {children ?? value ?? '—'}
      </Typography>
    </Stack>
  )
}
