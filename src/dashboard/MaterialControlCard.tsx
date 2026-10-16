import type { ReactNode } from 'react'
import { Box, Divider, Link, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { formatCt, formatQty } from '../api/inventory'
import type { ProductionOverview } from '../api/productionOrders'
import { fmt, OverviewCard } from './overviewShared'

/** Vật tư đang nằm ngoài kho: bạc ở thợ, đá đã cấp, phiếu chờ thủ kho đối soát. */
export function MaterialControlCard({ materials }: { materials: ProductionOverview['materials'] }) {
  const pending = materials.pendingKeeperConfirm
  return (
    <OverviewCard title="Vật tư cần kiểm soát" subtitle="Đang giao thợ · Chưa quyết toán">
      <Stack divider={<Divider flexItem />}>
        <MaterialRow
          label="Bạc tại thợ"
          hint="Khâu chưa trả: TL giao + bạc xuất thêm"
          value={`${formatQty(materials.silverAtWorkersG)} g`}
        />
        <MaterialRow
          label="Đá đang giao"
          hint={`Tương đương ${formatQty(materials.stonesHeldG)} g`}
          value={formatCt(materials.stonesHeldG)}
        />
        <MaterialRow
          label="Chờ thủ kho đối soát"
          hint={
            <Link component={RouterLink} to="/qc-tickets" underline="hover" color="inherit">
              Bàn giao Nguội / Vào đá đã QC
            </Link>
          }
          value={`${fmt(pending)} phiếu`}
          valueColor={pending ? 'error.main' : undefined}
        />
      </Stack>
    </OverviewCard>
  )
}

function MaterialRow({
  label,
  hint,
  value,
  valueColor,
}: {
  label: string
  hint: ReactNode
  value: string
  valueColor?: string
}) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      </Box>
      <Typography
        variant="h6"
        sx={{ fontWeight: 700, whiteSpace: 'nowrap', color: valueColor, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Stack>
  )
}
