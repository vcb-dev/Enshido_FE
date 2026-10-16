import { describe, expect, it } from 'vitest'
import type { ProductionOrderLookups } from '../api/productionOrders'
import { stageWorkersFrom, workersForStage } from './stageWorkers'

const lookups = {
  users: [
    { id: 'nguoi', username: 'nguoi', fullName: 'Thợ nguội' },
    { id: 'sx', username: 'sx', fullName: 'Thợ sản xuất' },
    { id: 'sap', username: 'sap', fullName: 'Thợ sáp' },
    { id: 'admin', username: 'admin', fullName: 'Admin' },
    { id: 'kho', username: 'kho', fullName: 'Thủ kho' },
  ],
  workerIds: ['nguoi', 'sx', 'sap', 'admin'],
  adminIds: ['admin'],
  workerStages: {
    nguoi: ['FILING'],
    sx: ['FILING', 'STONE_SETTING', 'ENGRAVING', 'POLISHING', 'PLATING'],
  },
} as unknown as ProductionOrderLookups

const ids = (list: { id: string }[]) => list.map((worker) => worker.id)

describe('chọn thợ theo khâu khi giao', () => {
  it('thủ kho không thấy admin; thợ sáp không có khâu nào', () => {
    const workers = stageWorkersFrom(lookups, false)
    expect(ids(workers)).toEqual(['nguoi', 'sx', 'sap'])
    expect(ids(workersForStage(workers, 'FILING'))).toEqual(['nguoi', 'sx'])
    expect(ids(workersForStage(workers, 'STONE_SETTING'))).toEqual(['sx'])
  })

  it('admin giao thì thấy admin ở mọi khâu', () => {
    const workers = stageWorkersFrom(lookups, true)
    expect(ids(workersForStage(workers, 'PLATING'))).toEqual(['sx', 'admin'])
  })

  it('chưa chọn khâu thì chưa có thợ để chọn', () => {
    expect(workersForStage(stageWorkersFrom(lookups, true), '')).toEqual([])
  })

  it('BE cũ chưa trả workerStages thì không ai ngoài admin được chọn', () => {
    const old = { ...lookups, workerStages: undefined }
    expect(ids(workersForStage(stageWorkersFrom(old, true), 'FILING'))).toEqual(['admin'])
  })
})
