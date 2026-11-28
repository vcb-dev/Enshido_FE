import type { XlsxSheet } from '../../dashboard/xlsx'

/** Một mã sản phẩm đọc từ file Excel khách gửi sửa. */
export type ImportedRepairLine = {
  productCode: string
  productName: string
  qty: number
  content: string
}

type Field = keyof ImportedRepairLine

export const REPAIR_IMPORT_HEADERS = ['Mã sản phẩm', 'Tên sản phẩm', 'Số lượng', 'Chi tiết sửa'] as const

const MAX_LENGTH: Record<Exclude<Field, 'qty'>, number> = { productCode: 100, productName: 300, content: 1000 }

/** Bỏ dấu, chữ thường, bỏ dấu * và ký tự lạ — so tiêu đề cột không phân biệt cách gõ. */
function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const HEADER_PATTERNS: Record<Field, RegExp> = {
  productCode: /^(ma|ma san pham|ma sp|ma hang|ma hang hoa|product code|sku)$/,
  productName: /^(ten|ten san pham|ten sp|ten hang|ten hang hoa|product name)$/,
  qty: /^(so luong|sl|qty)$/,
  content: /^(chi tiet|chi tiet sua|noi dung|noi dung sua|yeu cau|yeu cau sua)$/,
}

function headerColumns(row: string[]) {
  const columns: Partial<Record<Field, number>> = {}
  row.forEach((cell, index) => {
    const key = normalize(cell)
    for (const field of Object.keys(HEADER_PATTERNS) as Field[]) {
      if (columns[field] == null && HEADER_PATTERNS[field].test(key)) columns[field] = index
    }
  })
  return columns
}

/** "2", "2.0", "2,0" → 2; còn lại (âm, lẻ, chữ) → null. Ô trống tính là 1. */
function parseQty(raw: string) {
  const text = raw.replace(/\s/g, '').replace(',', '.')
  if (text === '') return 1
  const value = Number(text)
  return Number.isInteger(value) && value > 0 ? value : null
}

/**
 * Dòng Excel → các mã gửi sửa. Tìm dòng tiêu đề trong 10 dòng đầu (cần cột Chi tiết sửa và Mã hoặc
 * Tên sản phẩm), bỏ dòng trống. Có lỗi thì trả lỗi theo số dòng Excel, không lấy dòng nào.
 */
export function parseRepairImport(rows: string[][]): { lines: ImportedRepairLine[]; errors: string[] } {
  const headerIndex = rows.slice(0, 10).findIndex((row) => {
    const cols = headerColumns(row ?? [])
    return cols.content != null && (cols.productCode != null || cols.productName != null)
  })
  if (headerIndex < 0) {
    return {
      lines: [],
      errors: ['Không thấy dòng tiêu đề (Mã sản phẩm / Tên sản phẩm / Số lượng / Chi tiết sửa) — dùng file mẫu'],
    }
  }
  const cols = headerColumns(rows[headerIndex])
  const cell = (row: string[], field: Field) => {
    const index = cols[field]
    return index == null ? '' : String(row[index] ?? '').trim()
  }

  const lines: ImportedRepairLine[] = []
  const errors: string[] = []
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (!row || row.every((value) => String(value ?? '').trim() === '')) return
    const excelRow = headerIndex + offset + 2
    const productCode = cell(row, 'productCode')
    const productName = cell(row, 'productName')
    const content = cell(row, 'content')
    const qty = parseQty(cell(row, 'qty'))
    const problems: string[] = []
    if (!productCode && !productName) problems.push('thiếu mã hoặc tên sản phẩm')
    if (qty == null) problems.push('số lượng phải là số nguyên lớn hơn 0')
    if (!content) problems.push('thiếu chi tiết sửa')
    if (productCode.length > MAX_LENGTH.productCode) problems.push('mã sản phẩm quá 100 ký tự')
    if (productName.length > MAX_LENGTH.productName) problems.push('tên sản phẩm quá 300 ký tự')
    if (content.length > MAX_LENGTH.content) problems.push('chi tiết sửa quá 1000 ký tự')
    if (problems.length) {
      errors.push(`Dòng ${excelRow}: ${problems.join(', ')}`)
      return
    }
    lines.push({ productCode, productName, qty: qty!, content })
  })
  if (!lines.length && !errors.length) errors.push('File chưa có mã sản phẩm nào dưới dòng tiêu đề')
  return { lines: errors.length ? [] : lines, errors }
}

/** File mẫu: sheet nhập liệu + sheet hướng dẫn. */
export function repairImportTemplate(): XlsxSheet[] {
  return [
    {
      name: 'Hàng gửi sửa',
      rows: [REPAIR_IMPORT_HEADERS.map((title) => ({ value: title, style: 'bold' as const }))],
      widths: [20, 36, 12, 48],
    },
    {
      name: 'Hướng dẫn',
      rows: [
        [{ value: 'Cách điền', style: 'bold' }],
        ['Mỗi dòng một mã sản phẩm, điền ở sheet "Hàng gửi sửa", giữ nguyên dòng tiêu đề.'],
        ['Mã sản phẩm hoặc Tên sản phẩm: điền ít nhất một ô.'],
        ['Số lượng: số nguyên; bỏ trống tính là 1.'],
        ['Chi tiết sửa: bắt buộc, vd "Sửa thành size 5 và xi lại".'],
        ['Ngày, loại hàng, số phiếu sửa, người gửi sửa chọn trên màn hình sau khi tải file lên.'],
        ['Một lần gửi tối đa 200 mã.'],
      ],
      widths: [90],
    },
  ]
}
