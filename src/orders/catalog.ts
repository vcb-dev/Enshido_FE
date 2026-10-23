import type {
  ProductionOrderDetail,
  ProductionRequestType,
  ReworkChainItem,
  ProductionSource,
  ProductionStatus,
  StageCode,
  SubTicketState,
} from '../api/productionOrders'
import { INTAKE_STATUS_META } from '../intake/catalog'

type ChipTone = { label: string; bg: string; fg: string }

/** Màu bám theo view Lark Base "Đơn Sản xuất" để người dùng nhận ra ngay. */
export const STATUS_META: Record<ProductionStatus, ChipTone> = {
  PENDING_APPROVAL: INTAKE_STATUS_META.PENDING_APPROVAL,
  REJECTED: INTAKE_STATUS_META.REJECTED,
  APPROVED: INTAKE_STATUS_META.APPROVED,
  READY_FOR_PRODUCTION: INTAKE_STATUS_META.READY_FOR_PRODUCTION,
  WAX_PRINTED: INTAKE_STATUS_META.WAX_PRINTED,
  PENDING_WAREHOUSE_CONFIRMATION: INTAKE_STATUS_META.PENDING_WAREHOUSE_CONFIRMATION,
  WAX_CONFIRMED: INTAKE_STATUS_META.WAX_CONFIRMED,
  WAIT_CASTING: INTAKE_STATUS_META.WAIT_CASTING,
  CAST_PENDING_CONFIRMATION: INTAKE_STATUS_META.CAST_PENDING_CONFIRMATION,
  CAST_DONE: INTAKE_STATUS_META.CAST_DONE,

  NEW: { label: 'Mới', bg: '#eee8df', fg: '#4a3d2f' },
  REDO_3D: { label: 'Sửa 3D', bg: '#f39c12', fg: '#ffffff' },
  CASTING: { label: 'Đúc', bg: '#8e44ad', fg: '#ffffff' },
  // Cùng màu với chip "Chờ nguội" ở màn lên đơn — cùng một trạng thái nhìn từ hai màn.
  WAIT_FILING: INTAKE_STATUS_META.WAIT_COOLING,
  FILING: { label: 'Đang nguội', bg: '#6c5ce7', fg: '#ffffff' },
  FILING_DEFECT: { label: 'Lỗi nguội', bg: '#d63031', fg: '#ffffff' },
  WAIT_STONE: { label: 'Chờ vào đá', bg: '#55c1b5', fg: '#06302c' },
  STONE_SETTING: { label: 'Đang vào đá', bg: '#00897b', fg: '#ffffff' },
  STONE_DEFECT: { label: 'Lỗi vào đá', bg: '#b71c1c', fg: '#ffffff' },
  WAIT_ENGRAVING: { label: 'Chờ khắc', bg: '#a89a8a', fg: '#2b241c' },
  ENGRAVING: { label: 'Đang khắc', bg: '#6f6254', fg: '#ffffff' },
  WAIT_POLISHING: { label: 'Chờ đánh bóng', bg: '#9fdbe2', fg: '#06363c' },
  POLISHING: { label: 'Đang đánh bóng', bg: '#0097a7', fg: '#ffffff' },
  WAIT_PLATING: { label: 'Chờ xi', bg: '#f3b6cf', fg: '#5b0c2c' },
  PLATING: { label: 'Đang xi', bg: '#c2185b', fg: '#ffffff' },
  // U: đã có phiếu nhập kho thành phẩm, chờ thủ kho xác nhận; V: kho đã nhận đủ.
  PLATED: { label: 'Đã xi xong', bg: '#a9dfbf', fg: '#145a32' },
  DEFECT: { label: 'Sản xuất lỗi', bg: '#2d3436', fg: '#ffffff' },
  FINISHING: { label: 'Sản xuất xong', bg: '#27ae60', fg: '#ffffff' },
  DELIVERED: { label: 'Đã giao', bg: '#2563eb', fg: '#ffffff' },
}

