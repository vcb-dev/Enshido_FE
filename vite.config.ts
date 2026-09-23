import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// Camera và service worker chỉ chạy trong secure context: localhost thì được, nhưng mở
// http://192.168.x.x trên điện thoại thật thì không. Chạy `pnpm dev:https` để dev server
// lên https bằng chứng chỉ tự ký — lần đầu vào máy sẽ cảnh báo, bấm tin cậy là dùng được.
const useHttps = process.env.VITE_HTTPS === '1'

export default defineConfig({
  plugins: [
    react(),
    ...(useHttps ? [basicSsl()] : []),
    // Cài lên điện thoại cho thợ dùng ngoài xưởng. Service worker chỉ giữ vỏ app
    // (HTML/JS/CSS); dữ liệu đơn do react-query lưu lại (xem src/main.tsx).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Enshido — Quản lý xưởng sản xuất',
        short_name: 'Enshido',
        description: 'Phiếu sản xuất và phiếu con cho thợ xưởng Enshido',
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f0e8',
        theme_color: '#6b4513',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Gọi API không đi qua service worker: không bao giờ phục vụ dữ liệu cũ mà
        // người dùng tưởng là mới. Phần xem offline nằm ở cache của react-query.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: /^\/api\//, handler: 'NetworkOnly' }],
      },
    }),
  ],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
