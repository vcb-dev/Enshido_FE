import { describe, expect, it } from 'vitest'
import { consumableCategoryIdOf } from './catalog'

const categories = [
  { id: 'oc-ccdc', code: 'ccdc' },
  { id: 'oc-phu', code: 'nvl-phu' },
]
const types = [
  { id: 'mt-ccdc', code: 'ccdc' },
  { id: 'mt-phu', code: 'nvl-phu' },
]

describe('consumableCategoryIdOf', () => {
  it('giữ otherClass nếu đã là danh mục tiêu hao', () => {
    expect(
      consumableCategoryIdOf({ otherClassId: 'oc-phu' }, categories, types),
    ).toBe('oc-phu')
  })

  it('map materialType cũ ccdc/nvl-phu sang otherClass', () => {
    expect(
      consumableCategoryIdOf({ materialTypeId: 'mt-ccdc' }, categories, types),
    ).toBe('oc-ccdc')
  })
})
