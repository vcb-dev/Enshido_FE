import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { IntakeOrder, IntakePipelineLists } from '../api/intakeOrders'
import {
  applyIntakeLiveSnapshot,
  mergeIntakeQueueItems,
  moveIntakeOrderInCaches,
} from './intakeOrderCache'

vi.mock('./intakePipelineCountsRefresh', () => ({
  patchIntakePipelineCounts: vi.fn(),
  scheduleIntakePipelineCountsRefresh: vi.fn(),
}))

it.each(['A001', undefined])('removes the intake row after production handoff (code: %s)', (productionOrderCode) => {
  const client = new QueryClient()
  const intake = { id: 'intake-1', code: 'DH001', status: 'CAST_DONE' } as IntakeOrder
  const pipelineKey = ['intake-orders', 'pipeline-lists']
  const coolingKey = ['intake-orders', 'status-list', 'WAIT_COOLING', 1, 120, '', '']
  client.setQueryData(pipelineKey, {
    CAST_DONE: { items: [intake], total: 1, page: 1, pageSize: 120 },
  })
  client.setQueryData(coolingKey, { items: [], total: 0, page: 1, pageSize: 120 })
  const linked = { ...intake, status: 'WAIT_COOLING', productionOrderCode } as IntakeOrder
  moveIntakeOrderInCaches(client, linked, { silent: true })
  moveIntakeOrderInCaches(client, linked, { silent: true })
  const pipeline = client.getQueryData<IntakePipelineLists>(pipelineKey)!
  expect(pipeline.CAST_DONE?.total).toBe(0)
  expect(pipeline.WAIT_COOLING).toBeUndefined()
  expect(client.getQueryData(coolingKey)).toMatchObject({ items: [], total: 0 })
})

describe('intake catalog', () => {
  it('keeps the original intake record available in the intake catalog', () => {
    const client = new QueryClient()
    const key = ['intake-orders', 1, 25, '', '']
    client.setQueryData(key, { items: [], total: 0, page: 1, pageSize: 25 })
    const linked = { id: 'intake-1', status: 'WAIT_COOLING', productionOrderCode: 'A001' } as IntakeOrder
    moveIntakeOrderInCaches(client, linked, { silent: true })
    expect(client.getQueryData(key)).toMatchObject({ items: [linked], total: 1 })
  })
})


it('handles the unified backend live snapshot without recreating a cooling intake row', () => {
  const client = new QueryClient()
  const pipelineKey = ['intake-orders', 'pipeline-lists']
  const catalogKey = ['intake-orders', 1, 25, '', '']
  const intake = { id: 'unified-order', code: 'DH002', status: 'CAST_DONE', images: [] } as unknown as IntakeOrder
  const list = { items: [intake], total: 1, page: 1, pageSize: 25 }
  client.setQueryData(pipelineKey, { CAST_DONE: list })
  client.setQueryData(catalogKey, list)
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const live = { ...intake, status: 'WAIT_COOLING' } as IntakeOrder
  applyIntakeLiveSnapshot(client, [live])
  applyIntakeLiveSnapshot(client, [live])
  const pipeline = client.getQueryData<IntakePipelineLists>(pipelineKey)!
  expect(pipeline.CAST_DONE?.items).toEqual([])
  expect(pipeline.WAIT_COOLING).toBeUndefined()
  expect(client.getQueryData(catalogKey)).toMatchObject({ items: [live], total: 1 })
  expect(invalidate).toHaveBeenCalledTimes(1)
  expect(client.getQueryState(catalogKey)?.isInvalidated).toBe(true)
})

it('merges SX SLL rows that share a DH code onto the parent', () => {
  const parent = {
    id: 'parent',
    code: 'DH047',
    status: 'WAX_PRINTED',
    qty: 20,
    waxReleasedQty: 15,
    parentId: null,
    createdAt: '2026-10-26T14:50:24.116Z',
  } as IntakeOrder
  const child = {
    id: 'child',
    code: 'DH047',
    status: 'WAX_CONFIRMED',
    qty: 10,
    parentId: null,
    createdAt: '2026-10-31T01:51:31.752Z',
  } as IntakeOrder
  const rows = mergeIntakeQueueItems([], [], [], [], [parent], [child])
  expect(rows).toHaveLength(1)
  expect(rows[0]?.id).toBe('parent')
  expect(rows[0]?.qty).toBe(20)
})

it('does not insert SX SLL child batches into the production pipeline', () => {
  const client = new QueryClient()
  const pipelineKey = ['intake-orders', 'pipeline-lists', '', '', { rootsOnly: true }]
  const parent = {
    id: 'parent',
    code: 'DH047',
    status: 'READY_FOR_PRODUCTION',
    qty: 20,
    waxReleasedQty: 10,
    remainingQty: 10,
    parentId: null,
    images: [],
  } as unknown as IntakeOrder
  const child = {
    id: 'child',
    code: 'DH047',
    status: 'WAX_PRINTED',
    qty: 10,
    parentId: 'parent',
    images: [],
  } as unknown as IntakeOrder
  client.setQueryData(pipelineKey, {
    READY_FOR_PRODUCTION: { items: [parent], total: 1, page: 1, pageSize: 120 },
  })
  applyIntakeLiveSnapshot(client, [parent, child])
  const pipeline = client.getQueryData<IntakePipelineLists>(pipelineKey)!
  expect(pipeline.READY_FOR_PRODUCTION?.items.map((row) => row.id)).toEqual(['parent'])
  expect(pipeline.WAX_PRINTED).toBeUndefined()
})
