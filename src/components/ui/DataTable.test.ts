import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable, type Column } from './DataTable'

type Order = { id: string; code: string; qty: number; subs: Array<{ code: string; qty: number }> }
type Sub = Order['subs'][number]

const ROWS: Order[] = [
  { id: 'o1', code: 'A002', qty: 1000, subs: [{ code: 'A002-1', qty: 200 }, { code: 'A002-2', qty: 400 }] },
  { id: 'o2', code: 'A003', qty: 50, subs: [] },
]

/** Render ra HTML tĩnh — môi trường test là node, không có DOM, nên đếm bằng chuỗi. */
function html(element: Parameters<typeof renderToStaticMarkup>[0]) {
  return renderToStaticMarkup(element)
}
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1
const bodyRows = (markup: string) => count(markup.slice(markup.indexOf('<tbody')), '<tr')

describe('DataTable — bảng không dùng dòng con vẫn như cũ', () => {
  const columns: Column<Order>[] = [
    { key: 'code', header: 'Mã' },
    { key: 'qty', header: 'SL', numeric: true },
  ]

  it('mỗi dòng một <tr>, có STT, không có mũi tên xổ', () => {
    const markup = html(createElement(DataTable<Order>, { columns, rows: ROWS, rowKey: (r) => r.id, showIndex: true }))
    expect(bodyRows(markup)).toBe(2)
    expect(markup).toContain('STT')
    expect(markup).toContain('A002')
    expect(markup).toContain('1000')
    expect(markup).not.toContain('aria-expanded')
    expect(markup).not.toContain('Xổ tất cả')
  })

  it('không bật STT thì không có cột đầu', () => {
    const markup = html(createElement(DataTable<Order>, { columns, rows: ROWS, rowKey: (r) => r.id }))
    expect(markup).not.toContain('STT')
  })
})

describe('DataTable — dòng con', () => {
  const columns: Column<Order, Sub>[] = [
    { key: 'code', header: 'Mã', renderSub: (sub) => `con:${sub.code}` },
    { key: 'qty', header: 'SL', numeric: true },
  ]
  const props = {
    columns,
    rows: ROWS,
    rowKey: (r: Order) => r.id,
    showIndex: true,
    subRows: { get: (r: Order) => r.subs, key: (s: Sub) => s.code, label: (n: number) => `${n} phiếu con` },
  }

  it('ban đầu thu gọn: chỉ có dòng cha, dòng con chưa vẽ', () => {
    const markup = html(createElement(DataTable<Order, Sub>, props))
    expect(bodyRows(markup)).toBe(2)
    expect(markup).not.toContain('con:A002-1')
  })

  it('chỉ dòng có con mới có mũi tên, kèm nhãn đếm cho trình đọc màn hình', () => {
    const markup = html(createElement(DataTable<Order, Sub>, props))
    expect(count(markup, 'aria-expanded="false"')).toBe(1)
    expect(markup).toContain('aria-label="Xem 2 phiếu con"')
  })

  it('tiêu đề có nút xổ tất cả, vẫn giữ chữ STT', () => {
    const markup = html(createElement(DataTable<Order, Sub>, props))
    expect(markup).toContain('aria-label="Xổ tất cả"')
    expect(markup).toContain('STT')
  })

  it('không trang nào có con thì không hiện nút xổ tất cả', () => {
    const markup = html(
      createElement(DataTable<Order, Sub>, { ...props, rows: [ROWS[1]] }),
    )
    expect(markup).not.toContain('Xổ tất cả')
    expect(markup).not.toContain('aria-expanded')
  })
})
