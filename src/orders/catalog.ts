import type {
  ProductionRequestType,
  ProductionSource,
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

/** Thứ tự tab trên danh sách đơn. Bỏ Mới / Sửa 3D — Đơn BTP không qua 3D. */
export const STATUS_TABS: ProductionStatus[] = [
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

/** Đơn NVL làm từ đầu; Đơn BTP lấy BTP có sẵn theo mã, bỏ 3D + Đúc. */
export const SOURCES: ProductionSource[] = ['NVL', 'BTP']

export const SOURCE_META: Record<ProductionSource, ChipTone> = {
  NVL: { label: 'Đơn NVL', bg: '#eef2f7', fg: '#34495e' },
  BTP: { label: 'Đơn BTP', bg: '#fdebd0', fg: '#935116' },
}

/** Mô tả ngắn từng loại đơn — dùng trên menu "Lên đơn" và dưới ô Loại đơn. */
export const SOURCE_HINT: Record<ProductionSource, string> = {
  NVL: 'Làm từ NVL: 3D → Đúc → các khâu',
  BTP: 'Lấy BTP có sẵn — tự xuất kho BTP và NVL, bỏ 3D và Đúc',
}

export const REQUEST_TYPE_META: Record<ProductionRequestType, ChipTone> = {
  SAMPLE: { label: 'Dựng mẫu', bg: '#27ae60', fg: '#ffffff' },
  RETAIL: { label: 'Đơn khách lẻ', bg: '#2563eb', fg: '#ffffff' },
  BULK: { label: 'SX SLL', bg: '#c0392b', fg: '#ffffff' },
}

export const REQUEST_TYPES: ProductionRequestType[] = ['SAMPLE', 'RETAIL', 'BULK']

/** Màu xi trên đơn sản xuất — chọn một, không gõ tự do. */
export const PLATING_COLORS = [
  'Xi vàng trắng',
  'Xi vàng vàng',
  'Xi vàng hồng',
  'Xi bạc',
  'Xi đen',
] as const

export type PlatingColor = (typeof PLATING_COLORS)[number]

const PLATING_COLOR_ALIASES: Record<string, PlatingColor> = {
  trắng: 'Xi vàng trắng',
  trang: 'Xi vàng trắng',
  'vàng trắng': 'Xi vàng trắng',
  'vang trắng': 'Xi vàng trắng',
  'vang trang': 'Xi vàng trắng',
  'xi trắng': 'Xi vàng trắng',
  'xi trang': 'Xi vàng trắng',
  vàng: 'Xi vàng vàng',
  vang: 'Xi vàng vàng',
  'vàng vàng': 'Xi vàng vàng',
  'vang vang': 'Xi vàng vàng',
  'xi vàng': 'Xi vàng vàng',
  'xi vang': 'Xi vàng vàng',
  'vàng hồng': 'Xi vàng hồng',
  'vang hong': 'Xi vàng hồng',
  'vang hồng': 'Xi vàng hồng',
  'xi vàng hồng': 'Xi vàng hồng',
  bạc: 'Xi bạc',
  bac: 'Xi bạc',
  'xi bạc': 'Xi bạc',
  'xi bac': 'Xi bạc',
  đen: 'Xi đen',
  den: 'Xi đen',
  'xi đen': 'Xi đen',
  'xi den': 'Xi đen',
}

/** Đưa tên cũ trên kho (Trắng, Vàng…) về đúng 5 màu trên form. */
export function normalizePlatingColor(value: string | null | undefined) {
  const raw = value?.trim() ?? ''
  if (!raw) return ''
  const folded = raw.toLocaleLowerCase('vi').replace(/\s+/g, ' ')
  const exact = PLATING_COLORS.find((color) => color.toLocaleLowerCase('vi') === folded)
  if (exact) return exact
  return PLATING_COLOR_ALIASES[folded] ?? raw
}

export function platingColorOptions(current?: string) {
  const options = PLATING_COLORS.map((value) => ({ value, label: value }))
  const extra = current?.trim()
  if (extra && !options.some((option) => option.value === extra)) {
    options.push({ value: extra, label: extra })
  }
  return options
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

export function orderTicketUrl(code: string) {
  return `${window.location.origin}/orders/${code}`
}
