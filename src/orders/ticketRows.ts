import type { ProductionOrderDetail, StageCode, StageEntry, SubTicket } from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import {
  formatDateShort,
  silverLossLevel,
  STAGE_LABEL,
  STAGES,
  STATUS_META,
  type SilverLossLevel,
} from './catalog'

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
  {
    key: 'handedStoneCount',
    label: 'Số viên đá giao',
    numeric: true,
    value: (e) => (e.handedStoneCount != null ? String(e.handedStoneCount) : ''),
  },
  {
    key: 'handedStoneWeight',
    label: 'Trọng lượng đá giao',
    hint: '(g)',
    numeric: true,
    value: (e) => weight(e.handedStoneWeight),
  },
  {
    key: 'stoneCount',
    label: 'Số viên đá gắn',
    numeric: true,
    value: (e) => (e.stoneCount != null ? String(e.stoneCount) : ''),
  },
  {
    key: 'stoneWeight',
    label: 'Trọng lượng đá gắn',
    hint: '(g)',
    numeric: true,
    value: (e) => weight(e.stoneWeight),
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
    key: 'qtyLoss',
    label: 'Hao hụt số lượng',
    numeric: true,
    value: (e) => {
      if (!e.returnedAt || e.handedQty == null || e.returnedQty == null) return ''
      const lost = e.handedQty - e.returnedQty
      const percent = e.handedQty > 0 ? ((lost / e.handedQty) * 100).toFixed(2) : null
      return `${lost}${percent != null ? ` (${formatQty(percent)}%)` : ''}`
    },
  },
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

export type StageColumn = {
  /** Thứ bảng khâu vẽ: lần gần nhất, hoặc số cộng của các phiếu con. */
  entry: StageEntry | undefined
  /** Các lần giao đang hiện trong cột — phần còn lại là lịch sử làm lại. */
  entries: StageEntry[]
  /** Cột cộng từ phiếu con: bao nhiêu phiếu đã được KCS nhận lại. */
  tickets: { done: number; total: number } | null
}

/**
 * Cột khâu trên phiếu. Có `subTicketId` thì chỉ lấy khâu của phiếu con đó. Không có thì là phiếu
 * mẹ: khâu đã giao theo phiếu con được cộng lại thành một cột; khâu giao cho cả đơn (trước khi
 * chia phiếu) giữ nguyên.
 */
export function stageColumns(stages: StageEntry[], subTicketId?: string): Record<StageCode, StageColumn> {
  const scoped = subTicketId ? stages.filter((entry) => entry.subTicketId === subTicketId) : stages
  const result = {} as Record<StageCode, StageColumn>
  for (const stage of STAGES) {
    const own = scoped.filter((entry) => entry.stage === stage)
    const orderLevel = latest(own.filter((entry) => !entry.subTicketId))
    const perTicket = new Map<string, StageEntry>()
    for (const entry of own) {
      if (!entry.subTicketId) continue
      const current = perTicket.get(entry.subTicketId)
      if (!current || entry.attempt > current.attempt) perTicket.set(entry.subTicketId, entry)
    }
    const ticketEntries = Array.from(perTicket.values()).sort(
      (a, b) => (a.subTicketNo ?? 0) - (b.subTicketNo ?? 0),
    )
    const newest = ticketEntries.reduce<string>((max, entry) => (entry.handedAt > max ? entry.handedAt : max), '')
    if (ticketEntries.length === 0 || (orderLevel && orderLevel.handedAt > newest)) {
      result[stage] = { entry: orderLevel, entries: orderLevel ? [orderLevel] : [], tickets: null }
    } else if (subTicketId) {
      result[stage] = { entry: ticketEntries[0], entries: ticketEntries, tickets: null }
    } else {
      result[stage] = {
        entry: aggregateEntries(stage, ticketEntries),
        entries: ticketEntries,
        tickets: {
          done: ticketEntries.filter((entry) => entry.returnedAt).length,
          total: ticketEntries.length,
        },
      }
    }
  }
  return result
}

function latest(entries: StageEntry[]) {
  return entries.reduce<StageEntry | undefined>(
    (best, entry) => (!best || entry.attempt > best.attempt ? entry : best),
    undefined,
  )
}

/**
 * Cộng các phiếu con của một khâu thành một cột cho phiếu mẹ. Số nhận lại / thu hồi / hao hụt
 * chỉ hiện khi mọi phiếu con đã được KCS nhận lại, tránh đọc nhầm số dở dang là số cả đơn.
 */
