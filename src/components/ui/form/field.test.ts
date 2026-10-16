import { describe, expect, it } from 'vitest'
import { isUserBlur } from './field'
import { errorPaths } from './useAppForm'

describe('isUserBlur', () => {
  it('blur thường tính là rời ô', () => {
    expect(isUserBlur({ relatedTarget: null }, null)).toBe(true)
  })

  it('ô autoFocus vừa gắn: bỏ qua blur do dialog chuyển focus, sau đó tính bình thường', () => {
    expect(isUserBlur({ relatedTarget: null }, Date.now())).toBe(false)
    expect(isUserBlur({ relatedTarget: null }, Date.now() - 1000)).toBe(true)
  })
})

describe('errorPaths', () => {
  it('lấy đường dẫn ô lỗi, kể cả trong mảng, bỏ lỗi root', () => {
    const errors = {
      qty: { type: 'required', message: 'Nhập SL' },
      lines: [undefined, { weight: { type: 'validate', message: 'Sai' } }],
      root: { message: 'Chọn đơn' },
    }
    expect(errorPaths(errors as never)).toEqual(['qty', 'lines.1.weight'])
  })
})
