import { describe, expect, it } from 'vitest'
import type { StageEntry } from '../api/productionOrders'
import { lastStageDone } from './catalog'

const RETURNED = '2026-09-21T02:58:00.000Z'

/** Một lần giao khâu — chỉ các trường lastStageDone đọc tới. */
function entry(stage: StageEntry['stage'], returnedAt: string | null = RETURNED) {
  return { stage, returnedAt } as StageEntry
}

describe('lastStageDone — đã đi hết tới khâu cuối chưa', () => {
  it('chưa giao khâu nào thì chưa tới', () => {
    expect(lastStageDone([])).toBe(false)
  })

  it('mới xong Nguội thì chưa tới', () => {
    expect(lastStageDone([entry('FILING')])).toBe(false)
  })

  it('khâu Xi còn đang ở tay thợ thì chưa tới', () => {
    expect(lastStageDone([entry('FILING'), entry('PLATING', null)])).toBe(false)
  })

  it('KCS nhận lại khâu Xi thì tới, dù khâu giữa bị bỏ', () => {
    expect(lastStageDone([entry('FILING'), entry('PLATING')])).toBe(true)
  })

  it('xi xong rồi sửa lại nguội thì phải xi lại mới tới', () => {
    expect(lastStageDone([entry('PLATING'), entry('FILING')])).toBe(false)
  })
})