/** Thứ tự tab trên danh sách đơn. Bỏ Mới / Sửa 3D — Đơn BTP không qua 3D. */
export const STATUS_TABS: ProductionStatus[] = [
  'CASTING',
  'WAIT_FILING',
  'FILING',
  'FILING_DEFECT',
  'WAIT_STONE',
  'STONE_SETTING',
  'STONE_DEFECT',
  'WAIT_ENGRAVING',
  'ENGRAVING',
  'WAIT_POLISHING',
  'POLISHING',
  'WAIT_PLATING',
  'PLATING',
  'PLATED',
  'DEFECT',
  'FINISHING',
  'DELIVERED',
]

/** Khâu giao thợ trên phiếu (Đúc nằm ở đầu phiếu, không phải cột). */
export const STAGES: StageCode[] = ['FILING', 'STONE_SETTING', 'ENGRAVING', 'POLISHING', 'PLATING']

/** Khâu cuối trên phiếu (Xi) — chốt Hoàn thiện phải qua khâu này. */
export const LAST_STAGE: StageCode = STAGES[STAGES.length - 1]

/**
 * Phiếu đã đi hết đến khâu cuối chưa: khâu gần nhất phải là Xi và đã được QC nhận lại. Chưa
 * tới thì chưa chốt Hoàn thiện được — khâu giữa bỏ qua được, nhưng sửa lại khâu nào sau khi đã
 * xi thì phải xi lại mới chốt. Cùng luật với BE.
 */
export function lastStageDone(entries: Array<{ stage: StageCode; returnedAt: string | null }>) {
  const last = entries.at(-1)
  return last?.stage === LAST_STAGE && last.returnedAt != null
}

export const STAGE_LABEL: Record<StageCode, string> = {
  FILING: 'Nguội',
  STONE_SETTING: 'Vào đá',
  ENGRAVING: 'Khắc',
  POLISHING: 'Đánh bóng',
  PLATING: 'Xi',
}

/**
 * Lệnh bù của một phiếu (phiếu con `ticketNo`, null = phiếu mẹ), gồm cả lệnh bù tiếp cho lệnh bù
 * lại lỗi. Bản chi tiết cũ chưa có `reworkChain` thì chỉ có lệnh bù trực tiếp.
 */
export function ticketReworks(
  order: Pick<ProductionOrderDetail, 'reworks' | 'reworkChain'>,
  ticketNo: number | null,
): ReworkChainItem[] {
  if (order.reworkChain) return order.reworkChain.filter((item) => (item.rootTicketNo ?? null) === ticketNo)
  return (order.reworks ?? []).filter((item) => item.ticketNo === ticketNo)
}

/**
 * Cả đơn đã chốt xong sản xuất: có phiếu nhập kho thành phẩm và không còn phiếu con nào đang
 * chạy. Đơn chia phiếu con thì phiếu đạt đầu tiên đã sinh phiếu nhập kho — các phiếu còn lại vẫn
 * làm tiếp. Cùng luật với `assertOrderActive` ở BE.
 */
export function productionClosed(order: Pick<ProductionOrderDetail, 'finishedGoods' | 'subTickets'>) {
  return order.finishedGoods != null && order.subTickets.every((ticket) => ticket.outcome != null)
}

/** Khắc: QC chỉ chụp ảnh xác nhận, không cân — hao hụt Khắc tính gộp ở Đánh bóng. Cùng luật với BE. */
export const PHOTO_ONLY_STAGES: StageCode[] = ['ENGRAVING']

/** Đánh bóng / Xi: không qua thủ kho nhưng QC vẫn tách hàng lỗi / S925 / S999 thu hồi — nhập kho NVL lúc QC lưu. Cùng luật với BE. */
export const QC_STOCK_RECOVERY_STAGES: StageCode[] = ['POLISHING', 'PLATING']

/** Nhãn nút QC nhận lại một khâu: khâu chỉ chụp ảnh thì "QC xác nhận", còn lại "QC cân lại". */
export function qcReturnLabel(stage: StageCode | null, defectReported: boolean) {
  const photoOnly = stage != null && PHOTO_ONLY_STAGES.includes(stage)
  if (defectReported) return photoOnly ? 'QC xác nhận hàng lỗi' : 'QC cân hàng lỗi'
  return photoOnly ? 'QC xác nhận' : 'QC cân lại'
}

