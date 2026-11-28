import { describe, expect, it } from 'vitest'
import { buildXlsx, crc32 } from './xlsx'
import { readXlsxRows, XlsxReadError } from './xlsxRead'

/** Zip nén deflate như Excel lưu — dựng tay cho test. */
async function zipDeflate(files: [string, string][]) {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [path, content] of files) {
    const name = encoder.encode(path)
    const raw = encoder.encode(content)
    const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    const data = new Uint8Array(await new Response(stream).arrayBuffer())
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(8, 8, true)
    lv.setUint32(14, crc32(raw), true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, 8, true)
    cv.setUint32(16, crc32(raw), true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    parts.push(local, data)
    centrals.push(central)
    offset += local.length + data.length
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  const all = [...parts, ...centrals, end]
  const out = new Uint8Array(all.reduce((sum, item) => sum + item.length, 0))
  let pos = 0
  for (const item of all) {
    out.set(item, pos)
    pos += item.length
  }
  return out
}

describe('readXlsxRows — đọc file Excel', () => {
  it('đọc lại file do buildXlsx ghi (không nén, chữ inline)', async () => {
    const file = buildXlsx([
      { name: 'Hàng', rows: [['Mã sản phẩm', 'Số lượng'], ['A&B <1>', 2], [null, 3]] },
      { name: 'Khác', rows: [['bỏ qua']] },
    ])
    expect(await readXlsxRows(file)).toEqual([
      ['Mã sản phẩm', 'Số lượng'],
      ['A&B <1>', '2'],
      ['', '3'],
    ])
  })

  it('file Excel thật: nén deflate, chuỗi dùng chung, sheet đầu theo workbook, ô bỏ cách, chữ nhiều định dạng', async () => {
    const file = await zipDeflate([
      [
        'xl/workbook.xml',
        '<workbook xmlns:r="r"><sheets><sheet name="Nhập" sheetId="1" r:id="rId7"/><sheet name="B" sheetId="2" r:id="rId1"/></sheets></workbook>',
      ],
      [
        'xl/_rels/workbook.xml.rels',
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId7" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
      ],
      [
        'xl/sharedStrings.xml',
        '<sst><si><t>Mã</t></si><si><r><t>Chi tiết </t></r><r><t xml:space="preserve">sửa</t></r><rPh><t>x</t></rPh></si><si/><si><t>Xi &amp; đánh bóng</t></si></sst>',
      ],
      ['xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1"><v>9</v></c></row></sheetData></worksheet>'],
      [
        'xl/worksheets/sheet2.xml',
        '<worksheet><sheetData><row r="2"><c r="A2" t="s"><v>0</v></c><c r="C2" t="s"><v>1</v></c></row><row r="3" spans="1:3"><c r="A3" t="str"><v>AB-1</v></c><c r="B3"/><c r="C3" t="s"><v>3</v></c></row></sheetData></worksheet>',
      ],
    ])
    expect(await readXlsxRows(file)).toEqual([[], ['Mã', '', 'Chi tiết sửa'], ['AB-1', '', 'Xi & đánh bóng']])
  })

  it('không phải file zip (vd .xls cũ) → báo lưu lại dạng .xlsx', async () => {
    await expect(readXlsxRows(new TextEncoder().encode('not a zip file at all, just text'))).rejects.toBeInstanceOf(
      XlsxReadError,
    )
  })
})
