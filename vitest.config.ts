import { defineConfig } from 'vitest/config'

/**
 * Cấu hình riêng, không dùng vite.config.ts — bộ test chỉ chạy logic thuần
 * (đường dẫn, quyền, dựng bảng phiếu) nên không cần plugin React hay PWA.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