/** Trạng thái đơn đang nằm ở một khâu trên phiếu; ngoài các trạng thái này thì được làm lại từ khâu bất kỳ. */
const IN_STAGE_STATUSES: ProductionStatus[] = [
  'WAIT_FILING',
  'FILING',
  'WAIT_STONE',
  'STONE_SETTING',
  'WAIT_ENGRAVING',
  'ENGRAVING',
  'WAIT_POLISHING',
  'POLISHING',
  'WAIT_PLATING',
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
  NVL: { label: 'Đơn NVL', bg: '#f5eee3', fg: '#4a3d2f' },
  BTP: { label: 'Đơn BTP', bg: '#fdebd0', fg: '#935116' },
}

/** Mô tả ngắn từng loại đơn — dùng trên menu "Lên đơn" và dưới ô Loại đơn. */
export const SOURCE_HINT: Record<ProductionSource, string> = {
  NVL: 'Làm từ đầu: 3D → Đúc → các khâu',
  BTP: 'Từ phôi BTP có sẵn, vào thẳng Nguội',
}

export const REQUEST_TYPE_META: Record<ProductionRequestType, ChipTone> = {
  SAMPLE: { label: 'Dựng mẫu', bg: '#27ae60', fg: '#ffffff' },
  RETAIL: { label: 'Đơn khách lẻ', bg: '#2563eb', fg: '#ffffff' },
  BULK: { label: 'SX SLL', bg: '#c0392b', fg: '#ffffff' },
}

export const REQUEST_TYPES: ProductionRequestType[] = ['SAMPLE', 'RETAIL', 'BULK']

/**
 * Ngưỡng cảnh báo hao hụt bạc của một khâu (%). Đổi hai số này là đổi màu ở cả phiếu trên
 * màn hình, phiếu in lẫn hộp thoại QC nhận lại.
 */
export const SILVER_LOSS_LIMITS = { ok: 2, warn: 5 }

export type SilverLossLevel = 'ok' | 'warn' | 'high'

export const SILVER_LOSS_TONE: Record<SilverLossLevel, { bg: string; fg: string }> = {
  ok: { bg: '#e9f7ef', fg: '#1e7e34' },
  warn: { bg: '#fff4d6', fg: '#8a6100' },
  high: { bg: '#fdecea', fg: '#b3261e' },
}

/** Hao hụt âm = nhận lại nhiều hơn giao, coi như bất thường (đỏ) để QC cân lại. */
export function silverLossLevel(percent: string | null | undefined): SilverLossLevel | null {
  if (percent == null || percent === '') return null
  const value = Number(percent)
  if (!Number.isFinite(value)) return null
  if (value < 0) return 'high'
  if (value <= SILVER_LOSS_LIMITS.ok) return 'ok'
  if (value <= SILVER_LOSS_LIMITS.warn) return 'warn'
  return 'high'
}

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
  // Màu cũ trên kho không nằm trong 5 màu chuẩn vẫn phải hiện được nên nới kiểu về string.
  const options: Array<{ value: string; label: string }> = PLATING_COLORS.map((value) => ({
    value,
    label: value,
  }))
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

/** Ngày đủ ngày/tháng/năm — cột ngày tạo, hạn trả trên danh sách đơn. */
export function formatDate(value: string | null | undefined, empty = '—') {
  if (!value) return empty
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** Ngày giờ gọn cho ô hẹp (bảng khâu, phiếu in): 14/09 16:32. Dùng chung để phiếu và màn hình khớp nhau. */
export function formatDateShort(value: string | null | undefined, empty = '—') {
  if (!value) return empty
  // Ngày thuần `YYYY-MM-DD` không có giờ — đừng parse UTC midnight (ra 07:00 VN).
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, month, day] = value.split('-')
    return `${day}/${month}`
  }
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

/** Link QR trên phiếu thợ: mở thẳng khung Sản xuất để thợ / QC cập nhật khâu ngay. */
export function orderTicketUrl(code: string) {
  return `${window.location.origin}/orders/${code}?tab=production`
}

/** Phiếu mẹ không chia: dùng đúng màn tự nhận của thợ như phiếu con. */
export function parentWorkTicketUrl(code: string) {
  return `${window.location.origin}/tickets/${code}`
}

