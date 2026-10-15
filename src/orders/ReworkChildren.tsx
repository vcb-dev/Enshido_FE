import { useState } from 'react'
import { Alert, Button, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import type { IntakeOrder } from '../api/intakeOrders'
import type { ReworkChainItem } from '../api/productionOrders'
import { IntakeOrderDetailDialog } from '../intake/IntakeOrderDetailDialog'
import { INTAKE_STATUS_META } from '../intake/catalog'
import { STATUS_META } from './catalog'

/**
 * Phiếu bù vẫn đi từ sáp, nhưng được theo dõi dưới đúng phiếu lỗi — kể cả lệnh bù tiếp cho một
 * lệnh bù lại lỗi (dòng đó ghi "bù cho A008").
 */
export function ReworkChildren({ reworks, ticketCode, orderCode, title }: {
  reworks: ReworkChainItem[]
  ticketCode: string
  /** Mã lệnh đang xem — lệnh bù trực tiếp của nó không cần ghi "bù cho". */
  orderCode?: string
  title?: string
}) {
  const [target, setTarget] = useState<IntakeOrder | null>(null)
  if (!reworks.length) return null
  return <Stack spacing={1}>
    <Typography variant="subtitle2">{title ?? `Phiếu con bù cho ${ticketCode}`}</Typography>
    {reworks.map((item) => <Alert key={item.orderCode ?? item.code} severity="info" sx={{ py: 0.25 }} action={
      item.intake?.productionOrderCode && item.orderCode
        ? <Button component={RouterLink} to={`/orders/${item.orderCode}`} size="small">Mở phiếu bù</Button>
        : item.intake ? <Button size="small" onClick={() => setTarget(item.intake!)}>Xem phiếu bù</Button> : undefined
    }>
      <b>{item.orderCode ?? item.code}</b>
      {item.reworkOfCode && item.reworkOfCode !== orderCode ? ` · bù cho ${item.reworkOfCode}` : ''}
      {' '}· Đơn {item.intake?.code ?? item.code} · {item.qty} sp · {item.intake?.productionOrderCode && item.productionStatus ? STATUS_META[item.productionStatus].label : INTAKE_STATUS_META[item.status].label}
    </Alert>)}
    <IntakeOrderDetailDialog order={target} onClose={() => setTarget(null)} />
  </Stack>
}
