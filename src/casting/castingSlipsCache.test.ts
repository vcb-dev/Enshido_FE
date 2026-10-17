import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { CastingSlip } from '../api/castingSlips'
import type { MyTickets } from '../api/productionOrders'
import { patchMyTicketsFromCastingSlip } from './castingSlipsCache'

vi.mock('../intake/intakeOrderCache', () => ({
  findIntakeOrderInCaches: vi.fn(),
  moveIntakeOrderInCaches: vi.fn(),
}))
vi.mock('../orders/myTicketsRefresh', () => ({
  scheduleMyTicketsRefresh: vi.fn(),
}))
vi.mock('../workflow/workflowBroadcast', () => ({
  notifyWorkflowChanged: vi.fn(),
}))

function slip(over: Partial<CastingSlip>): CastingSlip {
  return {
    id: 's1',
    code: 'DABC1',
    slipDate: '2026-10-17',
    waxWeightGram: '12',
    batchOrderCodes: 'DH001',
    orders: [{ intakeOrderId: 'o1' } as CastingSlip['orders'][number]],
    issueTotalGram: '0',
    startedAt: null,
    confirmedAt: null,
    status: 'PENDING_ISSUE',
    ...over,
  } as CastingSlip
}

function emptyTickets(): MyTickets {
  return {
    available: [],
    mine: [],
    recent: [],
    castingAvailable: [],
    castingMine: [],
    castingRecent: [],
  }
}

describe('patchMyTicketsFromCastingSlip', () => {
  it('chưa cấp vật tư không hiện trên phiếu khâu', () => {
    const client = new QueryClient()
    client.setQueryData(['my-tickets'], {
      ...emptyTickets(),
      castingMine: [{ id: 's1', code: 'DABC1', status: 'PENDING_ISSUE' }],
    })
    patchMyTicketsFromCastingSlip(client, slip({ status: 'PENDING_ISSUE' }))
    const next = client.getQueryData<MyTickets>(['my-tickets'])!
    expect(next.castingAvailable).toEqual([])
    expect(next.castingMine).toEqual([])
    expect(next.castingRecent).toEqual([])
  })

  it('đã cấp vật tư vào Chờ nhận, nhận phiếu mới sang Đang giữ', () => {
    const client = new QueryClient()
    client.setQueryData(['my-tickets'], emptyTickets())
    patchMyTicketsFromCastingSlip(client, slip({ status: 'WAIT_CASTING' }))
    expect(client.getQueryData<MyTickets>(['my-tickets'])?.castingAvailable).toMatchObject([
      { id: 's1', status: 'WAIT_CASTING' },
    ])
    patchMyTicketsFromCastingSlip(
      client,
      slip({ status: 'CASTING', startedAt: '2026-10-17T01:00:00.000Z' }),
    )
    const next = client.getQueryData<MyTickets>(['my-tickets'])!
    expect(next.castingAvailable).toEqual([])
    expect(next.castingMine).toMatchObject([{ id: 's1', status: 'CASTING' }])
  })
})
