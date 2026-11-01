import { Chip } from '@mui/material'
import type { CastingSlipStatus } from '../api/castingSlips'

export const SLIP_STATUS_META: Record<CastingSlipStatus, { label: string; bg: string }> = {
  PENDING_ISSUE: { label: 'Chờ cấp vật tư', bg: '#8d6e63' },
  WAIT_CASTING: { label: 'Chờ đúc', bg: '#283593' },
  CASTING: { label: 'Đang đúc', bg: '#c62828' },
  PENDING_CONFIRMATION: { label: 'Chờ thủ kho xác nhận', bg: '#e65100' },
  DONE: { label: 'Đúc xong', bg: '#00695c' },
  CAST_FAILED: { label: 'Lỗi đúc', bg: '#636e72' },
}

export function SlipStatusChip({ status }: { status: CastingSlipStatus }) {
  const meta = SLIP_STATUS_META[status]
  return <Chip size="small" label={meta.label} sx={{ bgcolor: meta.bg, color: '#fff', fontWeight: 600 }} />
}
