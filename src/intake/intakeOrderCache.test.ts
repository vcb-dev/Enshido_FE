import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { IntakeOrder, IntakePipelineLists } from '../api/intakeOrders'
import { applyIntakeLiveSnapshot, moveIntakeOrderInCaches } from './intakeOrderCache'

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
