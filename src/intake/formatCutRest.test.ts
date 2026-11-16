import { describe, expect, it } from 'vitest'
import { formatCutRest } from './intakeDisplay'

describe('formatCutRest — phần cây còn lại sau cắt cây', () => {
  it('chưa cắt cây thì null', () => {
    expect(formatCutRest({ restWeightGram: null })).toBeNull()
  })

  it('có tách hai phần thì ghi kèm S925 / bạc thu hồi', () => {
    expect(formatCutRest({ restWeightGram: '10', restS925Gram: '6', restRecoveredGram: '4' })).toBe(
      '10 g (S925 6 g · bạc thu hồi 4 g)',
    )
    expect(formatCutRest({ restWeightGram: '10', restS925Gram: '0', restRecoveredGram: '10' })).toBe(
      '10 g (bạc thu hồi 10 g)',
    )
  })

  it('phần còn lại 0 hoặc dữ liệu cũ chưa tách thì chỉ hiện tổng', () => {
    expect(formatCutRest({ restWeightGram: '0', restS925Gram: '0', restRecoveredGram: '0' })).toBe('0 g')
    expect(formatCutRest({ restWeightGram: '5' })).toBe('5 g')
  })
})
