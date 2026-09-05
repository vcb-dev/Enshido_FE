import type { ReactNode } from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { Toaster } from 'sonner'
import { theme } from './theme'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
      <Toaster
        position="top-right"
        closeButton
        richColors
        duration={3500}
        toastOptions={{
          style: { fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif' },
        }}
        icons={{
          success: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" fill="#1e8449" />
              <path
                d="M7.5 12.3 10.4 15.2 16.5 8.8"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ),
          error: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" fill="#c0392b" />
              <path
                d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          ),
        }}
      />
    </ThemeProvider>
  )
}
