import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  loginApi,
  logoutApi,
  refreshApi,
  type AuthUser,
  type SessionResponse,
} from '../api/auth'
import { clearCachedSession, hasCsrfCookie, readCachedUser, saveCachedUser } from './session'
import { isOffline, sessionBoot } from './sessionBoot'
import { visibleWarehouses } from './screens'
import { prefetchStaff, prefetchWarehouseStock } from './prefetchWarehouse'
import { can, Permission } from './permissions'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  /** Máy đang mất mạng: giao diện dựng từ dữ liệu đã tải, mọi thao tác ghi sẽ lỗi. */
  offline: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const hasCookieAtBoot = typeof document !== 'undefined' && hasCsrfCookie()

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | undefined>()
  const [loading, setLoading] = useState(hasCookieAtBoot)
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' && !navigator.onLine,
  )

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
      prefetchWarehouseStock(
        queryClient,
        visibleWarehouses(session.user).map((warehouse) => warehouse.code),
      )
    },
    [queryClient],
  )

  useEffect(() => {
    let cancelled = false

    void sessionBoot.then((session) => {
      if (cancelled) return
      if (isOffline(session)) {
        // Chưa xác minh được phiên vì mất mạng — dùng hồ sơ đã lưu, KHÔNG đăng xuất.
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

  useEffect(() => {
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
