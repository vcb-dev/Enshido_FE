import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'

export type SummaryTone = 'open' | 'in' | 'out' | 'stock' | 'neutral'

export const SUMMARY_TONES: Record<SummaryTone, { bg: string; bar: string }> = {
  open: { bg: '#f7f9fb', bar: '#5d6d7e' },
  in: { bg: '#f2f8f4', bar: '#1e8449' },
  out: { bg: '#faf6f4', bar: '#c0392b' },
  stock: { bg: '#eaf0f6', bar: '#1b4f72' },
  neutral: { bg: '#f4f6f7', bar: '#5d6d7e' },
}

/** Khung ô số liệu: nền theo tone + vạch màu bên trái. */
function SummaryBox({
  tone,
  grow,
  children,
}: {
  tone: SummaryTone
  grow?: boolean
  children: ReactNode
}) {
  const colors = SUMMARY_TONES[tone]
  return (
    <Box
      sx={{
        ...(grow ? { flex: 1 } : null),
        minWidth: 0,
        bgcolor: colors.bg,
        border: '1px solid #b7c2cc',
        borderLeft: `4px solid ${colors.bar}`,
        borderRadius: 1,
        px: 1.25,
        py: 1,
      }}
    >
      {children}
    </Box>
  )
}

/** Ô số liệu một giá trị đặt trên bảng (SL / TT / số dòng). */
export function SummaryStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: SummaryTone
}) {
  return (
    <SummaryBox tone={tone} grow>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </SummaryBox>
  )
}

export type SummaryTileRow = { label: string; value: string }

/** Ô số liệu nhiều dòng: tiêu đề theo tone + các cặp nhãn / giá trị (SL, TT…). */
export function SummaryTile({
  title,
  rows,
  tone = 'neutral',
}: {
  title: string
  rows: SummaryTileRow[]
  tone?: SummaryTone
}) {
  const colors = SUMMARY_TONES[tone]
  return (
    <SummaryBox tone={tone}>
      <Typography variant="subtitle2" sx={{ mb: 0.75, color: colors.bar }}>
        {title}
      </Typography>
      <Stack spacing={0.35}>
        {rows.map((row) => (
          <Stack
            key={row.label}
            direction="row"
            spacing={0.75}
            sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
          >
            <Typography variant="caption" color="text.secondary">
              {row.label}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 700, color: colors.bar, fontVariantNumeric: 'tabular-nums' }}
            >
              {row.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </SummaryBox>
  )
}
