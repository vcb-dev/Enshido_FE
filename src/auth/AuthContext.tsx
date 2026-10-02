import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onlineManager, useQueryClient } from '@tanstack/react-query'
import {
  loginApi,
  logoutApi,
  refreshApi,
  type AuthUser,
  type SessionResponse,
} from '../api/auth'
import { clearCachedSession, hasCsrfCookie, readCachedUser, saveCachedUser } from './session'
import { reportNetworkFailure } from './connectivity'
import { isOffline, sessionBoot } from './sessionBoot'
import { prefetchStaff, prefetchWarehouseStock } from './prefetchWarehouse'
import { can, Permission } from './permissions'
import { AuthStateContext } from './auth-state-context'

const hasCookieAtBoot = typeof document !== 'undefined' && hasCsrfCookie()

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | undefined>()
  const [loading, setLoading] = useState(hasCookieAtBoot)
  // Bám theo onlineManager chứ không riêng navigator.onLine: nối được wifi mà không ra
  // được máy chủ thì vẫn phải tính là ngoại tuyến (xem connectivity.ts).
  const [offline, setOffline] = useState(!onlineManager.isOnline())

  const applySession = useCallback(
    (session: SessionResponse) => {
      setUser(session.user)
      setExpiresAt(session.expiresAt)
      // Giữ lại hồ sơ để lần mở app không có mạng vẫn dựng được giao diện.
      saveCachedUser(session.user)
      if (session.lookups) {
        queryClient.setQueryData(['inventory-lookups'], session.lookups)
      } else {
        void import('../api/inventory').then(({ getInventoryLookupsApi }) =>
          queryClient.prefetchQuery({
            queryKey: ['inventory-lookups'],
            queryFn: getInventoryLookupsApi,
            staleTime: 30 * 60_000,
          }),
        )
      }
      void import('../pages/DashboardPage')
      void import('../pages/WarehousesPage')
      if (can(session.user, Permission.USERS_MANAGE)) prefetchStaff(queryClient)
      void import('./screens').then(({ firstAllowedPath }) => {
        const homeWarehouse = firstAllowedPath(session.user).match(/^\/warehouses\/([^/]+)/)?.[1]
        if (homeWarehouse) prefetchWarehouseStock(queryClient, [homeWarehouse])
      })
    },
    [queryClient],
  )

  useEffect(() => {
    let cancelled = false

    void sessionBoot.then((session) => {
      if (cancelled) return
      if (isOffline(session)) {
        // Chưa xác minh được phiên vì mất mạng — dùng hồ sơ đã lưu, KHÔNG đăng xuất.
        // Báo cho onlineManager luôn: nó vừa hỏng ngay ở lời gọi đầu tiên của app.
        reportNetworkFailure()
        setOffline(true)
        setUser(readCachedUser())
      } else if (session?.user) {
        applySession(session)
      } else {
        setUser(null)
        setExpiresAt(undefined)
        clearCachedSession()
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [applySession])

  useEffect(() => onlineManager.subscribe((isOnline) => setOffline(!isOnline)), [])

  useEffect(() => {
    if (!user || !expiresAt || !hasCsrfCookie()) return
    const wait = new Date(expiresAt).getTime() - Date.now() - 60_000
    const timer = window.setTimeout(() => {
      void refreshApi()
        .then(applySession)
        .catch(() => undefined)
    }, Math.max(wait, 3_000))
    return () => window.clearTimeout(timer)
  }, [user, expiresAt, applySession])

  const login = useCallback(
    async (username: string, password: string) => {
      const session = await loginApi(username, password)
      applySession(session)
      setLoading(false)
      return session.user
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    await logoutApi()
    clearCachedSession()
    setUser(null)
    setExpiresAt(undefined)
    queryClient.clear()
    // Dọn cả bản lưu ngoại tuyến: không để dữ liệu đơn nằm lại trên máy thợ.
    const { clearPersistedQueries } = await import('./offlineCache')
    clearPersistedQueries()
  }, [queryClient])

  const value = useMemo(
    () => ({ user, loading, offline, login, logout }),
    [user, loading, offline, login, logout],
  )

  return <AuthStateContext.Provider value={value}>{children}</AuthStateContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthStateContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
