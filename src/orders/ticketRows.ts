import type { StageCode, StageEntry } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { formatDateShort, STAGES } from './catalog'

/** Màu nền dòng giống mẫu Excel "Phiếu sản xuất". */
export type TicketRowTone = 'handover' | 'craftsman' | 'kcs'

export type TicketRow = {
  key: string
  /** Nhãn cột đầu. `null` = dòng phụ, nhãn đã gộp từ dòng trên (rowSpan). */
  label: string | null
  /** Chú thích nghiêng sau nhãn, vd "(t - chỉ)". */
  hint?: string
  /** Nhãn phụ của dòng con: Tổng / Bạc. */
  sub?: string
  /** Số dòng nhãn gộp xuống (chỉ đặt ở dòng đầu của nhóm). */
  labelRowSpan?: number
  tone?: TicketRowTone
  /** Ô số (trọng lượng) — canh phải. */
  numeric?: boolean
  value: (entry: StageEntry) => string
}

export const TICKET_TONE_BG: Record<TicketRowTone, string> = {
  handover: '#dcf0fb',
  craftsman: '#fbeed8',
  kcs: '#dcf0fb',
}

export const TICKET_HEADER_BG = '#fff34d'

const weight = (value: string | null) => (value != null ? formatQty(value) : '')

/**
 * Các dòng của bảng "Quá trình sản xuất" — trang chi tiết và phiếu in cùng vẽ từ danh sách
 * này nên phiếu giấy và hệ thống luôn giống nhau từng ô.
 */
export const TICKET_ROWS: TicketRow[] = [
  { key: 'handedBy', label: 'Người giao', tone: 'handover', value: (e) => e.handedByName },
  { key: 'handedAt', label: 'Thời gian giao', value: (e) => formatDateShort(e.handedAt, '') },
  {
    key: 'handedTotal',
    label: 'Trọng lượng giao',
    hint: '(t - chỉ)',
    sub: 'Tổng',
    labelRowSpan: 2,
    numeric: true,
    value: (e) => weight(e.handedTotalWeight),
  },
  { key: 'handedSilver', label: null, sub: 'Bạc', numeric: true, value: (e) => weight(e.handedSilverWeight) },
  { key: 'craftsman', label: 'Người chế tác (Thợ)', tone: 'craftsman', value: (e) => e.craftsmanName },
  { key: 'kcs', label: 'Người KCS', tone: 'kcs', value: (e) => e.returnedByName ?? '' },
  { key: 'returnedAt', label: 'Thời gian nhận lại', value: (e) => formatDateShort(e.returnedAt, '') },
  {
    key: 'returnedWeight',
    label: 'Trọng lượng nhận lại',
    hint: '(t - chỉ)',
    numeric: true,
    value: (e) =>
      e.returnedAt ? `${weight(e.returnedTotalWeight) || '—'} / ${weight(e.returnedSilverWeight)}` : '',
  },
  { key: 'btp', label: 'BTP Thu hồi sau nguội', numeric: true, value: (e) => weight(e.btpRecoveredWeight) },
  { key: 'silverRecovered', label: 'Bạc S925 Thu hồi sau nguội', numeric: true, value: (e) => weight(e.silverRecoveredWeight) },
  {
    key: 'silverLoss',
    label: 'Hao hụt bạc',
    numeric: true,
    value: (e) =>
      e.silverLoss != null
        ? `${formatQty(e.silverLoss)}${e.silverLossPercent != null ? ` (${formatQty(e.silverLossPercent)}%)` : ''}`
        : '',
  },
]

/** Lần làm gần nhất của từng khâu — đúng cột đang hiện trên phiếu. Các lần trước là lịch sử làm lại. */
export function latestByStage(stages: StageEntry[]): Record<StageCode, StageEntry | undefined> {
  const result = Object.fromEntries(STAGES.map((stage) => [stage, undefined])) as Record<
    StageCode,
    StageEntry | undefined
  >
  for (const entry of stages) {
    const current = result[entry.stage]
    if (!current || entry.attempt > current.attempt) result[entry.stage] = entry
  }
  return result
}
