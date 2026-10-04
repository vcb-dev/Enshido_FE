import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { IntakeOrder, IntakePipelineLists } from '../api/intakeOrders'
import { moveIntakeOrderInCaches } from './intakeOrderCache'

vi.mock('./intakePipelineCountsRefresh', () => ({
  patchIntakePipelineCounts: vi.fn(),
  scheduleIntakePipelineCountsRefresh: vi.fn(),
}))

it('removes the intake row after it becomes a production order, including live cache updates', () => {
  const client = new QueryClient()
  const intake = { id: 'intake-1', code: 'DH001', status: 'CAST_DONE' } as IntakeOrder
  const pipelineKey = ['intake-orders', 'pipeline-lists']
  const coolingKey = ['intake-orders', 'status-list', 'WAIT_COOLING', 1, 120, '', '']
  client.setQueryData(pipelineKey, {
    CAST_DONE: { items: [intake], total: 1, page: 1, pageSize: 120 },
  })
  client.setQueryData(coolingKey, { items: [], total: 0, page: 1, pageSize: 120 })
  const linked = { ...intake, status: 'WAIT_COOLING', productionOrderCode: 'A001' } as IntakeOrder
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
