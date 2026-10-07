import { describe, expect, it } from 'vitest'
import { stoneReturnPreview, stoneSetWeight } from './stoneReturn'

describe('stoneReturnPreview — đá thừa theo cân gói', () => {
  it('quy viên thừa và SL xuất theo tỷ lệ TL', () => {
    // Gói 250 viên nặng 1,25 g, thừa 0,3 g → 60 viên thừa, xuất 190 viên.
    expect(stoneReturnPreview({ qty: '250', stoneCount: 250, weight: '1.25', unit: 'viên' }, 0.3)).toEqual({
      returnedCount: 60,
      usedQty: 190,
    })
  })

  it('mã tính theo ct giữ số lẻ', () => {
    expect(stoneReturnPreview({ qty: '6.25', stoneCount: 250, weight: '1.25', unit: 'ct' }, 0.3)?.usedQty).toBe(4.75)
  })

  it('không cân gói lúc cấp thì không xem trước được', () => {
    expect(stoneReturnPreview({ qty: '10', stoneCount: 10, weight: null, unit: 'viên' }, 0.1)).toBeNull()
  })

  it('đá tấm tính theo ct không đếm viên: chỉ quy SL xuất', () => {
    expect(stoneReturnPreview({ qty: '10', stoneCount: null, weight: '2', unit: 'ct' }, 0.5)).toEqual({
      returnedCount: null,
      usedQty: 7.5,
    })
  })
})

describe('stoneSetWeight — TL đá gắn khâu Vào đá', () => {
  const base = {
    stone3dGram: null,
    orderQty: 10,
    handedQty: 5,
    handedGram: 2,
    allWeighed: true,
    returnedPackGram: 0.5,
    stonesHanded: null,
    returnedCount: 0,
  }

  it('ưu tiên TL đá 3D chia theo số hàng giao', () => {
    expect(stoneSetWeight({ ...base, stone3dGram: 3 })).toEqual({ gram: 1.5, source: '3d' })
  })

  it('không có 3D: TL đá cấp − gói thừa', () => {
    expect(stoneSetWeight(base)).toEqual({ gram: 1.5, source: 'pack' })
    expect(stoneSetWeight({ ...base, returnedPackGram: 5 })).toEqual({ gram: 0, source: 'pack' })
  })

  it('dòng cấp cũ đếm viên: chia theo số viên gắn', () => {
    expect(
      stoneSetWeight({ ...base, allWeighed: false, stonesHanded: 100, returnedCount: 25 }),
    ).toEqual({ gram: 1.5, source: 'count' })
  })

  it('chưa cấp đá cân gói và không có 3D thì không có số', () => {
    expect(stoneSetWeight({ ...base, handedGram: null })).toBeNull()
  })
})
