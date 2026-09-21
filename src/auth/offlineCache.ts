import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import type { Mutation, Query } from '@tanstack/react-query'

const CACHE_KEY = 'enshido.queries.v1'
const MAX_AGE = 24 * 60 * 60_000

/**
 * Chỉ giữ lại phần việc của thợ để xem được khi ngoài xưởng mất sóng: danh sách phiếu của
 * mình và các đơn đã mở. Không lưu chi phí, kho hay danh mục — vừa thừa vừa nhạy cảm.
 */
const OFFLINE_KEYS = ['my-tickets', 'production-order', 'production-order-reference']

export const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: CACHE_KEY,
})

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: MAX_AGE,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) => {
      if (query.state.status !== 'success') return false
      const root = query.queryKey[0]
      return typeof root === 'string' && OFFLINE_KEYS.includes(root)
    },
    // Thao tác thợ bấm lúc mất sóng: giữ lại để đóng app rồi mở lại vẫn gửi lên được.
    // Chỉ những cái đang treo — cái đã gửi đi thì kết quả nằm ở máy chủ rồi.
    shouldDehydrateMutation: (mutation: Mutation) => mutation.state.isPaused,
  },
}

/** Gọi khi đăng xuất — không để dữ liệu đơn nằm lại trên điện thoại của thợ. */
export function clearPersistedQueries() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}
