import { describe, expect, it } from 'vitest'
import type { ProductionOrderDetail, StageEntry, SubTicket } from '../api/productionOrders'
import { outcomeLines, stageColumns, TICKET_ROWS } from './ticketRows'

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
    handedStoneCount: null,
    handedStoneWeight: null,
    issuedMetalWeight: '0',
    issuedStoneCount: 0,
    issuedStoneWeight: null,
    issuedLines: [],
    pendingRequestCount: 0,
    silverIn: '600',
    craftsmanUserId: 'u1',
    craftsmanName: 'Thợ A',
    submittedAt: null,
    submittedByName: null,
    returnedByName: null,
    returnedAt: null,
    defectQty: null,
    scrapS999Weight: null,
    confirmedAt: null,
    confirmedByName: null,
    kcsRevisionCount: 0,
    outputMaterialId: null,
    defectReportedAt: null,
    defectReportedByName: null,
    defectNote: null,
    returnedQty: null,
    returnedSilverWeight: null,
    stoneCount: null,
    stoneWeight: null,
    returnedStoneCount: null,
    stoneLines: [],
    stoneReturnedEarlyWeight: null,
    stoneReturnedEarlyCount: null,
    btpRecoveredWeight: null,
    silverRecoveredWeight: null,
    silverLoss: null,
    silverLossPercent: null,
    stonesIn: null,
    stoneLoss: null,
    stoneLossPercent: null,
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
      returnedByName: 'QC',
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

  it('một phiếu con không cân (Khắc chỉ chụp ảnh) thì cột cộng để trống TL đạt và hao hụt', () => {
    const done = { returnedAt: '2026-10-14T06:00:00.000Z', returnedByName: 'QC', returnedQty: 200 }
    const stages = [
      entry({
        id: 'a',
        subTicketId: 't1',
        subTicketNo: 1,
        stage: 'ENGRAVING',
        handedSilverWeight: null,
        silverIn: '7900',
        returnedSilverWeight: '7800',
        silverLoss: '100',
        ...done,
      }),
      entry({
        id: 'b',
        subTicketId: 't2',
        subTicketNo: 2,
        stage: 'ENGRAVING',
        handedSilverWeight: null,
        silverIn: '7888',
        returnedSilverWeight: null,
        silverLoss: null,
        ...done,
      }),
    ]
    const column = stageColumns(stages).ENGRAVING.entry!
    expect(column.silverIn).toBe('15788')
    expect(column.returnedSilverWeight).toBeNull()
    expect(column.silverLoss).toBeNull()
    expect(column.silverLossPercent).toBeNull()
  })

  it('mọi phiếu con đã cân thì hao hụt cột cộng = tổng hao hụt từng phiếu', () => {
    const done = { returnedAt: '2026-10-14T06:00:00.000Z', returnedByName: 'QC', returnedQty: 200 }
    const stages = [
      entry({ id: 'a', subTicketId: 't1', subTicketNo: 1, stage: 'PLATING', handedSilverWeight: '7500', silverIn: '7500', returnedSilverWeight: '7000', silverLoss: '500', ...done }),
      entry({ id: 'b', subTicketId: 't2', subTicketNo: 2, stage: 'PLATING', handedSilverWeight: '7888', silverIn: '7888', returnedSilverWeight: '7800', silverLoss: '88', ...done }),
    ]
    const column = stageColumns(stages).PLATING.entry!
    expect(column.returnedSilverWeight).toBe('14800')
    expect(column.silverLoss).toBe('588')
    expect(column.silverLossPercent).toBe('3.82')
  })

  it('còn phiếu con chưa được QC nhận lại thì KHÔNG hiện số nhận lại của cả đơn', () => {
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
      outcomeByName: 'QC Bình',
      outcomeStage: 'FILING',
      outcomeNote: 'gãy chấu',
    })
    const lines = outcomeLines(order(), 'DEFECT', t)
    expect(lines[0]).toBe('Khâu Nguội')
    expect(lines).toContain('QC Bình')
    expect(lines).toContain('Lý do: gãy chấu')
    // Phiếu lỗi thì cột Hoàn thiện phải trống.
    expect(outcomeLines(order(), 'FINISH', t)).toEqual([])
  })

  it('phiếu con hoàn thiện: ghi số vào kho, không ghi khâu', () => {
    const t = ticket({
      outcome: 'FINISH',
      outcomeAt: '2026-09-19T12:00:00.000Z',
      outcomeByName: 'QC Bình',
      outcomeStage: 'PLATING',
      outcomeQty: 5,
    })
    const lines = outcomeLines(order(), 'FINISH', t)
    expect(lines).toContain('Chờ vào kho thành phẩm: 5')
    expect(lines.some((line) => line.startsWith('Khâu'))).toBe(false)
    expect(outcomeLines(order(), 'DEFECT', t)).toEqual([])
  })

  it('lỗi một phần ở Nguội: ghi vào cột Lỗi dù phiếu vẫn đi tiếp', () => {
    const t = ticket({ id: 't1', code: 'A012-1' })
    const nguoi = entry({
      id: 'e1',
      subTicketId: 't1',
      stage: 'FILING',
      returnedAt: '2026-09-19T10:00:00.000Z',
      defectQty: 150,
      btpRecoveredWeight: '1000',
      confirmedAt: '2026-09-19T11:00:00.000Z',
      defectReason: 'rỗ bề mặt',
    })
    const o = order({
      stages: [nguoi],
      subTickets: [t],
      reworks: [{ code: 'DH005', status: 'WAX_CONFIRMED', qty: 150, entryId: 'e1', ticketNo: 1 }],
    })
    expect(outcomeLines(o, 'DEFECT', t)).toEqual([
      'Nguội: 150 sp lỗi · 1.000 g · phiếu bù DH005',
      'Lý do: rỗ bề mặt',
    ])
    expect(outcomeLines(o, 'FINISH', t)).toEqual([])
    // Tổng hợp cả đơn ghi kèm mã phiếu con.
    expect(outcomeLines(o, 'DEFECT')).toEqual([
      'A012-1 · Nguội: 150 sp lỗi · 1.000 g · phiếu bù DH005',
      'Lý do: rỗ bề mặt',
    ])
  })

  it('phiếu con lỗi hết ở Nguội: lý do chốt (hệ thống tự viết) không lặp lại dòng QC tách lỗi', () => {
    const t = ticket({
      id: 't1',
      code: 'A007-3',
      outcome: 'DEFECT',
      outcomeAt: '2026-10-14T07:00:00.000Z',
      outcomeByName: 'QC Bình',
      outcomeStage: 'FILING',
      outcomeNote: 'Lỗi khâu Nguội. QC ghi lỗi: avb.',
    })
    const nguoi = entry({
      id: 'e1',
      subTicketId: 't1',
      returnedAt: '2026-10-14T07:00:00.000Z',
      defectQty: 200,
      btpRecoveredWeight: '7800',
      confirmedAt: '2026-10-14T07:01:00.000Z',
      defectReason: 'avb',
    })
    const lines = outcomeLines(order({ stages: [nguoi], subTickets: [t] }), 'DEFECT', t)
    expect(lines.filter((line) => line.startsWith('Lý do:'))).toEqual(['Lý do: avb'])
    expect(lines).toContain('Khâu Nguội')
  })

  it('phiếu mẹ lỗi: nhật ký ghi tên khâu, không lặp lý do đã có ở dòng QC tách lỗi', () => {
    const nguoi = entry({
      id: 'e1',
      returnedAt: '2026-10-08T03:26:00.000Z',
      defectQty: 50,
      btpRecoveredWeight: '190',
      confirmedAt: '2026-10-08T03:27:00.000Z',
      defectReason: 'tét',
    })
    const lines = outcomeLines(
      order({
        stages: [nguoi],
        statusLogs: [
          {
            id: 'l1',
            fromStatus: 'FILING',
            toStatus: 'FILING_DEFECT',
            note: 'Lỗi hết hàng ở khâu Nguội',
            changedBy: 'Admin',
            changedAt: '2026-10-08T03:26:00.000Z',
          },
        ],
      }),
      'DEFECT',
    )
    expect(lines).toContain('Khâu Nguội')
    expect(lines.filter((line) => line.startsWith('Lý do:'))).toEqual(['Lý do: tét'])
  })

  it('không truyền phiếu con thì đọc kết cục của cả đơn', () => {
    const withGoods = order({
      finishedGoods: {
        qty: 9,
        completedQty: 9,
        pendingQty: 0,
        receivedAt: '2026-09-19T12:00:00.000Z',
        receivedByName: 'QC Bình',
        shippedQty: 0,
        remainingQty: 9,
        shipments: [],
      },
    })
    expect(outcomeLines(withGoods, 'FINISH')).toContain('Đã vào kho thành phẩm: 9')
  })

  it('đơn chưa vào kho thì cột Hoàn thiện trống', () => {
    expect(outcomeLines(order(), 'FINISH')).toEqual([])
  })
})

describe('dòng Hao hụt số lượng', () => {
  const row = TICKET_ROWS.find((item) => item.key === 'qtyLoss')!
  const RETURNED = '2026-09-19T10:00:00.000Z'

  it('chưa nhận lại thì để trống', () => {
    expect(row.value(entry({ handedQty: 200 }))).toBe('')
  })

  it('nhận đủ thì ghi 0', () => {
    expect(
      row.value(entry({ handedQty: 200, returnedQty: 200, returnedAt: RETURNED })),
    ).toBe('0 (0%)')
  })

  it('thiếu hàng thì ghi số thiếu kèm %', () => {
    expect(
      row.value(entry({ handedQty: 200, returnedQty: 190, returnedAt: RETURNED })),
    ).toBe('10 (5%)')
  })
})
