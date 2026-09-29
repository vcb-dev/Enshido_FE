import type { IntakeOrderStatus } from '../api/intakeOrders'

type ChipTone = { label: string; bg: string; fg: string }

export const INTAKE_STATUS_META: Record<IntakeOrderStatus, ChipTone> = {
  PENDING_APPROVAL: { label: 'Chờ duyệt', bg: '#f39c12', fg: '#ffffff' },
  APPROVED: { label: 'Đã duyệt · Chờ SX', bg: '#2563eb', fg: '#ffffff' },
  READY_FOR_PRODUCTION: { label: 'Chờ SX · Đã có 3D', bg: '#00897b', fg: '#ffffff' },
  WAX_PRINTED: { label: 'Chờ SX · Đã in sáp', bg: '#6a1b9a', fg: '#ffffff' },
  PENDING_WAREHOUSE_CONFIRMATION: {
    label: 'Chờ thủ kho xác nhận',
    bg: '#e65100',
    fg: '#ffffff',
  },
  WAX_CONFIRMED: { label: 'Chờ SX · Đã có Sáp', bg: '#4527a0', fg: '#ffffff' },
  WAIT_CASTING: { label: 'Chờ đúc', bg: '#283593', fg: '#ffffff' },
  REJECTED: { label: 'Từ chối', bg: '#636e72', fg: '#ffffff' },
  NEW: { label: 'Mới', bg: '#eee8df', fg: '#4a3d2f' },
  IN_PROGRESS: { label: 'Đang xử lý', bg: '#2563eb', fg: '#ffffff' },
  COMPLETED: { label: 'Hoàn thành', bg: '#27ae60', fg: '#ffffff' },
  CANCELLED: { label: 'Huỷ', bg: '#2d3436', fg: '#ffffff' },
}

export const INTAKE_STATUSES: IntakeOrderStatus[] = [
  'PENDING_APPROVAL',
  'APPROVED',
  'READY_FOR_PRODUCTION',
  'WAX_PRINTED',
  'PENDING_WAREHOUSE_CONFIRMATION',
  'WAX_CONFIRMED',
  'WAIT_CASTING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]
