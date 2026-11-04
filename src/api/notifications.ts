import { apiFetch } from './auth'

export type AppNotification = {
  id: string
  /** Mã loại, vd STAGE_WAITING — chọn biểu tượng theo mã này. */
  type: string
  title: string
  body: string | null
  url: string | null
  readAt: string | null
  createdAt: string
}

export type NotificationPage = {
  items: AppNotification[]
  hasMore: boolean
  unreadCount: number
}

export function listNotificationsApi(params: { before?: string; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.before) query.set('before', params.before)
  if (params.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return apiFetch<NotificationPage>(`/notifications${qs ? `?${qs}` : ''}`)
}

export function getUnreadNotificationCountApi() {
  return apiFetch<{ unreadCount: number }>('/notifications/unread-count')
}

export function markNotificationReadApi(id: string) {
  return apiFetch<{ unreadCount: number }>(`/notifications/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsReadApi() {
  return apiFetch<{ unreadCount: number }>('/notifications/read-all', { method: 'POST' })
}

export function getPushPublicKeyApi() {
  return apiFetch<{ publicKey: string | null }>('/notifications/push/public-key')
}

export function subscribePushApi(subscription: PushSubscriptionJSON) {
  return apiFetch<{ ok: boolean }>('/notifications/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
  })
}

export function unsubscribePushApi(endpoint: string) {
  return apiFetch<{ ok: boolean }>('/notifications/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  })
}
