import { describe, expect, it } from 'vitest'
import { departmentOptions, isWorkerPosition, positionLabel } from './staffPositions'

describe('vị trí công việc', () => {
  it('chỉ vị trí thợ có bậc tay nghề', () => {
    expect(isWorkerPosition('worker_filing')).toBe(true)
    expect(isWorkerPosition('accountant')).toBe(false)
    expect(isWorkerPosition(null)).toBe(false)
  })

  it('nhãn vị trí', () => {
    expect(positionLabel('worker_polish')).toBe('Thợ đánh bóng')
    expect(positionLabel(null)).toBe('')
  })

  it('bộ phận cũ gõ tự do vẫn hiện trong danh sách', () => {
    expect(departmentOptions('Sản xuất').map((o) => o.value)).toEqual(['Sản xuất', 'Văn phòng', 'Kho'])
    expect(departmentOptions('Admin').map((o) => o.value)).toContain('Admin')
  })
})
