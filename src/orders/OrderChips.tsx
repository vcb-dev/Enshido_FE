import { Chip } from '@mui/material'
import type { ProductionRequestType, ProductionSource, ProductionStatus } from '../api/productionOrders'
import { REQUEST_TYPE_META, SOURCE_META, STATUS_META } from './catalog'

export function StatusChip({ status, size = 'small' }: { status: ProductionStatus; size?: 'small' | 'medium' }) {
  const meta = STATUS_META[status]
  return (
    <Chip
      size={size}
      label={meta.label}
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
