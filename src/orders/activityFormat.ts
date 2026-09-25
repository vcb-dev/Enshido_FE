import { formatDateTime } from './catalog'

/** Nhãn cho mã thao tác BE ghi (`ACTIVITY` trong activity-log.ts). Mã lạ thì hiện nguyên mã. */
export const ACTION_LABEL: Record<string, string> = {
  ORDER_CREATE: 'Lên đơn',
  ORDER_UPDATE: 'Sửa đơn',
  ORDER_DELETE: 'Xoá đơn',
  ORDER_STATUS: 'Đổi trạng thái',
  ORDER_CASTING: 'Báo Đúc / Đúc về',
  ORDER_FINISH: 'Hoàn thiện đơn',
  ORDER_UNDO_FINISH: 'Gỡ hoàn thiện',
  ORDER_PRINT: 'In phiếu mẹ',
  COST_ADD: 'Thêm chi phí',
  COST_UPDATE: 'Sửa chi phí',
  COST_DELETE: 'Xoá chi phí',
  STAGE_OPEN: 'Mở khâu cho thợ nhận',
  STAGE_CANCEL_OPEN: 'Huỷ mở khâu',
  STAGE_CLAIM: 'Thợ nhận phiếu',
  STAGE_UNCLAIM: 'Gỡ lượt nhận',
  STAGE_HANDOVER: 'Giao khâu cho thợ',
  STAGE_HANDOVER_EDIT: 'Sửa thông tin giao',
  STAGE_SUBMIT: 'Thợ báo làm xong',
  STAGE_UNSUBMIT: 'Gỡ báo làm xong',
  STAGE_RETURN: 'KCS nhận lại',
  STAGE_UNDO_RETURN: 'Gỡ KCS nhận lại',
  STAGE_LABOR: 'Sửa tiền công khâu',
  TICKET_SPLIT: 'Chia phiếu con',
  TICKET_CREATE: 'Thêm phiếu con',
  TICKET_UPDATE: 'Sửa phiếu con',
  TICKET_DELETE: 'Xoá phiếu con',
  TICKET_CLEAR_SPLIT: 'Huỷ chia phiếu con',
  /** Luồng cũ đã bỏ — nhật ký cũ vẫn còn dòng này. */
  TICKET_TOP_UP: 'Cấp thêm (luồng cũ)',
  MATERIAL_REQUEST: 'Thợ xin xuất NVL',
  MATERIAL_CANCEL: 'Thợ huỷ yêu cầu xuất',
  MATERIAL_ISSUE: 'Xuất NVL cho thợ',
  MATERIAL_REJECT: 'Không xuất NVL',
  TICKET_OUTCOME: 'Chốt kết cục phiếu con',
  TICKET_CLEAR_OUTCOME: 'Gỡ kết cục phiếu con',
  TICKET_PRINT: 'In phiếu con',
}

/** Nhãn tiếng Việt cho các trường hay gặp trong giá trị trước / sau. */
const FIELD_LABEL: Record<string, string> = {
  status: 'Trạng thái',
  qty: 'SL',
  silverWeight: 'Gram bạc',
  note: 'Ghi chú',
  name: 'Tên',
  amount: 'Số tiền',
  attempt: 'Lần',
  craftsmanName: 'Thợ',
  handedByName: 'Người giao',
  handedAt: 'Giờ giao',
  handedQty: 'SL giao',
  handedSilverWeight: 'TL giao (g)',
  handedStoneCount: 'Đá giao (viên)',
  handedStoneWeight: 'Đá giao (g)',
  submittedByName: 'Người báo xong',
  submittedAt: 'Giờ báo xong',
  returnedByName: 'KCS',
  returnedAt: 'Giờ nhận lại',
  returnedQty: 'SL nhận lại',
  returnedSilverWeight: 'TL nhận lại (g)',
  stoneCount: 'Đá gắn (viên)',
  stoneWeight: 'Đá gắn (g)',
  returnedStoneCount: 'Đá trả lại (viên)',
  btpRecoveredWeight: 'BTP thu hồi (g)',
  silverRecoveredWeight: 'Bạc thu hồi (g)',
  laborCost: 'Tiền công',
  pendingByName: 'Người mở khâu',
  pendingAt: 'Giờ mở khâu',
  claimedByName: 'Thợ đã nhận',
  claimedAt: 'Giờ nhận',
  outcome: 'Kết cục',
  outcomeQty: 'SL chốt',
  sku: 'Mã',
  unit: 'Đơn vị',
  castingSentDate: 'Ngày báo Đúc',
  castingReturnedDate: 'Ngày Đúc về',
  finishedAt: 'Giờ hoàn thiện',
}

/**
 * Trước / sau → các dòng hiển thị. Có cả hai (sửa) thì chỉ hiện trường đổi dạng "cũ → mới";
 * chỉ có trước (xoá / gỡ) hoặc chỉ có sau (tạo mới) thì liệt kê các trường có giá trị. Mảng
 * (vd chia nhiều phiếu con) hiện gọn từng phần tử.
 */
export function describeChanges(before: unknown, after: unknown): string[] {
  if (Array.isArray(after) || Array.isArray(before)) {
    const list = (Array.isArray(after) ? after : before) as unknown[]
    return list.map((item) => formatObject(item))
  }
  const b = asRecord(before)
  const a = asRecord(after)
  const hasBefore = Object.keys(b).length > 0
  const hasAfter = Object.keys(a).length > 0
  if (hasBefore && hasAfter) {
    return Object.keys(a)
      .filter((key) => JSON.stringify(b[key] ?? null) !== JSON.stringify(a[key] ?? null))
      .map((key) => `${FIELD_LABEL[key] ?? key}: ${formatValue(b[key])} → ${formatValue(a[key])}`)
  }
  const only = hasAfter ? a : b
  return Object.entries(only)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${FIELD_LABEL[key] ?? key}: ${formatValue(value)}`)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function formatObject(value: unknown) {
  const record = asRecord(value)
  return Object.entries(record)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${FIELD_LABEL[k] ?? k} ${formatValue(v)}`)
    .join(' · ')
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value)
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  if (typeof value === 'object') return formatObject(value)
  return String(value)
}
