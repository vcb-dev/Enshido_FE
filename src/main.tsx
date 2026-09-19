import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './auth/sessionBoot'
import { persistOptions } from './auth/offlineCache'
import { AuthProvider } from './auth/AuthContext'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
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