/** Link QR trên phiếu con: thợ quét để mở phiếu và bấm nhận. */
export function subTicketUrl(ticketCode: string) {
  return `${window.location.origin}/tickets/${ticketCode}`
}

/** Khâu được báo lỗi (nút Báo lỗi, QC nhận lại 0 sp chốt Lỗi). Khắc / Xi không báo lỗi. */
export function canReportStageDefect(stage: string | null | undefined) {
  return stage === 'FILING' || stage === 'STONE_SETTING' || stage === 'POLISHING'
}

/** Nguội / Vào đá: sau QC còn bước thủ kho xác nhận nhập kho (hàng đạt, hàng lỗi, nguyên liệu thừa). */
export function isReceiptStage(stage: string | null | undefined) {
  return stage === 'FILING' || stage === 'STONE_SETTING'
}

/**
 * Đánh bóng / Xi (mô tả luồng bước 21–22): QC xác nhận khâu trước là phiếu tự mở, thợ tự chọn
 * phiếu để nhận và vào làm ngay. Các khâu khác do thủ kho chỉ định thợ.
 */
export function isSelfTakeStage(stage: string | null | undefined) {
  return stage === 'POLISHING' || stage === 'PLATING'
}

/**
 * Đơn bỏ khâu Vào đá: không khai TL đá ở khâu 3D (trống hoặc 0). Đơn cũ chỉ khai số viên vẫn tính
 * là có đá; `stoneSkipped` giữ cho đơn thủ kho đã đánh dấu trước đây. Khớp `skipsStone` phía BE.
 */
export function skipsStone(order: {
  stoneCount: number | null
  stoneWeight: string | null
  stoneSkipped?: boolean
}) {
  if (order.stoneSkipped === true) return true
  return !(Number(order.stoneWeight) > 0 || (order.stoneCount ?? 0) > 0)
}

/**
 * Phiếu đã được thủ kho chỉ định, chờ chính thợ đó bấm nhận hàng — mọi khâu. Phiếu mẹ phải có sẵn
 * nội dung giao (`receiptPrepared`); lượt nhận kiểu cũ chưa có thì thủ kho huỷ rồi giao lại.
 */
export function usesReceiptFlow(stage: string | null | undefined, no: number | null, receiptPrepared?: boolean) {
  return stage != null && (no != null || receiptPrepared === true)
}

/** Nhãn trạng thái phiếu con; phiếu được chỉ định thì CLAIMED là "Chờ thợ nhận". */
export function subTicketStateLabel(state: SubTicketState, stage?: string | null) {
  return state === 'CLAIMED' && stage != null ? 'Chờ thợ nhận' : SUB_TICKET_STATE_META[state].label
}

/** Trạng thái phiếu con trong khâu hiện tại. */
export const SUB_TICKET_STATE_META: Record<SubTicketState, ChipTone> = {
  IDLE: { label: 'Chờ mở khâu', bg: '#eee8df', fg: '#4a3d2f' },
  WAITING: { label: 'Chờ thợ nhận', bg: '#fff4d6', fg: '#8a6100' },
  CLAIMED: { label: 'Thợ đã nhận', bg: '#e3f2fd', fg: '#1565c0' },
  WORKING: { label: 'Đang làm', bg: '#6c5ce7', fg: '#ffffff' },
  SUBMITTED: { label: 'Chờ QC cân lại', bg: '#fff4d6', fg: '#8a6100' },
  CONFIRMING: { label: 'Chờ thủ kho xác nhận', bg: '#e3f2fd', fg: '#1565c0' },
  DEFECT: { label: 'Lỗi', bg: '#fdecea', fg: '#b3261e' },
  FINISH: { label: 'Hoàn thiện', bg: '#e6f4ea', fg: '#1e7a3c' },
}

/** Chữ nối sau "xác nhận" theo kết quả QC: không lỗi để trống, còn hàng đạt là lỗi một phần, đạt 0 là lỗi toàn bộ. */
export function defectScopeText(entry: { defectQty?: number | null; returnedQty?: number | null } | null | undefined) {
  if (!((entry?.defectQty ?? 0) > 0)) return ''
  return (entry?.returnedQty ?? 0) === 0 ? ' lỗi toàn bộ' : ' lỗi một phần'
}
