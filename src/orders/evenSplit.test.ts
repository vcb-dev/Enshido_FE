import { describe, expect, it } from 'vitest'
import { evenSplit } from './evenSplit'

describe('chia đều phiếu con', () => {
  it('chia hết', () => expect(evenSplit(1000, 2)).toEqual([500, 500]))
  it('phần dư dồn cho các phiếu đầu, tổng giữ nguyên', () => {
    expect(evenSplit(1000, 3)).toEqual([334, 333, 333])
    expect(evenSplit(10, 4)).toEqual([3, 3, 2, 2])
  })
})
