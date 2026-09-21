import { describe, expect, it } from 'vitest'
import type { ProductionOrderDetail, StageEntry, SubTicket } from '../api/productionOrders'
import { openableStages } from './SubTicketDialogs'

const RETURNED = '2026-09-21T02:58:00.000Z'

/** Khâu đã được KCS nhận lại của một phiếu con — chỉ các trường openableStages đọc tới. */
function done(subTicketId: string, stage: StageEntry['stage']): StageEntry {
  return { id: `${subTicketId}-${stage}`, subTicketId, stage, returnedAt: RETURNED } as StageEntry
}

function ticket(no: number, over: Partial<SubTicket> = {}): SubTicket {
  return {
    id: `t${no}`,
    no,
    code: `A002-${no}`,
    state: 'IDLE',
    activeStage: null,
    ...over,
  } as SubTicket
}

function order(subTickets: SubTicket[], stages: StageEntry[], status = 'FILING'): ProductionOrderDetail {
  return { code: 'A002', status, subTickets, stages } as unknown as ProductionOrderDetail
}

describe('openableStages — phiếu con xong trước được đi tiếp', () => {
  it('đúng cảnh A002: phiếu 1 xong Nguội, hai phiếu kia còn chờ Nguội → mở được Vào đá cho phiếu 1', () => {
    const o = order(
      [
        ticket(1),
        ticket(2, { state: 'WAITING', activeStage: 'FILING' }),
        ticket(3, { state: 'WAITING', activeStage: 'FILING' }),
      ],
      [done('t1', 'FILING')],
    )
    const { stages, idle, byTicket } = openableStages(o)

    // Trước đây: phiếu khác còn ở Nguội thì chỉ được mở Nguội → không còn khâu nào → nút xám.
    expect(stages[0]).toBe('STONE_SETTING')
    expect(idle.map((t) => t.no)).toEqual([1])
    expect(byTicket.get(1)).not.toContain('FILING')
  })

  it('mỗi phiếu tính khâu kế tiếp của riêng nó', () => {
    const o = order([ticket(1), ticket(2)], [done('t1', 'FILING'), done('t2', 'FILING'), done('t2', 'STONE_SETTING')])
    const { byTicket, skipped } = openableStages(o)

    expect(byTicket.get(1)?.[0]).toBe('STONE_SETTING')
    expect(byTicket.get(2)?.[0]).toBe('ENGRAVING')
    expect(skipped(1, 'STONE_SETTING')).toEqual([])
    expect(skipped(2, 'ENGRAVING')).toEqual([])
  })

  it('biết phiếu nào sẽ nhảy cóc nếu mở khâu xa hơn — dialog dựa vào đây để không tick sẵn', () => {
    const o = order([ticket(1), ticket(2)], [done('t1', 'FILING'), done('t2', 'FILING'), done('t2', 'STONE_SETTING')])
    const { skipped } = openableStages(o)

    // Mở Khắc: phiếu 2 đúng khâu kế tiếp, phiếu 1 sẽ bỏ qua Vào đá.
    expect(skipped(1, 'ENGRAVING')).toEqual(['STONE_SETTING'])
    expect(skipped(1, 'PLATING')).toEqual(['STONE_SETTING', 'ENGRAVING', 'POLISHING'])
  })

  it('vẫn không cho lùi khâu', () => {
    const o = order([ticket(1)], [done('t1', 'FILING'), done('t1', 'STONE_SETTING')])
    expect(openableStages(o).byTicket.get(1)).toEqual(['ENGRAVING', 'POLISHING', 'PLATING'])
  })

  it('đơn đang làm lại (ra khỏi khâu) thì mở khâu nào cũng được, không tính là nhảy cóc', () => {
    const o = order([ticket(1)], [done('t1', 'FILING'), done('t1', 'STONE_SETTING')], 'DEFECT')
    const { byTicket, skipped } = openableStages(o)

    expect(byTicket.get(1)?.[0]).toBe('FILING')
    expect(skipped(1, 'PLATING')).toEqual([])
  })
})
