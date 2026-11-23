import { describe, expect, it } from 'vitest'
import type { CastingSlipCandidate } from '../api/castingSlips'
import { countPickedTrees, groupCandidatesByTree } from './castingTreeGroups'

function tree(no: number) {
  return { no, imageUrl: `https://img/${no}.jpg`, graftedAt: '2026-11-20T03:00:00Z' }
}

function row(over: Partial<CastingSlipCandidate> & { id: string }): CastingSlipCandidate {
  return {
    code: over.id,
    sxCode: 'S',
    productName: 'SP',
    trackingCode: null,
    qty: 1,
    dueDate: null,
    hasMold: true,
    waxWeightGram: '1',
    castingTree: null,
    ...over,
  }
}

describe('gom đơn chờ đúc theo cối', () => {
  it('cùng cối một nhóm, cộng SL + TL sáp, hạn trả lấy ngày sớm nhất', () => {
    const groups = groupCandidatesByTree([
      row({ id: 'a', qty: 4, waxWeightGram: '2.09', dueDate: '2026-11-19', castingTree: tree(1) }),
      row({ id: 'b', qty: 1, waxWeightGram: '0.86', dueDate: '2026-11-15', castingTree: tree(1) }),
      row({ id: 'c', qty: 15, waxWeightGram: '20.74', castingTree: tree(2) }),
    ])
    expect(groups.map((group) => group.tree?.no)).toEqual([1, 2])
    expect(groups[0]).toMatchObject({ qty: 5, dueDate: '2026-11-15' })
    expect(groups[0]?.rows.map((item) => item.id)).toEqual(['a', 'b'])
    expect(groups[0]?.waxGram).toBeCloseTo(2.95)
  })

  it('xếp theo số cối, đơn không có ảnh cây xuống cuối', () => {
    const groups = groupCandidatesByTree([
      row({ id: 'x' }),
      row({ id: 'b', castingTree: tree(2) }),
      row({ id: 'a', castingTree: tree(1) }),
    ])
    expect(groups.map((group) => group.tree?.no ?? group.rows[0]?.id)).toEqual([1, 2, 'x'])
  })

  it('đơn không có ảnh cây thì mỗi đơn một nhóm riêng', () => {
    const groups = groupCandidatesByTree([row({ id: 'a' }), row({ id: 'b' })])
    expect(groups).toHaveLength(2)
    expect(groups.every((group) => group.tree === null)).toBe(true)
  })

  it('đếm số cối đã chọn', () => {
    expect(
      countPickedTrees([
        row({ id: 'a', castingTree: tree(1) }),
        row({ id: 'b', castingTree: tree(1) }),
        row({ id: 'c' }),
      ]),
    ).toBe(2)
  })
})
