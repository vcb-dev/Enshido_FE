import {
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import { SCREEN_GROUPS } from '../auth/screens'

export function DashboardPage() {
  const { user } = useAuth()
  const screenLabels = SCREEN_GROUPS.flatMap((group) => group.items)
    .filter((item) => user?.permissions?.includes(item.key))
    .map((item) => item.label)

  return (
    <Stack spacing={2}>
      <BoxHeader />
      <TableContainer component={Paper}>
        <Table size="small">
          <TableBody>
            <InfoRow label="Họ tên" value={user?.fullName} />
            <InfoRow label="Tài khoản" value={user?.username} />
            <InfoRow label="Vai trò" value={user?.roleLabel ?? user?.roleCode} />
            <InfoRow label="Bộ phận" value={user?.department ?? '—'} />
            <TableRow>
              <TableCell width={180} sx={{ color: 'text.secondary' }}>
                Quyền
              </TableCell>
              <TableCell>
                {screenLabels.length ? (
                  <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {screenLabels.map((label) => (
                      <Chip key={label} size="small" label={label} variant="outlined" />
                    ))}
                  </Stack>
                ) : (
                  '—'
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}

function BoxHeader() {
  return (
    <Stack>
      <Typography variant="h5">Tổng quan</Typography>
      <Typography variant="body2" color="text.secondary">
        Phiên làm việc hiện tại trên hệ thống quản lý xưởng.
      </Typography>
    </Stack>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <TableRow>
      <TableCell width={180} sx={{ color: 'text.secondary' }}>
        {label}
      </TableCell>
      <TableCell>{value || '—'}</TableCell>
    </TableRow>
  )
}
