import type {
  ProductionRequestType,
  ProductionSource,
  ProductionStatus,
  StageCode,
  SubTicketState,
} from '../api/productionOrders'

type ChipTone = { label: string; bg: string; fg: string }

/** Màu bám theo view Lark Base "Đơn Sản xuất" để người dùng nhận ra ngay. */
export const STATUS_META: Record<ProductionStatus, ChipTone> = {
  NEW: { label: 'Mới', bg: '#e8eaed', fg: '#34495e' },
  REDO_3D: { label: 'Sửa 3D', bg: '#f39c12', fg: '#ffffff' },
  CASTING: { label: 'Đúc', bg: '#8e44ad', fg: '#ffffff' },
  FILING: { label: 'Nguội', bg: '#6c5ce7', fg: '#ffffff' },
  STONE_SETTING: { label: 'Vào đá', bg: '#00897b', fg: '#ffffff' },
  ENGRAVING: { label: 'Khắc', bg: '#5d6d7e', fg: '#ffffff' },
  POLISHING: { label: 'Bóng', bg: '#0097a7', fg: '#ffffff' },
  PLATING: { label: 'Xi', bg: '#c2185b', fg: '#ffffff' },
  DEFECT: { label: 'Sản xuất lỗi', bg: '#2d3436', fg: '#ffffff' },
  FINISHING: { label: 'Hoàn thiện', bg: '#27ae60', fg: '#ffffff' },
  DELIVERED: { label: 'Đã giao', bg: '#2563eb', fg: '#ffffff' },
}

/** Thứ tự tab trên danh sách đơn — theo luồng sản xuất. */
export const STATUS_TABS: ProductionStatus[] = [
  'NEW',
  'REDO_3D',
  'CASTING',
  'FILING',
  'STONE_SETTING',
  'ENGRAVING',
  'POLISHING',
  'PLATING',
  'DEFECT',
  'FINISHING',
  'DELIVERED',
]

/** Khâu giao thợ trên phiếu (Đúc nằm ở đầu phiếu, không phải cột). */
export const STAGES: StageCode[] = ['FILING', 'STONE_SETTING', 'ENGRAVING', 'POLISHING', 'PLATING']

export const STAGE_LABEL: Record<StageCode, string> = {
  FILING: 'Nguội',
  STONE_SETTING: 'Vào đá',
  ENGRAVING: 'Khắc',
  POLISHING: 'Đánh bóng',
  PLATING: 'Xi',
}

/** Trạng thái đơn đang nằm ở một khâu trên phiếu; ngoài các trạng thái này thì được làm lại từ khâu bất kỳ. */
const IN_STAGE_STATUSES: ProductionStatus[] = [
  'FILING',
  'STONE_SETTING',
  'ENGRAVING',
  'POLISHING',
  'PLATING',
]

/**
 * Trạng thái đổi tay trên trang chi tiết. Đúc đổi qua "Báo Đúc", các khâu đổi khi giao thợ,
 * Đã giao đổi khi lập phiếu xuất hàng đủ số lượng.
 */
export const MANUAL_STATUSES: ProductionStatus[] = ['NEW', 'REDO_3D', 'DEFECT']

/** Đơn NVL làm từ đầu; Đơn BTP lấy BTP có sẵn theo mã, bỏ 3D + Đúc. */
export const SOURCES: ProductionSource[] = ['NVL', 'BTP']

export const SOURCE_META: Record<ProductionSource, ChipTone> = {
  NVL: { label: 'Đơn NVL', bg: '#eef2f7', fg: '#34495e' },
  BTP: { label: 'Đơn BTP', bg: '#fdebd0', fg: '#935116' },
}

/** Mô tả ngắn từng loại đơn — dùng trên menu "Lên đơn" và dưới ô Loại đơn. */
export const SOURCE_HINT: Record<ProductionSource, string> = {
  NVL: 'Làm từ NVL: 3D → Đúc → các khâu',
  BTP: 'Lấy BTP có sẵn — tự xuất kho BTP, bỏ 3D và Đúc',
}

