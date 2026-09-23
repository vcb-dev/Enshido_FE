import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { canAccessPath, homePathForUser } from './homePath'
import { AppBootSkeleton } from '../components/RouteSkeleton'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Đang kiểm tra phiên: dựng sẵn khung app + khung của màn sắp mở thay cho vòng xoay.
  if (loading) return <AppBootSkeleton />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!canAccessPath(user, location.pathname)) {
    return <Navigate to={homePathForUser(user)} replace />
  }

  return <Outlet />
}
