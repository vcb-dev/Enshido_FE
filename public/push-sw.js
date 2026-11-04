/* global self, clients */
// Nạp vào service worker do vite-plugin-pwa sinh (workbox.importScripts trong vite.config.ts).
// Nhận Web Push từ máy chủ và hiện thông báo của hệ điều hành, kể cả khi app đang đóng.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Enshido'
  const options = {
    body: data.body || undefined,
    icon: '/icon-192.png',
    badge: '/favicon.png',
    // Cùng một thông báo gửi lại (nhiều máy chủ / thử lại) thì thay, không chồng.
    tag: data.id || undefined,
    data: { id: data.id || null, url: data.url || '/' },
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Tab đang mở làm mới chuông ngay, không chờ tới lượt poll.
      clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((list) => list.forEach((client) => client.postMessage({ type: 'enshido-notification' }))),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { id, url } = event.notification.data || {}
  const target = new URL(url || '/', self.location.origin).href
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((item) => new URL(item.url).origin === self.location.origin)
      if (client) {
        // App đang mở: tự chuyển màn bằng router, không tải lại trang làm mất chữ đang nhập.
        client.postMessage({ type: 'enshido-open', id, url: url || '/' })
        return client.focus()
      }
      return clients.openWindow(id ? `${target}${target.includes('?') ? '&' : '?'}notification=${id}` : target)
    }),
  )
})
