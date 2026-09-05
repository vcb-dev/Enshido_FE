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

export function DashboardPage() {
  const { user } = useAuth()

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
                {user?.permissions?.length ? (
                  <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {user.permissions.map((p) => (
                      <Chip key={p} size="small" label={p} variant="outlined" />
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
