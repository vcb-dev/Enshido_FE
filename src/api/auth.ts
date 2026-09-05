const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export type RoleCode = 'ADMIN' | 'USER'

export type AuthUser = {
  id: string
  username: string
  email: string | null
  fullName: string
  roleCode: RoleCode
  extraRoles?: RoleCode[]
  department: string | null
  roleLabel?: string
  permissions?: string[]
}

export type LoginResponse = {
  user: AuthUser
}

type ApiErrorBody = {
  message?: string | string[]
  statusCode?: number
}

const CSRF_COOKIE = 'enshido_csrf'
const CSRF_HEADER = 'X-CSRF-Token'

function readCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')}=([^;]*)`),
  )
  return match ? decodeURIComponent(match[1]) : null
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    if (Array.isArray(body.message)) return body.message.join(', ')
    if (typeof body.message === 'string') return body.message
  } catch {
    /* ignore */
  }
  return `Lỗi HTTP ${res.status}`
}

let refreshPromise: Promise<boolean> | null = null

function withCsrf(init?: HeadersInit): Headers {
  const headers = new Headers(init)
  const csrf = readCookie(CSRF_COOKIE)
  if (csrf) headers.set(CSRF_HEADER, csrf)
  return headers
}

async function tryRefresh(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: withCsrf({ 'Content-Type': 'application/json' }),
  })
  return res.ok
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = withCsrf(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  })

  if (
    res.status === 401 &&
    retry &&
    path !== '/auth/login' &&
    path !== '/auth/refresh'
  ) {
    refreshPromise ??= tryRefresh().finally(() => {
      refreshPromise = null
    })
    const ok = await refreshPromise
    if (ok) return apiFetch<T>(path, options, false)
  }

  if (!res.ok) {
    throw new Error(await parseError(res))
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function loginApi(username: string, password: string) {
  return apiFetch<LoginResponse>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
    false,
  )
}

export async function logoutApi() {
  try {
    await apiFetch('/auth/logout', { method: 'POST', body: '{}' }, false)
  } catch {
    /* ignore */
  }
}

export async function meApi() {
  return apiFetch<AuthUser>('/auth/me')
}

export type UserRow = {
  id: string
  username: string
  email: string | null
  fullName: string
  roleCode: RoleCode
  extraRoles?: RoleCode[]
  department: string | null
  isActive: boolean
  createdAt: string
}

export async function listUsersApi() {
  return apiFetch<UserRow[]>('/users')
}

export async function createUserApi(payload: {
  username: string
  password: string
  fullName: string
  roleCode: RoleCode
  department?: string
}) {
  return apiFetch<UserRow>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
