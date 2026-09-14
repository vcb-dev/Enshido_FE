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
  meApi,
  refreshApi,
  type AuthUser,
  type SessionResponse,
} from '../api/auth'
import {
  clearCachedSession,
  hasCsrfCookie,
  readCachedSession,
  writeCachedSession,
} from './session'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const cached =
  typeof document === 'undefined' || !hasCsrfCookie() ? null : readCachedSession()

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(cached?.user ?? null)
  const [expiresAt, setExpiresAt] = useState<string | undefined>(cached?.expiresAt)
  const [loading, setLoading] = useState(!cached?.user)

  const applySession = useCallback(
    (session: SessionResponse) => {
      setUser(session.user)
      setExpiresAt(session.expiresAt)
      writeCachedSession({ user: session.user, expiresAt: session.expiresAt })
      if (session.lookups) {
        queryClient.setQueryData(['inventory-lookups'], session.lookups)
      }
    },
    [queryClient],
  )

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (!hasCsrfCookie()) {
        clearCachedSession()
        if (!cancelled) {
          setUser(null)
          setExpiresAt(undefined)
          setLoading(false)
        }
        return
      }

      try {
        const session = await meApi()
        if (!cancelled) applySession(session)
      } catch {
        if (!cancelled) {
          clearCachedSession()
          setUser(null)
          setExpiresAt(undefined)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void boot()
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