function aggregateEntries(stage: StageCode, entries: StageEntry[]): StageEntry {
  const done = entries.every((entry) => entry.returnedAt)
  const names = (pick: (entry: StageEntry) => string | null) =>
    Array.from(new Set(entries.map(pick).filter((name): name is string => Boolean(name)))).join(', ')
  const handedSilver = sumWeights(entries.map((entry) => entry.handedSilverWeight))
  const stone = sumWeights(entries.map((entry) => entry.stoneWeight))
  const returnedSilver = sumWeights(entries.map((entry) => entry.returnedSilverWeight))
  const btp = sumWeights(entries.map((entry) => entry.btpRecoveredWeight))
  const silverRecovered = sumWeights(entries.map((entry) => entry.silverRecoveredWeight))
  const handedQty = sumCounts(entries.map((entry) => entry.handedQty))
  // Đá gắn ở khâu Vào đá nằm trong TL cân lại nên phải cộng vào vế giao, giống công thức ở BE.
  const loss =
    done && handedSilver != null && returnedSilver != null
      ? round4(
          Number(handedSilver) +
            Number(stone ?? 0) -
            Number(returnedSilver) -
            Number(btp ?? 0) -
            Number(silverRecovered ?? 0),
        )
      : null
  const lossPercent =
    loss != null && handedSilver != null && Number(handedSilver) > 0
      ? ((loss / Number(handedSilver)) * 100).toFixed(2)
      : null
  const handedAt = entries.reduce((min, entry) => (entry.handedAt < min ? entry.handedAt : min), entries[0].handedAt)
  const returnedAt = done
    ? entries.reduce((max, entry) => ((entry.returnedAt ?? '') > max ? (entry.returnedAt ?? '') : max), '')
    : null

  return {
    id: `sum-${stage}`,
    subTicketId: null,
    subTicketNo: null,
    stage,
    attempt: Math.max(...entries.map((entry) => entry.attempt)),
    handedByName: names((entry) => entry.handedByName),
    handedAt,
    handedQty,
    handedSilverWeight: handedSilver,
    handedStoneCount: sumCounts(entries.map((entry) => entry.handedStoneCount)),
    handedStoneWeight: sumWeights(entries.map((entry) => entry.handedStoneWeight)),
    stoneCount: sumCounts(entries.map((entry) => entry.stoneCount)),
    stoneWeight: stone,
    craftsmanUserId: null,
    craftsmanName: names((entry) => entry.craftsmanName),
    // Cột cộng không phải một lần nộp thật của ai — để trống thay vì gộp mốc thời gian.
    submittedAt: null,
    submittedByName: null,
    returnedByName: names((entry) => entry.returnedByName) || null,
    returnedAt,
    returnedQty: done ? sumCounts(entries.map((entry) => entry.returnedQty)) : null,
    returnedSilverWeight: done ? returnedSilver : null,
    btpRecoveredWeight: done ? btp : null,
    silverRecoveredWeight: done ? silverRecovered : null,
    silverLoss: loss != null ? String(loss) : null,
    silverLossPercent: lossPercent,
    laborCost: sumWeights(entries.map((entry) => entry.laborCost)),
    note: null,
  }
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

function sumWeights(values: Array<string | null>) {
  const present = values.filter((value): value is string => value != null)
  if (present.length === 0) return null
  return String(round4(present.reduce((total, value) => total + Number(value), 0)))
}

function sumCounts(values: Array<number | null>) {
  const present = values.filter((value): value is number => value != null)
  return present.length ? present.reduce((total, value) => total + value, 0) : null
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

/**
 * Nội dung ô kết cục, mỗi phần tử một dòng. Rỗng = chưa xảy ra.
 * Có `ticket` thì đọc kết cục của riêng phiếu con đó; không thì đọc kết cục cả đơn.
 */
export function outcomeLines(
  order: ProductionOrderDetail,
  outcome: TicketOutcome,
  ticket?: SubTicket,
): string[] {
  if (ticket) {
    if (ticket.outcome !== outcome) return []
    return [
      outcome === 'DEFECT' && ticket.outcomeStage ? `Khâu ${STAGE_LABEL[ticket.outcomeStage]}` : '',
      formatDateShort(ticket.outcomeAt, ''),
      ticket.outcomeByName ?? '',
      outcome === 'FINISH' && ticket.outcomeQty != null ? `Vào kho: ${ticket.outcomeQty}` : '',
      ticket.outcomeNote ? `Lý do: ${ticket.outcomeNote}` : '',
    ].filter(Boolean)
  }

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
