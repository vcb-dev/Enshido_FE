import { describe, expect, it } from 'vitest'
import {
  codeSortedProductionWindow,
  intakeCodeNumber,
  mergeCodeSortedPage,
  sortByOrderCode,
} from './orderCodeSort'

type Row = { code: string | null }
const key = (row: Row) => intakeCodeNumber(row.code)
const rows = (...codes: Array<string | null>) => codes.map((code) => ({ code }))

/** Giả lập BE: lệnh SX sắp sẵn, trả đoạn [offset, offset + take). */
function pageCodes(
  page: number,
  pageSize: number,
  dir: 'asc' | 'desc',
  intakeCodes: string[],
  productionCodes: Array<string | null>,
) {
  const intake = sortByOrderCode(rows(...intakeCodes), key, dir)
  const allProduction = sortByOrderCode(rows(...productionCodes), key, dir)
  const { prodStart, prodTake } = codeSortedProductionWindow(page, pageSize, intake.length)
  const merged = mergeCodeSortedPage({
    page,
    pageSize,
    dir,
    intake,
    intakeKey: key,
    production: allProduction.slice(prodStart, prodStart + prodTake),
    productionKey: key,
    prodStart,
  })
  return merged.map((item) => `${item.kind === 'intake' ? 'i' : 'p'}:${item.row.code}`)
}

describe('sắp theo mã đơn hàng', () => {
  it('đọc số DH, đơn không có DH là null', () => {
    expect(intakeCodeNumber('DH012')).toBe(12)
    expect(intakeCodeNumber('DH1234')).toBe(1234)
    expect(intakeCodeNumber('A012')).toBeNull()
    expect(intakeCodeNumber(null)).toBeNull()
  })

  it('đơn không có DH luôn xếp cuối cả hai chiều', () => {
    const list = rows(null, 'DH002', 'DH010', 'DH001')
    expect(sortByOrderCode(list, key, 'asc').map((r) => r.code)).toEqual(['DH001', 'DH002', 'DH010', null])
    expect(sortByOrderCode(list, key, 'desc').map((r) => r.code)).toEqual(['DH010', 'DH002', 'DH001', null])
  })

  const intakeCodes = ['DH003', 'DH007', 'DH008']
  const productionCodes = ['DH001', 'DH002', 'DH004', 'DH005', 'DH006', 'DH009', null]

  it('trộn đơn tạo xen giữa lệnh SX theo đúng thứ tự, mọi trang', () => {
    const asc = [1, 2, 3, 4].flatMap((page) => pageCodes(page, 3, 'asc', intakeCodes, productionCodes))
    expect(asc).toEqual([
      'p:DH001', 'p:DH002', 'i:DH003',
      'p:DH004', 'p:DH005', 'p:DH006',
      'i:DH007', 'i:DH008', 'p:DH009',
      'p:null',
    ])
    const desc = [1, 2, 3, 4].flatMap((page) => pageCodes(page, 3, 'desc', intakeCodes, productionCodes))
    expect(desc).toEqual([
      'p:DH009', 'i:DH008', 'i:DH007',
      'p:DH006', 'p:DH005', 'p:DH004',
      'i:DH003', 'p:DH002', 'p:DH001',
      'p:null',
    ])
  })

  it('trang sau khi hết lệnh SX vẫn còn đơn tạo', () => {
    expect(pageCodes(2, 2, 'asc', ['DH005', 'DH006', 'DH007'], ['DH001'])).toEqual(['i:DH006', 'i:DH007'])
  })
})
