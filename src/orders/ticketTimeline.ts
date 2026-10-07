import type { ProductionStatus, StageCode, StageEntry, StatusLog, SubTicket } from '../api/productionOrders'
import { STAGE_LABEL, STATUS_META } from './catalog'

/** Một dòng trên quy trình của phiếu con. */
export type TicketTimelineRow = {
  key: string
  /** null = bước trung gian không phải trạng thái (chờ QC, chờ thủ kho…). */
  status: ProductionStatus | null
  label: string
  at: string | null
  by: string | null
  note?: string | null
}

/**
 * Trạng thái chỉ có nghĩa trên từng phiếu con khi đơn đã chia. Nhật ký trạng thái của cả đơn
 * chỉ ghi phiếu đi xa nhất nên không dùng để nói phiếu khác đang ở đâu.
 */
export const TICKET_PHASE_STATUSES: ProductionStatus[] = [
  'FILING',
  'FILING_DEFECT',
  'WAIT_STONE',
  'STONE_SETTING',
  'STONE_DEFECT',
  'WAIT_ENGRAVING',
  'ENGRAVING',
  'POLISHING',
  'PLATING',
]

const WORKING: Record<StageCode, ProductionStatus> = {
  FILING: 'FILING',
  STONE_SETTING: 'STONE_SETTING',
  ENGRAVING: 'ENGRAVING',
  POLISHING: 'POLISHING',
  PLATING: 'PLATING',
}

/** Trạng thái phiếu chờ vào khâu — khâu không có trạng thái "Chờ" riêng thì giữ trạng thái khâu. */
const WAITING: Record<StageCode, ProductionStatus> = {
  FILING: 'WAIT_FILING',
  STONE_SETTING: 'WAIT_STONE',
  ENGRAVING: 'WAIT_ENGRAVING',
  POLISHING: 'POLISHING',
  PLATING: 'PLATING',
}

const KEEPER_STAGES: StageCode[] = ['FILING', 'STONE_SETTING']

function outcomeStatusOf(ticket: Pick<SubTicket, 'outcome' | 'outcomeStage'>): ProductionStatus {
  if (ticket.outcome === 'FINISH') return 'FINISHING'
  if (ticket.outcomeStage === 'FILING') return 'FILING_DEFECT'
  if (ticket.outcomeStage === 'STONE_SETTING') return 'STONE_DEFECT'
  return 'DEFECT'
}

/**
 * Quy trình riêng của một phiếu con, đọc từ các lần giao khâu / QC / thủ kho của chính phiếu đó.
 * Dòng cuối là chỗ phiếu đang đứng. `start` là dòng nhật ký đơn vào Chờ nguội.
 */
export function ticketTimeline(
  ticket: SubTicket,
  stages: readonly StageEntry[],
  start: Pick<StatusLog, 'changedAt' | 'changedBy'> | undefined,
): TicketTimelineRow[] {
  const entries = stages
    .filter((entry) => entry.subTicketId === ticket.id)
    .sort((a, b) => a.handedAt.localeCompare(b.handedAt))
  const rows: TicketTimelineRow[] = []
  const status = (
    key: string,
    value: ProductionStatus,
    at: string | null,
    by: string | null,
    note?: string | null,
  ) => rows.push({ key, status: value, label: STATUS_META[value].label, at, by, note })
  const step = (key: string, label: string, at: string | null, by: string | null, note?: string | null) =>
    rows.push({ key, status: null, label, at, by, note })

  status('start', 'WAIT_FILING', start?.changedAt ?? ticket.createdAt, start?.changedBy ?? ticket.createdByName)

  entries.forEach((entry, index) => {
    const next = entries[index + 1]
    const stage = STAGE_LABEL[entry.stage]
    status(
      `${entry.id}-work`,
      WORKING[entry.stage],
      entry.handedAt,
      entry.craftsmanName,
      [entry.attempt > 1 ? `Lần ${entry.attempt}` : null, entry.handedQty != null ? `SL giao ${entry.handedQty}` : null]
        .filter(Boolean)
        .join(' · ') || null,
    )
    if (!entry.returnedAt) {
      if (entry.submittedAt) {
        step(`${entry.id}-submit`, 'Thợ báo xong, chờ QC cân lại', entry.submittedAt, entry.submittedByName ?? entry.craftsmanName)
      }
      return
    }
    const qcNote = entry.returnedQty != null ? `QC nhận ${entry.returnedQty} sp` : null
    const needsKeeper = KEEPER_STAGES.includes(entry.stage)
    if (needsKeeper && !entry.confirmedAt) {
      step(`${entry.id}-keeper`, `QC nhận lại ${stage} — chờ thủ kho xác nhận`, entry.returnedAt, entry.returnedByName, qcNote)
      return
    }
    // Lỗi hết: phiếu chốt Lỗi ở dòng kết cục, không có "Chờ" khâu sau.
    const after = next ? WAITING[next.stage] : ticket.outcome ? null : ticket.status
    if (after && after !== WORKING[entry.stage]) {
      const keeperStep = needsKeeper && entry.confirmedAt && entry.confirmedByName !== entry.returnedByName
      if (keeperStep) {
        step(`${entry.id}-qc`, `QC nhận lại ${stage}`, entry.returnedAt, entry.returnedByName, qcNote)
        status(`${entry.id}-after`, after, entry.confirmedAt, entry.confirmedByName, 'Thủ kho xác nhận')
      } else {
        status(`${entry.id}-after`, after, entry.confirmedAt ?? entry.returnedAt, entry.confirmedByName ?? entry.returnedByName, qcNote)
      }
    } else {
      step(`${entry.id}-qc`, `QC nhận lại ${stage}`, entry.returnedAt, entry.returnedByName, qcNote)
    }
  })

  if (ticket.pendingStage) {
    const worker = ticket.claimedByName
    step(
      'pending',
      worker
        ? `Chỉ định ${worker} làm ${STAGE_LABEL[ticket.pendingStage]}`
        : `Mở khâu ${STAGE_LABEL[ticket.pendingStage]}, chờ thợ nhận`,
      ticket.claimedAt ?? ticket.pendingAt,
      ticket.pendingByName,
    )
  }
  if (ticket.outcome) {
    status('outcome', outcomeStatusOf(ticket), ticket.outcomeAt, ticket.outcomeByName, ticket.outcomeNote)
  }
  return rows
}
