import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './auth/sessionBoot'
// Bắt beforeinstallprompt trước khi React dựng xong — sự kiện có thể bắn rất sớm.
import './pwa/installPrompt'
import { registerServiceWorker } from './pwa/registerServiceWorker'
import { persistOptions } from './auth/offlineCache'
import { watchConnectivity } from './auth/connectivity'
import { AuthProvider } from './auth/AuthContext'
import { registerSubTicketActions } from './orders/subTicketActions'
import { AppProviders } from './theme/AppProviders'
import App from './App.tsx'

void import('@fontsource/roboto/400.css')
void import('@fontsource/roboto/500.css')
void import('@fontsource/roboto/700.css')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Dài hơn 10 phút cũ: query phải còn sống thì mới ghi được ra bản lưu ngoại tuyến.
      gcTime: 24 * 60 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})

watchConnectivity()
registerServiceWorker()
// Phải đăng ký trước khi khôi phục bản lưu: thao tác treo từ phiên trước dựng lại từ đây.
registerSubTicketActions(queryClient)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      // Khôi phục xong mới gửi: có mạng thì đẩy ngay hàng chờ của phiên trước lên.
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <BrowserRouter>
        <AppProviders>
          <AuthProvider>
            <App />
          </AuthProvider>
        </AppProviders>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
)
