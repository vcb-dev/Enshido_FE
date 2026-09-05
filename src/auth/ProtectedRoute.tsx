import { CircularProgress, Stack, Typography } from '@mui/material'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { canAccessPath, homePathForUser } from './homePath'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Stack spacing={1.5} sx={{ minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} />
        <Typography color="text.secondary">Đang kiểm tra phiên đăng nhập…</Typography>
      </Stack>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!canAccessPath(user, location.pathname)) {
    return <Navigate to={homePathForUser(user)} replace />
  }

  return <Outlet />
}
