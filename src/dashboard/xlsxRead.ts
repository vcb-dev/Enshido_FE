/**
 * Đọc file Excel (.xlsx) ngay trên trình duyệt — không thêm thư viện. Chỉ lấy chữ / số của sheet
 * đầu tiên thành mảng dòng × cột (ô trống = ''). Zip giải nén bằng DecompressionStream có sẵn.
 * File .xls (Excel 97-2003) không đọc được — báo người dùng lưu lại dạng .xlsx.
 */

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50

type ZipEntry = { method: number; size: number; offset: number }

export class XlsxReadError extends Error {}

function listZipEntries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  // Bản ghi cuối zip nằm trong 22 + 65535 byte cuối (có thể kèm comment).
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new XlsxReadError('File không phải Excel .xlsx — mở file rồi lưu lại dạng .xlsx')
  const count = view.getUint16(eocd + 10, true)
  let pos = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder()
  const entries = new Map<string, ZipEntry>()
  for (let n = 0; n < count; n++) {
    if (view.getUint32(pos, true) !== CENTRAL_SIGNATURE) break
    const method = view.getUint16(pos + 10, true)
    const size = view.getUint32(pos + 20, true)
    const nameLength = view.getUint16(pos + 28, true)
    const extraLength = view.getUint16(pos + 30, true)
    const commentLength = view.getUint16(pos + 32, true)
    const offset = view.getUint32(pos + 42, true)
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength))
    entries.set(name, { method, size, offset })
    pos += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function readEntry(bytes: Uint8Array, entry: ZipEntry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true)
  const data = bytes.slice(start, start + entry.size)
  if (entry.method === 0) return new TextDecoder().decode(data)
  if (entry.method !== 8) throw new XlsxReadError('File Excel nén kiểu lạ — lưu lại file rồi thử lại')
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new TextDecoder().decode(await new Response(stream).arrayBuffer())
}

function decodeXml(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, code: string) => {
    const lower = code.toLowerCase()
    if (lower === 'amp') return '&'
    if (lower === 'lt') return '<'
    if (lower === 'gt') return '>'
    if (lower === 'quot') return '"'
    if (lower === 'apos') return "'"
    const point = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
    return Number.isFinite(point) ? String.fromCodePoint(point) : whole
  })
}

/** Ghép mọi đoạn <t> (chữ nhiều định dạng), bỏ phần phiên âm <rPh>. */
function textRuns(xml: string) {
  const plain = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  let out = ''
  for (const match of plain.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) out += match[1]
  return decodeXml(out)
}

function attr(attrs: string, name: string) {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1]
}

/** "B12" → cột 1 (0 = A). */
function columnIndex(ref: string) {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? ''
  let index = 0
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64)
  return index - 1
}

function parseSheet(xml: string, shared: string[]) {
  const rows: string[][] = []
  for (const rowMatch of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNumber = Number(attr(rowMatch[1], 'r'))
    const rowIndex = Number.isInteger(rowNumber) && rowNumber > 0 ? rowNumber - 1 : rows.length
    const cells: string[] = []
    let next = 0
    for (const cellMatch of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1]
      const body = cellMatch[2] ?? ''
      const ref = attr(attrs, 'r')
      const col = ref ? columnIndex(ref) : next
      next = col + 1
      const type = attr(attrs, 't')
      const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1]
      let value = ''
      if (type === 's') value = shared[Number(raw)] ?? ''
      else if (type === 'inlineStr') value = textRuns(body)
      else if (type === 'b') value = raw === '1' ? 'TRUE' : raw === '0' ? 'FALSE' : ''
      else value = raw != null ? decodeXml(raw) : ''
      while (cells.length < col) cells.push('')
      cells[col] = value
    }
    while (rows.length < rowIndex) rows.push([])
    rows[rowIndex] = cells
  }
  return rows
}

/** Đường dẫn sheet đầu tiên theo thứ tự trong workbook (không phải theo tên file). */
async function firstSheetPath(bytes: Uint8Array, entries: Map<string, ZipEntry>) {
  const workbook = entries.get('xl/workbook.xml')
  const rels = entries.get('xl/_rels/workbook.xml.rels')
  if (workbook && rels) {
    const sheetTag = /<sheet\b([^>]*)\/?>/.exec(await readEntry(bytes, workbook))?.[1]
    const relId = sheetTag ? attr(sheetTag, 'r:id') : undefined
    if (relId) {
      for (const match of (await readEntry(bytes, rels)).matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        if (attr(match[1], 'Id') !== relId) continue
        const target = attr(match[1], 'Target') ?? ''
        const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
        if (entries.has(path)) return path
      }
    }
  }
  return [...entries.keys()].filter((name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name)).sort()[0]
}

/** Sheet đầu tiên của file .xlsx → mảng dòng (index 0 = dòng 1 của Excel), mỗi ô là chữ. */
export async function readXlsxRows(data: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const entries = listZipEntries(bytes)
  const sheetPath = await firstSheetPath(bytes, entries)
  if (!sheetPath) throw new XlsxReadError('File Excel không có sheet nào')
  const sharedEntry = entries.get('xl/sharedStrings.xml')
  const shared = sharedEntry
    ? [...(await readEntry(bytes, sharedEntry)).matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((match) =>
        textRuns(match[1] ?? ''),
      )
    : []
  return parseSheet(await readEntry(bytes, entries.get(sheetPath)!), shared)
}
