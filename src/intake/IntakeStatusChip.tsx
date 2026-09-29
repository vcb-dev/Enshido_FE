import { Chip } from '@mui/material'
import type { IntakeOrderStatus } from '../api/intakeOrders'
import { INTAKE_STATUS_META } from './catalog'

export function IntakeStatusChip({
  status,
  size = 'small',
}: {
  status: IntakeOrderStatus
  size?: 'small' | 'medium'
}) {
  const meta = INTAKE_STATUS_META[status]
  return (
    <Chip
      size={size}
      label={meta.label}
      sx={{ bgcolor: meta.bg, color: meta.fg, fontWeight: 600 }}
    />
  )
}
