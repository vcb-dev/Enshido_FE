import { describe, expect, it } from 'vitest'
import { deadlineWarning } from './deadline'

const TODAY = '2026-09-23'

describe('deadlineWarning', () => {
  it('cảnh báo quá hạn, hôm nay và trong ba ngày tới', () => {
    expect(deadlineWarning('2026-09-21', 'STONE_SETTING', TODAY)?.label).toBe('Quá hạn 2 ngày')
    expect(deadlineWarning(TODAY, 'STONE_SETTING', TODAY)?.tone).toBe('today')
    expect(deadlineWarning('2026-09-26', 'STONE_SETTING', TODAY)?.label).toBe('Còn 3 ngày')
  })

  it('không cảnh báo khi còn xa hoặc đơn đã hoàn thiện / đã giao', () => {
    expect(deadlineWarning('2026-09-27', 'STONE_SETTING', TODAY)).toBeNull()
    expect(deadlineWarning('2026-09-21', 'FINISHING', TODAY)).toBeNull()
    expect(deadlineWarning('2026-09-21', 'DELIVERED', TODAY)).toBeNull()
  })
})
