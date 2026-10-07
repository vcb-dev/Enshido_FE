import { gramToCt } from '../api/inventory'
import { formatDateTime } from './catalog'

/** Nhãn cho mã thao tác BE ghi (`ACTIVITY` trong activity-log.ts). Mã lạ thì hiện nguyên mã. */
export const ACTION_LABEL: Record<string, string> = {
  ORDER_CREATE: 'Lên đơn',
  ORDER_UPDATE: 'Sửa đơn',
  ORDER_DELETE: 'Xoá đơn',
  ORDER_STATUS: 'Đổi trạng thái',
  ORDER_CASTING: 'Báo Đúc / Đúc về',
  ORDER_CUT: 'Cắt cây thông · nhận phôi',
  ORDER_UNDO_CUT: 'Xoá phiếu cắt cây (luồng cũ)',
  ORDER_FINISH: 'Hoàn thiện đơn',
  ORDER_UNDO_FINISH: 'Gỡ hoàn thiện',
  ORDER_PRINT: 'In phiếu mẹ',
  COST_ADD: 'Thêm chi phí',
  COST_UPDATE: 'Sửa chi phí',
  COST_DELETE: 'Xoá chi phí',
  STAGE_OPEN: 'Chỉ định thợ',
  STAGE_CANCEL_OPEN: 'Huỷ mở khâu',
  STAGE_CLAIM: 'Thợ nhận phiếu (luồng cũ)',
  STAGE_UNCLAIM: 'Gỡ lượt nhận',
  STAGE_HANDOVER: 'Giao khâu cho thợ',
  STAGE_HANDOVER_EDIT: 'Sửa thông tin giao',
  STAGE_SUBMIT: 'Thợ báo làm xong',
  STAGE_UNSUBMIT: 'Gỡ báo làm xong',
  STAGE_RETURN: 'QC nhận lại',
  STAGE_UNDO_RETURN: 'Gỡ QC nhận lại',
  STAGE_DEFECT: 'Báo lỗi khâu',
  STAGE_CLEAR_DEFECT: 'Bỏ báo lỗi khâu',
  STAGE_CONFIRM: 'Xác nhận nhập kho',
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
  STONE_RETURN_EARLY: 'Thợ trả lại túi đá cho thủ kho giữa khâu',
  STONE_SKIP: 'Đánh dấu đơn không có đá',
  STONE_UNSKIP: 'Bỏ đánh dấu không có đá',
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
  handedStoneWeight: 'Đá giao (ct)',
  submittedByName: 'Người báo xong',
  submittedAt: 'Giờ báo xong',
  returnedByName: 'QC',
  returnedAt: 'Giờ nhận lại',
  returnedQty: 'SL sản phẩm đạt',
  returnedSilverWeight: 'TL sản phẩm đạt (g)',
  stoneCount: 'Đá gắn (viên)',
  stoneWeight: 'Đá gắn (ct)',
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
  cutCode: 'Phiếu cắt',
  cutAt: 'Giờ cắt',
  weight: 'TL (g)',
  finishedAt: 'Giờ hoàn thiện',
  goodQty: 'Hàng đạt (sp)',
  goodWeight: 'TL hàng đạt (g)',
  defectQty: 'Hàng lỗi (sp)',
  scrapS999Weight: 'S999 thừa (g)',
  stockInboundCount: 'Số phiếu nhập kho',
  stockInboundIds: 'Phiếu nhập kho',
  acceptedBy: 'Thợ nhận hàng',
  heldStoneCount: 'Đá giữ chỗ (viên)',
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
      .map((key) => `${FIELD_LABEL[key] ?? key}: ${fieldValue(key, b[key])} → ${fieldValue(key, a[key])}`)
  }
  const only = hasAfter ? a : b
  return Object.entries(only)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${FIELD_LABEL[key] ?? key}: ${fieldValue(key, value)}`)
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
    .map(([k, v]) => `${FIELD_LABEL[k] ?? k} ${fieldValue(k, v)}`)
    .join(' · ')
}

/** TL đá trong nhật ký lưu theo g — hiện theo ct cho khớp ô nhập. */
const CARAT_FIELDS = new Set(['handedStoneWeight', 'stoneWeight'])

function fieldValue(key: string, value: unknown) {
  if (CARAT_FIELDS.has(key) && value != null && value !== '' && Number.isFinite(Number(value))) {
    return gramToCt(String(value))
  }
  return formatValue(value)
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value)
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  if (typeof value === 'object') return formatObject(value)
  return String(value)
}
