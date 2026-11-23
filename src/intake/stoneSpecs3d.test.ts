import { describe, expect, it } from 'vitest'
import { stoneSpecsOf, stoneSpecsPayload } from './StoneSpecsFields'
import { formatStone3d } from './intakeDisplay'

describe('đá 3D nhập theo 1 sản phẩm', () => {
  it('gửi số 1 sp (ct → g), không nhân SL', () => {
    expect(stoneSpecsPayload({ hasStone: true, stoneCount3d: '2', stoneWeight3dCt: '0.82' })).toEqual({
      stoneCount3dPerPiece: 2,
      stoneWeight3dPerPieceGram: 0.164,
    })
  })

  it('không có đá thì gửi 0 viên / 0 g', () => {
    expect(stoneSpecsPayload({ hasStone: false, stoneCount3d: '', stoneWeight3dCt: '' })).toEqual({
      stoneCount3dPerPiece: 0,
      stoneWeight3dPerPieceGram: 0,
    })
  })

  it('mở lại form hiện số 1 sp từ máy chủ', () => {
    expect(
      stoneSpecsOf({
        qty: 4,
        stoneCount3d: 8,
        stoneWeight3dGram: '0.656',
        stoneCount3dPerPiece: 2,
        stoneWeight3dPerPieceGram: '0.164',
      }),
    ).toEqual({ hasStone: true, stoneCount3d: '2', stoneWeight3dCt: '0.82' })
  })

  it('máy chủ cũ chỉ có tổng thì tự chia SL; số viên không chia hết thì để trống', () => {
    expect(stoneSpecsOf({ qty: 4, stoneCount3d: 6, stoneWeight3dGram: '0.656' })).toEqual({
      hasStone: true,
      stoneCount3d: '',
      stoneWeight3dCt: '0.82',
    })
  })

  it('hiện cả số 1 sp lẫn cả đơn', () => {
    expect(
      formatStone3d({ qty: 4, stoneCount3d: 8, stoneWeight3dGram: '0.656', stoneCount3dPerPiece: 2, stoneWeight3dPerPieceGram: '0.164' }),
    ).toBe('2 viên · 0,82 ct / sp — cả đơn 8 viên · 3,28 ct')
    expect(formatStone3d({ qty: 1, stoneCount3d: 3, stoneWeight3dGram: '0.2' })).toBe('3 viên · 1 ct / sp')
    expect(formatStone3d({ qty: 4, stoneCount3d: 0, stoneWeight3dGram: '0' })).toBe('Không có đá')
    expect(formatStone3d({ qty: 4 })).toBeNull()
  })
})
