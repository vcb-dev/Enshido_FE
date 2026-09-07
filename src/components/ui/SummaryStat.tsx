import { Box, Typography } from '@mui/material'

export type SummaryTone = 'open' | 'in' | 'out' | 'stock' | 'neutral'

export const SUMMARY_TONES: Record<SummaryTone, { bg: string; bar: string }> = {
  open: { bg: '#f7f9fb', bar: '#5d6d7e' },
  in: { bg: '#f2f8f4', bar: '#1e8449' },
  out: { bg: '#faf6f4', bar: '#c0392b' },
  stock: { bg: '#eaf0f6', bar: '#1b4f72' },
  neutral: { bg: '#f4f6f7', bar: '#5d6d7e' },
}

/** Ô số liệu tổng hợp đặt trên bảng (SL / TT / số dòng). */
export function SummaryStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: SummaryTone
}) {
  const colors = SUMMARY_TONES[tone]
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: colors.bg,
        border: '1px solid #b7c2cc',
        borderLeft: `4px solid ${colors.bar}`,
        borderRadius: 1,
        px: 1.25,
        py: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  )
}
