import { Chip, Stack } from '@mui/material'
import type { IntakeOrder, IntakeOrderStatus } from '../api/intakeOrders'
import { productionStatusLabel } from '../orders/catalog'
import { StatusChip } from '../orders/OrderChips'
import { intakeStatusTone } from './intakeStatusTone'

export function IntakeStatusChip({
  status,
  size = 'small',
}: {
  status: IntakeOrderStatus
  size?: 'small' | 'medium'
}) {
  const meta = intakeStatusTone(status)
  return (
    <Chip
      size={size}
      label={meta.label}
      sx={{ bgcolor: meta.bg, color: meta.fg, fontWeight: 600 }}
    />
  )
}

/**
 * Trạng thái của một đơn ở màn Tạo đơn: trước cắt cây là bước của luồng tạo đơn; đã cắt cây thì
 * hiện trạng thái thật trên lệnh sản xuất, giống chip ở danh sách Lệnh sản xuất.
 */
export function IntakeOrderStatusChips({
  order,
}: {
  order: Pick<IntakeOrder, 'status' | 'productionStatuses' | 'platingSkipped'>
}) {
  const statuses = order.productionStatuses ?? []
  if (statuses.length === 0) return <IntakeStatusChip status={order.status} />
  if (statuses.length === 1 && statuses[0].count === 1) {
    return <StatusChip status={statuses[0].status} platingSkipped={order.platingSkipped} />
  }
  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
      {statuses.map(({ status, count }) => (
        <StatusChip
          key={status}
          status={status}
          label={`${productionStatusLabel(status, order.platingSkipped)} · ${count}`}
        />
      ))}
    </Stack>
  )
}
