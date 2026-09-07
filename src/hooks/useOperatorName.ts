import { useAuth } from '../auth/AuthContext'

/** Tên người đang đăng nhập, dùng làm "Người nhập"/"Người xuất" mặc định trên phiếu mới. */
export function useOperatorName() {
  const { user } = useAuth()
  return user?.fullName?.trim() || user?.username || ''
}
