import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import type { ProductionOverview } from '../api/productionOrders'
import { changePercent } from './overviewPeriod'
import { fmt, OVERVIEW_COLOR, percent, SplitBar } from './overviewShared'

/** Thay đổi so với kỳ trước: mũi tên + màu (tăng tốt = xanh). */
function Delta({ value, unit = '%' }: { value: number | null; unit?: string }) {
  if (value == null) return <Box component="span">không có số kỳ trước để so</Box>
  const color = value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.secondary'
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '='
  return (
    <Box component="span" sx={{ color, fontWeight: 600 }}>
      {arrow} {fmt(Math.abs(value))}
      {unit} so với kỳ trước
    </Box>
  )
}

/**
 * Bốn ô số đầu trang. Trong xưởng / quá hạn là số hiện tại; thành phẩm / QC đạt lần đầu tính trong kỳ
 * đang xem và so với kỳ trước.
 */
export function OverviewKpis({ kpis }: { kpis: ProductionOverview['kpis'] }) {
  const { inShop, finished, overdue, qcFirstPass } = kpis
  const planPct = percent(finished.qty, finished.planQty)
  const qcRate = qcFirstPass.total ? (qcFirstPass.passed / qcFirstPass.total) * 100 : null
  const previousQcRate = qcFirstPass.previousTotal
    ? (qcFirstPass.previousPassed / qcFirstPass.previousTotal) * 100
    : null
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(4, minmax(0, 1fr))',
        },
      }}
    >
      <KpiTile
        color={OVERVIEW_COLOR.info}
        label="Đang trong xưởng · hiện tại"
        value={fmt(inShop.qty)}
        unit="sản phẩm"
        note={`${fmt(inShop.openTickets)} phiếu công đoạn đang mở`}
      />
      <KpiTile
        color={OVERVIEW_COLOR.actual}
        label="Thành phẩm trong kỳ"
        value={fmt(finished.qty)}
        unit={finished.planQty ? `/ ${fmt(finished.planQty)} sp kế hoạch` : 'sản phẩm'}
        note={
          <>
            {finished.planQty ? `Đạt ${planPct}% kế hoạch · ` : 'Không có lệnh hạn giao trong kỳ · '}
            <Delta value={changePercent(finished.qty, finished.previousQty)} />
            {finished.previousQty ? ` (${fmt(finished.previousQty)} sp)` : ''}
          </>
        }
      >
        {finished.planQty ? (
          <SplitBar
            parts={[
              { value: Math.min(finished.qty, finished.planQty), color: OVERVIEW_COLOR.actual },
              { value: Math.max(0, finished.planQty - finished.qty), color: OVERVIEW_COLOR.track },
            ]}
          />
        ) : null}
      </KpiTile>
      <KpiTile
        color={OVERVIEW_COLOR.danger}
        label="Phiếu quá hạn · hiện tại"
        value={fmt(overdue.count)}
        valueColor={overdue.count ? 'error.main' : undefined}
        unit="phiếu"
        note={
          overdue.byStage.length
            ? overdue.byStage.map((s) => `${s.count} tại ${s.label.toLowerCase()}`).join(' · ')
            : 'Không có phiếu trễ hạn giao'
        }
      />
      <KpiTile
        color={OVERVIEW_COLOR.actual}
        label="Đạt QC lần đầu trong kỳ"
        value={qcRate == null ? '—' : `${Math.round(qcRate)}%`}
        note={
          qcFirstPass.total ? (
            <>
              {fmt(qcFirstPass.passed)} / {fmt(qcFirstPass.total)} lượt kiểm ·{' '}
              <Delta
                value={previousQcRate == null || qcRate == null ? null : Math.round(qcRate - previousQcRate)}
                unit=" điểm %"
              />
            </>
          ) : (
            'Chưa có lượt QC trong kỳ'
          )
        }
      />
    </Box>
  )
}

function KpiTile({
  color,
  label,
  value,
  valueColor,
  unit,
  note,
  children,
}: {
  color: string
  label: string
  value: string
  valueColor?: string
  unit?: string
  note: ReactNode
  children?: ReactNode
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${color}`,
        borderRadius: 1,
        px: 2,
        py: 1.5,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexWrap: 'wrap', mt: 0.25 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: valueColor, fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Typography>
        {unit ? (
          <Typography variant="body2" color="text.secondary">
            {unit}
          </Typography>
        ) : null}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {note}
      </Typography>
      {children ? <Box sx={{ mt: 1 }}>{children}</Box> : null}
    </Box>
  )
}
