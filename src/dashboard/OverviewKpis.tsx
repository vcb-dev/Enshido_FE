import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import type { ProductionOverview } from '../api/productionOrders'
import { fmt, OVERVIEW_COLOR, percent, SplitBar } from './overviewShared'

/** Bốn ô số đầu trang: trong xưởng, thành phẩm hôm nay, quá hạn, QC đạt lần đầu. */
export function OverviewKpis({ kpis }: { kpis: ProductionOverview['kpis'] }) {
  const { inShop, finishedToday, overdue, qcFirstPassToday } = kpis
  const planPct = percent(finishedToday.qty, finishedToday.planQty)
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
        label="Đang trong xưởng"
        value={fmt(inShop.qty)}
        unit="sản phẩm"
        note={`${fmt(inShop.openTickets)} phiếu công đoạn đang mở`}
      />
      <KpiTile
        color={OVERVIEW_COLOR.actual}
        label="Thành phẩm hôm nay"
        value={fmt(finishedToday.qty)}
        unit={finishedToday.planQty ? `/ ${fmt(finishedToday.planQty)} sp kế hoạch` : 'sản phẩm'}
        note={
          finishedToday.planQty ? (
            <Box component="span" sx={{ color: 'success.main' }}>
              Đạt {planPct}% kế hoạch ngày
            </Box>
          ) : (
            'Không có lệnh hạn giao hôm nay'
          )
        }
      >
        {finishedToday.planQty ? (
          <SplitBar
            parts={[
              { value: Math.min(finishedToday.qty, finishedToday.planQty), color: OVERVIEW_COLOR.actual },
              { value: Math.max(0, finishedToday.planQty - finishedToday.qty), color: OVERVIEW_COLOR.track },
            ]}
          />
        ) : null}
      </KpiTile>
      <KpiTile
        color={OVERVIEW_COLOR.danger}
        label="Phiếu quá hạn"
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
        label="Đạt QC lần đầu hôm nay"
        value={qcFirstPassToday.total ? `${percent(qcFirstPassToday.passed, qcFirstPassToday.total)}%` : '—'}
        note={
          qcFirstPassToday.total
            ? `${fmt(qcFirstPassToday.passed)} / ${fmt(qcFirstPassToday.total)} lượt kiểm các công đoạn`
            : 'Chưa có lượt QC hôm nay'
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
