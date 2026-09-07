import { Paper, Stack, Typography } from '@mui/material'
import { SummaryStat } from './SummaryStat'
import type { SummaryTone } from './SummaryStat'

export type PanelSummaryStat = {
  label: string
  value: string
  tone?: SummaryTone
}

/** Ô "Tổng hợp ..." ghim trên bảng: tiêu đề + hàng SummaryStat, dùng chung cho các panel kho. */
export function PanelSummaryCard({
  title,
  stats,
}: {
  title: string
  stats: PanelSummaryStat[]
}) {
  return (
    <Paper sx={{ p: 1.25, flexShrink: 0 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        {stats.map((stat) => (
          <SummaryStat key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
        ))}
      </Stack>
    </Paper>
  )
}
