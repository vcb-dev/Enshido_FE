import { describe, expect, it } from 'vitest'
import { formatQty } from '../api/inventory'
import { insufficientIssueStockMessage, needByMaterialId } from './castingIssueStock'

describe('cấp vật tư — báo thiếu tồn trên ô mã NVL', () => {
  it('cộng gram khi hai ô chọn cùng mã', () => {
    const need = needByMaterialId(['a', 'b', 'a', ''], [10, 3, 5, 8])
    expect(need.get('a')).toBe(15)
    expect(need.get('b')).toBe(3)
    expect(need.has('')).toBe(false)
  })

  it('đủ tồn thì không báo', () => {
    expect(
      insufficientIssueStockMessage({ need: 1295, availableQty: '1295' }),
    ).toBeNull()
    expect(
      insufficientIssueStockMessage({ need: 1295, availableQty: '1300' }),
    ).toBeNull()
    expect(insufficientIssueStockMessage({ need: 0, availableQty: '0' })).toBeNull()
    expect(insufficientIssueStockMessage({ need: 10 })).toBeNull()
  })

  it('thiếu tồn thì báo sẵn có / xuất ngay trên ô', () => {
    expect(
      insufficientIssueStockMessage({ need: 1295, availableQty: '1266.9508' }),
    ).toBe(`Không đủ tồn để xuất (sẵn có ${formatQty('1266.9508')}, xuất ${formatQty('1295')})`)
  })

  it('có giữ chỗ thì ghi khả dụng', () => {
    expect(
      insufficientIssueStockMessage({
        need: 100,
        availableQty: '80',
        heldQty: '20',
        onHandQty: '100',
      }),
    ).toBe(
      `Không đủ tồn để xuất (tồn thực ${formatQty('100')}, đang giữ chỗ ${formatQty('20')} — khả dụng ${formatQty('80')}, xuất ${formatQty('100')})`,
    )
  })
})
