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
import { clearCachedSession, hasCsrfCookie } from './session'
import { sessionBoot } from './sessionBoot'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
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

  const applySession = useCallback(
    (session: SessionResponse) => {
      setUser(session.user)
      setExpiresAt(session.expiresAt)
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
    },
    [queryClient],
  )

  useEffect(() => {
    let cancelled = false

    void sessionBoot.then((session) => {
      if (cancelled) return
      if (session?.user) applySession(session)
      else {
        setUser(null)
        setExpiresAt(undefined)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [applySession])

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
  }, [queryClient])

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
