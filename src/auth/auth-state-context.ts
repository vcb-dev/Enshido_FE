import { createContext } from 'react'
import type { AuthUser } from '../api/auth'

export type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  /**
   * Máy chủ đang không với tới được: giao diện dựng từ dữ liệu đã tải, thao tác của thợ
   * trên phiếu con thì nằm trong hàng chờ (xem orders/subTicketActions.ts).
   */
  offline: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

/** Tách file để HMR không tạo context mới khi sửa màn hình / quyền. */
export const AuthStateContext = createContext<AuthContextValue | null>(null)
