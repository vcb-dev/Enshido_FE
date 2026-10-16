/** Cùng công thức với BE `shipment-weight.ts` — đổi một bên thì đổi cả hai. */
const BILLED_WEIGHT_RATIO = 0.95

/** TL tính tiền (g) của `qty` chiếc = TL bạc một chiếc (g) × SL × 0,95, làm tròn 2 số. */
export function gramOf(gramPerUnit: string | null | undefined, qty: number): string | null {
  if (gramPerUnit == null || !(qty > 0)) return null
  const value = Number(gramPerUnit) * qty * BILLED_WEIGHT_RATIO
  return Number.isFinite(value) ? (Math.round(value * 100) / 100).toString() : null
}

export type InvoiceInput = {
  weightGram: string
  materialUnitPrice: string
  laborAmount: string
  stoneAmount: string
  otherAmount: string
}

/** Thành tiền = TL (g) × đơn giá NL + tiền công + tiền đá + chi phí khác; ô trống tính 0. */
export function invoiceAmount(parts: InvoiceInput) {
  const n = (value: string) => Number(value) || 0
  return (
    Math.round(n(parts.weightGram) * n(parts.materialUnitPrice)) +
    n(parts.laborAmount) +
    n(parts.stoneAmount) +
    n(parts.otherAmount)
  )
}

/** Tên khoản hiện cho người lập phiếu — cùng thứ tự với cột trên form. */
export const INVOICE_FIELD_LABELS: Record<keyof InvoiceInput, string> = {
  weightGram: 'TL',
  materialUnitPrice: 'Đơn giá NL',
  laborAmount: 'Tiền công',
  stoneAmount: 'Tiền đá',
  otherAmount: 'Chi phí khác',
}

/** Chi phí khác không bắt buộc — trống là không có, tính 0. Khớp BE `invoiceComplete`. */
const REQUIRED_INVOICE_FIELDS: (keyof InvoiceInput)[] = ['weightGram', 'materialUnitPrice', 'laborAmount', 'stoneAmount']

/** Khoản bắt buộc còn để trống. "0" là đã nhập (khoản không có), chỉ chuỗi rỗng mới là thiếu. */
export function missingInvoiceFields(parts: InvoiceInput): (keyof InvoiceInput)[] {
  return REQUIRED_INVOICE_FIELDS.filter((key) => parts[key] === '')
}

export function invoiceComplete(parts: InvoiceInput) {
  return missingInvoiceFields(parts).length === 0
}

/** "33.25" → "33,25" để hiện / in. */
export function formatGram(value: string | null | undefined) {
  if (value == null || value === '') return '—'
  return Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}
