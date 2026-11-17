import { describe, expect, it } from 'vitest'
import type { StageEntry, StoneLine } from '../api/productionOrders'
import { stoneConfirmCheck } from './stoneConfirmCheck'

const line = (weight: string | null, returnedWeight: string | null): StoneLine =>
  ({ materialId: 'm', sku: null, name: 'Đá', unit: 'ct', qty: '1', stoneCount: null, weight, returnedWeight }) as StoneLine

const entry = (over: Partial<StageEntry>): StageEntry =>
  ({
    stage: 'STONE_SETTING',
    silverIn: '10.8',
    returnedSilverWeight: '12.84',
    btpRecoveredWeight: null,
    silverRecoveredWeight: null,
    scrapS999Weight: null,
    stoneLines: [line('3', '0.9')],
    ...over,
  }) as StageEntry

describe('đối chiếu Vào đá với đá thực tế lúc thủ kho xác nhận', () => {
  it('hao bình thường thì không cảnh báo', () => {
    // 10,8 + (3 − 0,9) − 12,84 = 0,06 g ≈ 0,6%
    const check = stoneConfirmCheck(entry({}))
    expect(check).toMatchObject({ stoneUsed: 2.1, loss: 0.06, issue: null })
  })

  it('gói thừa ghi 0 trong khi BTP tăng ít hơn đá cấp → hao vượt mức, cảnh báo', () => {
    // A036: 4,94 + 2,14 − 5,042 = 2,038 g ≈ 41%
    const check = stoneConfirmCheck(
      entry({ silverIn: '4.94', returnedSilverWeight: '5.042', stoneLines: [line('2.14', '0')] }),
    )
    expect(check).toMatchObject({ loss: 2.038, issue: 'high' })
    expect(check!.percent).toBeGreaterThan(40)
  })

  it('nhận lại nặng hơn bạc + đá thực tế → cảnh báo cân lại', () => {
    const check = stoneConfirmCheck(entry({ returnedSilverWeight: '13.5' }))
    expect(check).toMatchObject({ loss: -0.6, issue: 'gain' })
  })

  it('cộng cả hàng lỗi và nguyên liệu thừa thu hồi vào TL ra', () => {
    const check = stoneConfirmCheck(
      entry({ returnedSilverWeight: '10', btpRecoveredWeight: '2.5', silverRecoveredWeight: '0.3', scrapS999Weight: '0.1' }),
    )
    expect(check).toMatchObject({ out: 12.9, issue: null })
  })

  it('thiếu số liệu thì bỏ qua: khâu khác, chưa cân, gói đá không cân TL', () => {
    expect(stoneConfirmCheck(entry({ stage: 'FILING' }))).toBeNull()
    expect(stoneConfirmCheck(entry({ returnedSilverWeight: null }))).toBeNull()
    expect(stoneConfirmCheck(entry({ stoneLines: [line(null, null)] }))).toBeNull()
    expect(stoneConfirmCheck(entry({ stoneLines: [] }))).toBeNull()
    expect(stoneConfirmCheck(null)).toBeNull()
  })
})
