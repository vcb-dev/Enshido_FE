import { describe, expect, it } from 'vitest'
import type { StageEntry, SubTicket } from '../api/productionOrders'
import { ticketTimeline } from './ticketTimeline'

const START = { changedAt: '2026-10-04T03:04:00Z', changedBy: 'Admin' }

function ticket(patch: Partial<SubTicket> = {}) {
  return {
    id: 't1',
    no: 1,
    code: 'A002-1',
    qty: 50,
    status: 'WAIT_FILING',
    pendingStage: null,
    claimedByName: null,
    claimedAt: null,
    pendingAt: null,
    pendingByName: null,
    outcome: null,
    outcomeStage: null,
    outcomeAt: null,
    outcomeByName: null,
    outcomeNote: null,
    createdAt: '2026-10-04T03:04:00Z',
    createdByName: 'Admin',
    ...patch,
  } as SubTicket
}

function entry(patch: Partial<StageEntry>) {
  return {
    id: 'e1',
    subTicketId: 't1',
    stage: 'FILING',
    attempt: 1,
    handedAt: '2026-10-04T03:10:00Z',
    handedQty: 50,
    craftsmanName: 'Thợ A',
    submittedAt: null,
    submittedByName: null,
    returnedAt: null,
    returnedByName: null,
    returnedQty: null,
    confirmedAt: null,
    confirmedByName: null,
    ...patch,
  } as StageEntry
}

describe('ticketTimeline — trạng thái riêng từng phiếu con', () => {
  it('phiếu chưa giao khâu nào chỉ đang Chờ nguội', () => {
    const rows = ticketTimeline(ticket(), [entry({ subTicketId: 't2' })], START)
    expect(rows.map((row) => row.status)).toEqual(['WAIT_FILING'])
  })

  it('phiếu đang nguội dừng ở Đang nguội, không lẫn khâu của phiếu khác', () => {
    const rows = ticketTimeline(ticket({ status: 'FILING' }), [entry({}), entry({ id: 'e2', subTicketId: 't2', stage: 'STONE_SETTING' })], START)
    expect(rows.map((row) => row.status)).toEqual(['WAIT_FILING', 'FILING'])
    expect(rows.at(-1)?.by).toBe('Thợ A')
  })

  it('thợ báo xong thêm dòng chờ QC cân lại', () => {
    const rows = ticketTimeline(
      ticket({ status: 'FILING' }),
      [entry({ submittedAt: '2026-10-04T05:00:00Z', submittedByName: 'Thợ A' })],
      START,
    )
    expect(rows.at(-1)).toMatchObject({ status: null, label: 'Thợ báo xong, chờ QC cân lại' })
  })

  it('Vào đá QC nhận xong chờ thủ kho xác nhận, rồi sang Chờ khắc', () => {
    const base = { stage: 'STONE_SETTING' as const, returnedAt: '2026-10-04T07:00:00Z', returnedByName: 'QC', returnedQty: 50 }
    const waiting = ticketTimeline(ticket({ status: 'STONE_SETTING' }), [entry(base)], START)
    expect(waiting.at(-1)).toMatchObject({ status: null, by: 'QC' })
    const done = ticketTimeline(
      ticket({ status: 'WAIT_ENGRAVING' }),
      [entry({ ...base, confirmedAt: '2026-10-04T08:00:00Z', confirmedByName: 'Kho' })],
      START,
    )
    expect(done.map((row) => row.status)).toEqual(['WAIT_FILING', 'STONE_SETTING', null, 'WAIT_ENGRAVING'])
    expect(done.at(-1)).toMatchObject({ by: 'Kho' })
  })

  it('kết cục lỗi ở Nguội thành dòng Lỗi nguội', () => {
    const rows = ticketTimeline(
      ticket({ status: 'FILING_DEFECT', outcome: 'DEFECT', outcomeStage: 'FILING', outcomeAt: '2026-10-04T09:00:00Z', outcomeByName: 'Kho' }),
      [entry({ returnedAt: '2026-10-04T07:00:00Z', returnedByName: 'QC', confirmedAt: '2026-10-04T09:00:00Z', confirmedByName: 'Kho' })],
      START,
    )
    expect(rows.at(-1)).toMatchObject({ status: 'FILING_DEFECT' })
  })

  it('phiếu được chỉ định thợ nhưng chưa nhận hàng', () => {
    const rows = ticketTimeline(
      ticket({ pendingStage: 'FILING', claimedByName: 'Thợ B', claimedAt: '2026-10-04T04:00:00Z' }),
      [],
      START,
    )
    expect(rows.at(-1)).toMatchObject({ status: null, label: 'Chỉ định Thợ B làm Nguội' })
  })
})

describe('ticketTimeline — Khắc → Đánh bóng → Xi', () => {
  const done = (id: string, stage: StageEntry['stage'], at: string) =>
    entry({ id, stage, handedAt: at, submittedAt: at, returnedAt: at, returnedByName: 'QC Lan', returnedQty: 50, confirmedAt: at, confirmedByName: 'QC Lan' })

  it('QC xác nhận Khắc xong phiếu sang Chờ đánh bóng, thợ nhận rồi mới Đang đánh bóng', () => {
    const engraved = done('e1', 'ENGRAVING', '2026-10-05T01:00:00Z')
    const waiting = ticketTimeline(ticket({ status: 'WAIT_POLISHING', pendingStage: 'POLISHING' }), [engraved], START)
    expect(waiting.map((row) => row.status)).toEqual(['WAIT_FILING', 'ENGRAVING', 'WAIT_POLISHING'])

    const working = ticketTimeline(
      ticket({ status: 'POLISHING' }),
      [engraved, entry({ id: 'e2', stage: 'POLISHING', handedAt: '2026-10-05T02:00:00Z' })],
      START,
    )
    expect(working.map((row) => row.status)).toEqual(['WAIT_FILING', 'ENGRAVING', 'WAIT_POLISHING', 'POLISHING'])
  })

  it('đi hết Xi: Chờ xi → Đang xi → Đã xi xong, kho nhận đủ mới Sản xuất xong', () => {
    const entries = [
      done('e1', 'ENGRAVING', '2026-10-05T01:00:00Z'),
      done('e2', 'POLISHING', '2026-10-05T02:00:00Z'),
      done('e3', 'PLATING', '2026-10-05T03:00:00Z'),
    ]
    const closed = { outcome: 'FINISH', outcomeStage: 'PLATING', outcomeAt: '2026-10-05T03:00:00Z', outcomeByName: 'QC Lan' } as const
    const plated = ticketTimeline(ticket({ status: 'PLATED', ...closed }), entries, START)
    expect(plated.map((row) => row.status).filter(Boolean)).toEqual([
      'WAIT_FILING',
      'ENGRAVING',
      'WAIT_POLISHING',
      'POLISHING',
      'WAIT_PLATING',
      'PLATING',
      'PLATED',
    ])
    const stocked = ticketTimeline(ticket({ status: 'FINISHING', ...closed }), entries, START)
    expect(stocked.at(-1)?.status).toBe('FINISHING')
  })
})
