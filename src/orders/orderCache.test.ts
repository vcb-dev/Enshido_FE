import { describe, expect, it } from 'vitest'
import type { ProductionOrderDetail, StageEntry, SubTicket } from '../api/productionOrders'
import { summarizeSubTickets } from './orderCache'

const RETURNED = '2026-09-21T02:58:00.000Z'

function entry(over: Partial<StageEntry>): StageEntry {
  return { id: 'e', subTicketId: 't1', stage: 'FILING', returnedAt: null, craftsmanName: 'Thợ', ...over } as StageEntry
}

function ticket(over: Partial<SubTicket> = {}): SubTicket {
  return {
    id: 't1',
    no: 1,
    code: 'A001-1',
    qty: 210,
    note: null,
    createdAt: '2026-09-18T07:42:00.000Z',
    state: 'IDLE',
    activeStage: null,
    claimedByName: null,
    openEntryId: null,
    ...over,
  } as SubTicket
}

function order(subTickets: SubTicket[], stages: StageEntry[]): ProductionOrderDetail {
  return { code: 'A001', subTickets, stages } as unknown as ProductionOrderDetail
}

const nguoiDone = entry({ id: 'n1', stage: 'FILING', returnedAt: RETURNED, craftsmanName: 'Vũ Đại Lương' })

describe('summarizeSubTickets — dòng danh sách vá từ bản chi tiết', () => {
  it('chờ thợ nhận khâu mới: khâu mới, không mang tên thợ khâu trước', () => {
    const [s] = summarizeSubTickets(
      order([ticket({ state: 'WAITING', activeStage: 'STONE_SETTING' })], [nguoiDone]),
    )
    expect(s).toEqual({
      code: 'A001-1',
      no: 1,
      qty: 210,
      note: null,
      createdAt: '2026-09-18T07:42:00.000Z',
      state: 'WAITING',
      stage: 'STONE_SETTING',
      workerName: null,
    })
  })

  it('đã nhận: tên người nhận', () => {
    const [s] = summarizeSubTickets(
      order(
        [ticket({ state: 'CLAIMED', activeStage: 'STONE_SETTING', claimedByName: 'Thuỳ Linh' })],
        [nguoiDone],
      ),
    )
    expect(s.workerName).toBe('Thuỳ Linh')
  })

  it('đang làm: thợ của khâu đang mở', () => {
    const working = entry({ id: 'v1', stage: 'STONE_SETTING', craftsmanName: 'Admin Enshido' })
    const [s] = summarizeSubTickets(
      order(
        [ticket({ state: 'SUBMITTED', activeStage: 'STONE_SETTING', openEntryId: 'v1' })],
        [nguoiDone, working],
      ),
    )
    expect(s).toMatchObject({ state: 'SUBMITTED', stage: 'STONE_SETTING', workerName: 'Admin Enshido' })
  })

  it('xong khâu chưa mở khâu sau: khâu vừa xong, không ai giữ hàng', () => {
    const [s] = summarizeSubTickets(order([ticket()], [nguoiDone]))
    expect(s).toMatchObject({ state: 'IDLE', stage: 'FILING', workerName: null })
  })

  it('chỉ lấy khâu của đúng phiếu đó', () => {
    const other = entry({ id: 'x', subTicketId: 't2', stage: 'PLATING', returnedAt: RETURNED })
    const [s] = summarizeSubTickets(order([ticket()], [nguoiDone, other]))
    expect(s.stage).toBe('FILING')
  })

  it('đơn chưa chia phiếu con thì rỗng', () => {
    expect(summarizeSubTickets(order([], []))).toEqual([])
  })
})
