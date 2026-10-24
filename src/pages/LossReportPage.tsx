import { Stack, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import { canSeeLossReport } from '../auth/screenAccess'
import { PageHeader } from '../components/ui'
import { LossReportPanel } from '../dashboard/LossReportPanel'

/** Báo cáo hao hụt bạc theo tuần của từng thợ ở từng khâu — màn riêng, không nằm trong Tổng quan. */
export function LossReportPage() {
  const { user } = useAuth()
  if (!canSeeLossReport(user)) {
    return (
      <Stack spacing={2}>
        <PageHeader title="Báo cáo hao hụt" />
        <Typography variant="body2" color="text.secondary">
          Chỉ thủ kho và kế toán xem được báo cáo hao hụt.
        </Typography>
      </Stack>
    )
  }
  return (
    <Stack spacing={2}>
      <PageHeader title="Báo cáo hao hụt" subtitle="Hao hụt bạc mỗi thợ ở từng khâu theo tuần" />
      <LossReportPanel />
    </Stack>
  )
}
