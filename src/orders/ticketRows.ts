import type { ProductionOrderDetail, StageCode, StageEntry } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { formatDateShort, silverLossLevel, STAGES, STATUS_META, type SilverLossLevel } from './catalog'

/** Màu nền dòng giống mẫu Excel "Phiếu sản xuất". */
export type TicketRowTone = 'handover' | 'craftsman' | 'kcs'

export type TicketRow = {
  key: string
  /** Nhãn cột đầu. */
  label: string
  /** Chú thích nghiêng sau nhãn, vd "(t - chỉ)". */
  hint?: string
  tone?: TicketRowTone
  /** Ô số (trọng lượng) — canh phải. */
  numeric?: boolean
  value: (entry: StageEntry) => string
  /** Mức cảnh báo của ô, tô màu theo [SILVER_LOSS_TONE](./catalog.ts). */
  warnLevel?: (entry: StageEntry) => SilverLossLevel | null
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
    key: 'handedQty',
    label: 'Số lượng giao',
    numeric: true,
    value: (e) => (e.handedQty != null ? String(e.handedQty) : ''),
  },
  {
    key: 'handedSilver',
    label: 'Trọng lượng giao (bạc)',
    hint: '(t - chỉ)',
    numeric: true,
    value: (e) => weight(e.handedSilverWeight),
  },
  { key: 'craftsman', label: 'Người chế tác (Thợ)', tone: 'craftsman', value: (e) => e.craftsmanName },
  { key: 'kcs', label: 'Người KCS', tone: 'kcs', value: (e) => e.returnedByName ?? '' },
  { key: 'returnedAt', label: 'Thời gian nhận lại', value: (e) => formatDateShort(e.returnedAt, '') },
  {
    key: 'returnedQty',
    label: 'Số lượng nhận lại',
    numeric: true,
    value: (e) => (e.returnedAt && e.returnedQty != null ? String(e.returnedQty) : ''),
  },
  {
    key: 'returnedWeight',
    label: 'Trọng lượng nhận lại (bạc)',
    hint: '(t - chỉ)',
    numeric: true,
    value: (e) => (e.returnedAt ? weight(e.returnedSilverWeight) : ''),
  },
  { key: 'btp', label: 'BTP Thu hồi sau nguội', numeric: true, value: (e) => weight(e.btpRecoveredWeight) },
  { key: 'silverRecovered', label: 'Bạc S925 Thu hồi sau nguội', numeric: true, value: (e) => weight(e.silverRecoveredWeight) },
  {
    key: 'silverLoss',
    label: 'Hao hụt bạc',
    numeric: true,
    warnLevel: (e) => (e.returnedAt ? silverLossLevel(e.silverLossPercent) : null),
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

/**
 * Hai cột cuối phiếu — phiếu kết thúc ở một trong hai: hàng lỗi (kèm lý do) hoặc hàng đạt
 * và vào kho thành phẩm. Không phải khâu giao thợ nên mỗi cột chỉ là một ô gộp hết các dòng.
 */
export type TicketOutcome = 'DEFECT' | 'FINISH'

export const TICKET_OUTCOMES: TicketOutcome[] = ['DEFECT', 'FINISH']

export const TICKET_OUTCOME_LABEL: Record<TicketOutcome, string> = {
  DEFECT: 'Lỗi',
  FINISH: 'Hoàn thiện',
}

/** Nội dung ô kết cục, mỗi phần tử một dòng. Rỗng = chưa xảy ra. */
export function outcomeLines(order: ProductionOrderDetail, outcome: TicketOutcome): string[] {
  if (outcome === 'FINISH') {
    const goods = order.finishedGoods
    if (!goods) return []
    return [
      formatDateShort(goods.receivedAt),
      goods.receivedByName,
      `Vào kho: ${goods.qty}`,
    ]
  }

  // Lần ghi lỗi gần nhất — giữ lại cả khi đơn đã được làm lại, để phiếu còn dấu vết lỗi.
  const log = order.statusLogs.find((item) => item.toStatus === 'DEFECT')
  if (!log) return []
  return [
    log.fromStatus ? `Khâu ${STATUS_META[log.fromStatus].label}` : '',
    formatDateShort(log.changedAt),
    log.changedBy ?? '',
    log.note ? `Lý do: ${log.note}` : '',
  ].filter(Boolean)
}