export const REQUEST_TYPE_META: Record<ProductionRequestType, ChipTone> = {
  SAMPLE: { label: 'Dựng mẫu', bg: '#27ae60', fg: '#ffffff' },
  RETAIL: { label: 'Đơn khách lẻ', bg: '#2563eb', fg: '#ffffff' },
  BULK: { label: 'SX SLL', bg: '#c0392b', fg: '#ffffff' },
}

export const REQUEST_TYPES: ProductionRequestType[] = ['SAMPLE', 'RETAIL', 'BULK']

/**
 * Ngưỡng cảnh báo hao hụt bạc của một khâu (%). Đổi hai số này là đổi màu ở cả phiếu trên
 * màn hình, phiếu in lẫn hộp thoại KCS nhận lại.
 */
export const SILVER_LOSS_LIMITS = { ok: 2, warn: 5 }

export type SilverLossLevel = 'ok' | 'warn' | 'high'

export const SILVER_LOSS_TONE: Record<SilverLossLevel, { bg: string; fg: string }> = {
  ok: { bg: '#e9f7ef', fg: '#1e7e34' },
  warn: { bg: '#fff4d6', fg: '#8a6100' },
  high: { bg: '#fdecea', fg: '#b3261e' },
}

/** Hao hụt âm = nhận lại nhiều hơn giao, coi như bất thường (đỏ) để KCS cân lại. */
export function silverLossLevel(percent: string | null | undefined): SilverLossLevel | null {
  if (percent == null || percent === '') return null
  const value = Number(percent)
  if (!Number.isFinite(value)) return null
  if (value < 0) return 'high'
  if (value <= SILVER_LOSS_LIMITS.ok) return 'ok'
  if (value <= SILVER_LOSS_LIMITS.warn) return 'warn'
  return 'high'
}

export function isInStage(status: ProductionStatus) {
  return IN_STAGE_STATUSES.includes(status)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Ngày giờ gọn cho ô hẹp (bảng khâu, phiếu in): 14/09 16:32. Dùng chung để phiếu và màn hình khớp nhau. */
export function formatDateShort(value: string | null | undefined, empty = '—') {
  if (!value) return empty
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** ISO → giá trị cho `<input type="datetime-local">` theo giờ máy. */
export function toDateTimeInput(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/** Giá trị `datetime-local` (giờ máy) → ISO gửi lên API. */
export function fromDateTimeInput(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Link QR trên phiếu thợ: mở thẳng khung Sản xuất để thợ / KCS cập nhật khâu ngay. */
export function orderTicketUrl(code: string) {
  return `${window.location.origin}/orders/${code}?tab=production`
}

/** Link QR trên phiếu con: thợ quét để mở phiếu và bấm nhận. */
export function subTicketUrl(ticketCode: string) {
  return `${window.location.origin}/tickets/${ticketCode}`
}

/** Trạng thái phiếu con trong khâu hiện tại. */
export const SUB_TICKET_STATE_META: Record<SubTicketState, ChipTone> = {
  IDLE: { label: 'Chờ mở khâu', bg: '#e8eaed', fg: '#34495e' },
  WAITING: { label: 'Chờ thợ nhận', bg: '#fff4d6', fg: '#8a6100' },
  CLAIMED: { label: 'Thợ đã nhận', bg: '#e3f2fd', fg: '#1565c0' },
  WORKING: { label: 'Đang làm', bg: '#6c5ce7', fg: '#ffffff' },
  SUBMITTED: { label: 'Chờ KCS cân lại', bg: '#fff4d6', fg: '#8a6100' },
  DEFECT: { label: 'Lỗi', bg: '#fdecea', fg: '#b3261e' },
  FINISH: { label: 'Hoàn thiện', bg: '#e6f4ea', fg: '#1e7a3c' },
}
