import { Chip } from '@mui/material'
import type {
  ProductionRequestType,
  ProductionSource,
  ProductionStatus,
  SubTicketState,
} from '../api/productionOrders'
import { REQUEST_TYPE_META, SOURCE_META, STATUS_META, SUB_TICKET_STATE_META } from './catalog'

export function StatusChip({
  status,
  size = 'small',
  label,
}: {
  status: ProductionStatus
  size?: 'small' | 'medium'
  label?: string
}) {
  const meta = STATUS_META[status]
  return (
    <Chip
      size={size}
      label={label ?? meta.label}
      sx={{ bgcolor: meta.bg, color: meta.fg, fontWeight: 600, borderRadius: 1 }}
    />
  )
}

export function RequestTypeChip({
  type,
  size = 'small',
}: {
  type: ProductionRequestType
  size?: 'small' | 'medium'
}) {
  const meta = REQUEST_TYPE_META[type]
  return (
    <Chip
      size={size}
      label={meta.label}
      sx={{ bgcolor: meta.bg, color: meta.fg, fontWeight: 600, borderRadius: 1 }}
    />
  )
}

export function SourceChip({ source, size = 'small' }: { source: ProductionSource; size?: 'small' | 'medium' }) {
  const meta = SOURCE_META[source]
  return (
    <Chip
      size={size}
      label={meta.label}
      sx={{ bgcolor: meta.bg, color: meta.fg, fontWeight: 600, borderRadius: 1 }}
    />
  )
}

export function SubTicketStateChip({ state, label }: { state: SubTicketState; label?: string }) {
  const meta = SUB_TICKET_STATE_META[state]
  return (
    <Chip
      size="small"
      label={label ?? meta.label}
      sx={{ bgcolor: meta.bg, color: meta.fg, fontWeight: 600, borderRadius: 1, maxWidth: '100%' }}
    />
  )
}
