import { describe, expect, it } from 'vitest'
import type { ProductionOrderDetail, StageEntry, SubTicket } from '../api/productionOrders'
import { outcomeLines, stageColumns } from './ticketRows'

function entry(over: Partial<StageEntry> = {}): StageEntry {
  return {
    id: 'e1',
    subTicketId: null,
    subTicketNo: null,
    stage: 'FILING',
    attempt: 1,
    handedByName: 'Người giao',
    handedAt: '2026-09-19T08:00:00.000Z',
    handedQty: 6,
    handedSilverWeight: '600',
    craftsmanUserId: 'u1',
    craftsmanName: 'Thợ A',
    submittedAt: null,
    submittedByName: null,
    returnedByName: null,
    returnedAt: null,
    returnedQty: null,
    returnedSilverWeight: null,
    btpRecoveredWeight: null,
    silverRecoveredWeight: null,
    silverLoss: null,
    silverLossPercent: null,
    laborCost: null,
    note: null,
    ...over,
  }
}

function ticket(over: Partial<SubTicket> = {}): SubTicket {
  return {
    id: 't1',
    no: 1,
    code: 'A012-1',
    qty: 6,
    silverWeight: '600',
    note: null,
    state: 'IDLE',
    activeStage: null,
    pendingStage: null,
    pendingAt: null,
    pendingByName: null,
    claimedByUserId: null,
    claimedByName: null,
    claimedAt: null,
    openEntryId: null,
    entryCount: 1,
    availableQty: 6,
    availableSilver: '600',
    outcome: null,
    outcomeAt: null,
    outcomeByName: null,
    outcomeStage: null,
    outcomeQty: null,
    outcomeNote: null,
    lastPrintedAt: null,
    createdByName: 'Admin',
    createdAt: '2026-09-19T07:00:00.000Z',
    ...over,
  } as SubTicket
}

function order(over: Partial<ProductionOrderDetail> = {}): ProductionOrderDetail {
  return {
    code: 'A012',
    qty: 10,
    stages: [],
    subTickets: [],
    statusLogs: [],
    finishedGoods: null,
    ...over,
  } as ProductionOrderDetail
}

describe('stageColumns — cột khâu trên phiếu', () => {
  it('lọc đúng khâu của một phiếu con khi truyền subTicketId', () => {
    const stages = [
      entry({ id: 'a', subTicketId: 't1', subTicketNo: 1 }),
      entry({ id: 'b', subTicketId: 't2', subTicketNo: 2, craftsmanName: 'Thợ B' }),
    ]
    expect(stageColumns(stages, 't1').FILING.entry?.id).toBe('a')
    expect(stageColumns(stages, 't2').FILING.entry?.craftsmanName).toBe('Thợ B')
  })

  it('phiếu mẹ cộng các phiếu con thành một cột', () => {
    const done = {
      returnedAt: '2026-09-19T12:00:00.000Z',
      returnedByName: 'KCS',
      returnedQty: 3,
      returnedSilverWeight: '295',
    }
    const stages = [
      entry({ id: 'a', subTicketId: 't1', subTicketNo: 1, handedQty: 3, handedSilverWeight: '300', ...done }),
      entry({
        id: 'b',
        subTicketId: 't2',
        subTicketNo: 2,
        handedQty: 3,
        handedSilverWeight: '300',
        craftsmanName: 'Thợ B',
        ...done,
      }),
    ]
    const column = stageColumns(stages).FILING
    expect(column.entry?.handedQty).toBe(6)
    expect(column.entry?.handedSilverWeight).toBe('600')
    expect(column.entry?.craftsmanName).toBe('Thợ A, Thợ B')
    expect(column.tickets).toEqual({ done: 2, total: 2 })
  })

  it('còn phiếu con chưa được KCS nhận lại thì KHÔNG hiện số nhận lại của cả đơn', () => {
    // Nếu hiện, người đọc dễ tưởng số dở dang là số chốt của cả đơn.
    const stages = [
      entry({
        id: 'a',
        subTicketId: 't1',
        subTicketNo: 1,
        returnedAt: '2026-09-19T12:00:00.000Z',
        returnedQty: 3,
        returnedSilverWeight: '295',
      }),
      entry({ id: 'b', subTicketId: 't2', subTicketNo: 2 }),
    ]
    const column = stageColumns(stages).FILING
    expect(column.entry?.returnedAt).toBeNull()
    expect(column.entry?.returnedQty).toBeNull()
    expect(column.tickets).toEqual({ done: 1, total: 2 })
  })

  it('khâu chưa làm thì cột trống', () => {
    expect(stageColumns([]).PLATING.entry).toBeUndefined()
  })

  it('làm lại một khâu thì cột lấy lần gần nhất', () => {
    const stages = [
      entry({ id: 'lan1', attempt: 1 }),
      entry({ id: 'lan2', attempt: 2, craftsmanName: 'Thợ B' }),
    ]
    expect(stageColumns(stages).FILING.entry?.id).toBe('lan2')
  })
})

describe('outcomeLines — hai cột cuối phiếu', () => {
  it('phiếu con chưa chốt thì cả hai cột trống', () => {
    const t = ticket()
    expect(outcomeLines(order(), 'DEFECT', t)).toEqual([])
    expect(outcomeLines(order(), 'FINISH', t)).toEqual([])
  })

  it('phiếu con lỗi: ghi khâu, thời điểm, người chốt và lý do', () => {
    const t = ticket({
      outcome: 'DEFECT',
      outcomeAt: '2026-09-19T12:00:00.000Z',
      outcomeByName: 'KCS Bình',
      outcomeStage: 'FILING',
      outcomeNote: 'gãy chấu',
    })
    const lines = outcomeLines(order(), 'DEFECT', t)
    expect(lines[0]).toBe('Khâu Nguội')
    expect(lines).toContain('KCS Bình')
    expect(lines).toContain('Lý do: gãy chấu')
    // Phiếu lỗi thì cột Hoàn thiện phải trống.
    expect(outcomeLines(order(), 'FINISH', t)).toEqual([])
  })

  it('phiếu con hoàn thiện: ghi số vào kho, không ghi khâu', () => {
    const t = ticket({
      outcome: 'FINISH',
      outcomeAt: '2026-09-19T12:00:00.000Z',
      outcomeByName: 'KCS Bình',
      outcomeStage: 'PLATING',
      outcomeQty: 5,
    })
    const lines = outcomeLines(order(), 'FINISH', t)
    expect(lines).toContain('Vào kho: 5')
    expect(lines.some((line) => line.startsWith('Khâu'))).toBe(false)
    expect(outcomeLines(order(), 'DEFECT', t)).toEqual([])
  })

  it('không truyền phiếu con thì đọc kết cục của cả đơn', () => {
    const withGoods = order({
      finishedGoods: {
        qty: 9,
        receivedAt: '2026-09-19T12:00:00.000Z',
        receivedByName: 'KCS Bình',
        shippedQty: 0,
        remainingQty: 9,
        shipments: [],
      },
    })
    expect(outcomeLines(withGoods, 'FINISH')).toContain('Vào kho: 9')
  })

  it('đơn chưa vào kho thì cột Hoàn thiện trống', () => {
    expect(outcomeLines(order(), 'FINISH')).toEqual([])
  })
})
