import { describe, expect, it } from 'vitest'
import { skipPlan } from './SkipStagesDialog'

const base = { pendingStage: null, skippedStages: [], lastStage: null, skipStone: false } as const

describe('skipPlan — Chuyển khâu', () => {
  it('phiếu Chờ nguội chuyển được sang mọi khâu sau Nguội', () => {
    expect(skipPlan({ ...base, state: 'IDLE' })).toEqual({
      from: 'FILING',
      targets: ['STONE_SETTING', 'ENGRAVING', 'POLISHING', 'PLATING'],
    })
  })

  it('đang chờ thợ nhận thì tính từ khâu đang mở', () => {
    expect(skipPlan({ ...base, state: 'CLAIMED', pendingStage: 'STONE_SETTING', lastStage: 'FILING' })?.from).toBe(
      'STONE_SETTING',
    )
  })

  it('đã bỏ Nguội thì phiếu rảnh đang chờ Vào đá; đơn không đá không chọn được Vào đá', () => {
    expect(skipPlan({ ...base, state: 'IDLE', skippedStages: ['FILING'] })?.from).toBe('STONE_SETTING')
    expect(skipPlan({ ...base, state: 'IDLE', skipStone: true })?.targets).toEqual(['ENGRAVING', 'POLISHING', 'PLATING'])
  })

  it('thợ đang giữ hàng, chờ QC / thủ kho, hay đang chờ Xi thì không chuyển được', () => {
    for (const state of ['WORKING', 'SUBMITTED', 'CONFIRMING', 'DEFECT', 'FINISH'] as const) {
      expect(skipPlan({ ...base, state })).toBeNull()
    }
    expect(skipPlan({ ...base, state: 'WAITING', pendingStage: 'PLATING', lastStage: 'POLISHING' })).toBeNull()
  })

  it('phiếu đã giao khâu thì chọn thêm được nhập thẳng kho thành phẩm, kể cả đang chờ Xi', () => {
    expect(skipPlan({ ...base, state: 'IDLE', lastStage: 'FILING', hasOwnEntries: true })?.targets).toEqual([
      'ENGRAVING',
      'POLISHING',
      'PLATING',
      'FINISHED',
    ])
    expect(
      skipPlan({ ...base, state: 'WAITING', pendingStage: 'PLATING', lastStage: 'POLISHING', hasOwnEntries: true }),
    ).toEqual({ from: 'PLATING', targets: ['FINISHED'] })
  })

  it('phiếu chưa giao khâu nào thì không nhập thẳng thành phẩm', () => {
    expect(skipPlan({ ...base, state: 'IDLE' })?.targets).not.toContain('FINISHED')
  })
})
