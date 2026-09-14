import type {
  ProductionRequestType,
  ProductionStatus,
  StageCode,
} from '../api/productionOrders'

type ChipTone = { label: string; bg: string; fg: string }

/** Màu bám theo view Lark Base "Đơn Sản xuất" để người dùng nhận ra ngay. */
export const STATUS_META: Record<ProductionStatus, ChipTone> = {
  NEW: { label: 'Mới', bg: '#e8eaed', fg: '#34495e' },
  REDO_3D: { label: 'Sửa 3D', bg: '#f39c12', fg: '#ffffff' },
  CASTING: { label: 'Đúc', bg: '#8e44ad', fg: '#ffffff' },
  FILING: { label: 'Nguội', bg: '#6c5ce7', fg: '#ffffff' },
  STONE_SETTING: { label: 'Vào đá', bg: '#00897b', fg: '#ffffff' },
  POLISH_PLATING: { label: 'Bóng xi', bg: '#0097a7', fg: '#ffffff' },
  FINISHING: { label: 'Hoàn thiện', bg: '#27ae60', fg: '#ffffff' },
  DELIVERED: { label: 'Đã giao', bg: '#2563eb', fg: '#ffffff' },
  DEFECT: { label: 'Sản xuất lỗi', bg: '#2d3436', fg: '#ffffff' },
}

/** Thứ tự tab trên danh sách đơn. */
export const STATUS_TABS: ProductionStatus[] = [
  'NEW',
  'REDO_3D',
  'CASTING',
  'FILING',
  'STONE_SETTING',
  'POLISH_PLATING',
  'FINISHING',
  'DELIVERED',
  'DEFECT',
]

/** Cột "Quá trình sản xuất" trên phiếu thợ (Đúc nằm ở đầu phiếu, không phải cột). */
export const STAGES: StageCode[] = ['FILING', 'STONE_SETTING', 'POLISH_PLATING', 'ENGRAVING', 'APPEARANCE']

export const STAGE_LABEL: Record<StageCode, string> = {
  FILING: 'Nguội',
  STONE_SETTING: 'Vào đá',
  POLISH_PLATING: 'Đánh bóng xi',
  ENGRAVING: 'Khắc',
  APPEARANCE: 'Ngoại Quan',
}

/** Trạng thái đơn đang nằm ở một khâu trên phiếu; ngoài các trạng thái này thì được làm lại từ khâu bất kỳ. */
const IN_STAGE_STATUSES: ProductionStatus[] = ['FILING', 'STONE_SETTING', 'POLISH_PLATING', 'FINISHING']

/**
 * Trạng thái đổi tay trên trang chi tiết. Đúc đổi qua "Báo Đúc", các khâu đổi khi giao thợ,
 * Đã giao đổi khi lập phiếu xuất hàng đủ số lượng.
 */
export const MANUAL_STATUSES: ProductionStatus[] = ['NEW', 'REDO_3D', 'DEFECT']

export const REQUEST_TYPE_META: Record<ProductionRequestType, ChipTone> = {
  SAMPLE: { label: 'Dựng mẫu', bg: '#27ae60', fg: '#ffffff' },
  RETAIL: { label: 'Đơn khách lẻ', bg: '#2563eb', fg: '#ffffff' },
  BULK: { label: 'SX SLL', bg: '#c0392b', fg: '#ffffff' },
}

export const REQUEST_TYPES: ProductionRequestType[] = ['SAMPLE', 'RETAIL', 'BULK']

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

export function orderTicketUrl(code: string) {
  return `${window.location.origin}/orders/${code}`
}
