import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'

export function DetailSection({ children }: { children: ReactNode }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25 }}>
      {children}
    </Typography>
  )
}

export function DetailFact({ label, value }: { label: string; value: ReactNode }) {
  const empty = value == null || value === ''
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 600, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
        {empty ? '—' : value}
      </Typography>
    </Box>
  )
}

export const DETAIL_GRID = {
  display: 'grid',
  gap: 1.75,
  gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' },
} as const
