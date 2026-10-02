import type { IntakeOrderStatus } from '../api/intakeOrders'

type ChipTone = { label: string; bg: string; fg: string }

/** Nhãn theo cột "Trạng thái đơn hàng" trong file mô tả luồng (chữ cái A–I ở cuối). */
export const INTAKE_STATUS_META: Record<IntakeOrderStatus, ChipTone> = {
  PENDING_APPROVAL: { label: 'Mới · Chờ duyệt', bg: '#f39c12', fg: '#ffffff' },
  APPROVED: { label: 'Đã duyệt · Chờ SX', bg: '#2563eb', fg: '#ffffff' },
  READY_FOR_PRODUCTION: { label: 'Chờ SX · Đã có 3D / khuôn', bg: '#00897b', fg: '#ffffff' },
  WAX_PRINTED: { label: 'Chờ SX · Đã in sáp', bg: '#6a1b9a', fg: '#ffffff' },
  PENDING_WAREHOUSE_CONFIRMATION: {
    label: 'Chờ thủ kho xác nhận sáp',
    bg: '#e65100',
    fg: '#ffffff',
  },
  WAX_CONFIRMED: { label: 'Chờ SX · Đã có sáp (E)', bg: '#4527a0', fg: '#ffffff' },
  WAIT_CASTING: { label: 'Chờ đúc (F)', bg: '#283593', fg: '#ffffff' },
  CASTING: { label: 'Đang đúc (G)', bg: '#c62828', fg: '#ffffff' },
  CAST_PENDING_CONFIRMATION: {
    label: 'Chờ thủ kho xác nhận đúc',
    bg: '#e65100',
    fg: '#ffffff',
  },
  CAST_DONE: { label: 'Đúc xong (H)', bg: '#00695c', fg: '#ffffff' },
  WAIT_COOLING: { label: 'Chờ nguội (I)', bg: '#0277bd', fg: '#ffffff' },
  REJECTED: { label: 'Từ chối', bg: '#636e72', fg: '#ffffff' },
  // Giá trị cũ còn trong enum, luồng không dùng.
  NEW: { label: 'Mới', bg: '#eee8df', fg: '#4a3d2f' },
  IN_PROGRESS: { label: 'Đang xử lý', bg: '#2563eb', fg: '#ffffff' },
  COMPLETED: { label: 'Hoàn thành', bg: '#27ae60', fg: '#ffffff' },
  CANCELLED: { label: 'Huỷ', bg: '#2d3436', fg: '#ffffff' },
}

/** Trạng thái theo thứ tự luồng — dùng cho ô lọc. */
export const INTAKE_STATUSES: IntakeOrderStatus[] = [
  'PENDING_APPROVAL',
  'APPROVED',
  'READY_FOR_PRODUCTION',
  'WAX_PRINTED',
  'PENDING_WAREHOUSE_CONFIRMATION',
  'WAX_CONFIRMED',
  'WAIT_CASTING',
  'CASTING',
  'CAST_PENDING_CONFIRMATION',
  'CAST_DONE',
  'WAIT_COOLING',
  'REJECTED',
]
