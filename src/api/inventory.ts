import { apiFetch } from './auth'

export type WarehouseNode = {
  id: string
  code: string
  name: string
  shortName: string
  description: string | null
  parentId: string | null
  sortOrder: number
  children?: WarehouseNode[]
}

export type AvailabilityCode = 'IN_STOCK' | 'LOW' | 'OUT_OF_STOCK'

export type LookupItem = {
  id: string
  code: string
  name: string
}

export type InventoryLookups = {
  units: LookupItem[]
  materialTypes: LookupItem[]
  shapes: LookupItem[]
  colors: LookupItem[]
  suppliers?: LookupItem[]
  users?: DirectoryUser[]
}

export type DirectoryUser = {
  id: string
  username: string
  fullName: string
}

export type ClassificationCode = 'RAW_MATERIAL' | 'CONSUMABLE' | 'SEMI_FINISHED'
export type MetalKindCode = 'SILVER' | 'GOLD' | 'STONE' | 'ALLOY' | 'COPPER'

export type StockRow = {
  id: string
  stt: number
  locationCode: string | null
  sku: string | null
  shapeId: string | null
  shape: string | null
  colorId: string | null
  color: string | null
  name: string
  note?: string | null
  unitId: string
  unit: string
  openingQty: string
  openingAmount: string
  stockUnitPrice: string
  /** Ngày bắt đầu tồn kho (YYYY-MM-DD): lần nhập đầu, hoặc ngày tạo NVL nếu chưa nhập. */
  stockedAt?: string | null
  inQty: string
  inAmount: string
  outQty: string
  outAmount: string
  qty: string
  amount: string
  priceLayers?: { qty: string; unitPrice: string; source?: 'opening' | 'inbound' }[]
  materialTypeId: string | null
  materialType: string | null
  classificationCode: ClassificationCode
  classification: string
  metalKind: MetalKindCode | null
  metalKindLabel: string | null
  availability: AvailabilityCode
  availabilityLabel: string
}

export type StockTotals = {
  openingQty: string
  openingAmount: string
  inQty: string
  inAmount: string
  outQty: string
  outAmount: string
  qty: string
  amount: string
}

export type StockResponse = {
  warehouse: WarehouseNode
  totals: StockTotals
  items: StockRow[]
}

export function listWarehousesApi() {
  return apiFetch<WarehouseNode[]>('/warehouses')
}

export function getWarehouseStockApi(code: string) {
  return apiFetch<StockResponse>(`/warehouses/${code}/stock`)
}

export function formatQty(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
}

export function qtyFromApi(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return String(n)
}

export function parseQtyInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const comma = trimmed.lastIndexOf(',')
  let intPart = trimmed
  let decPart: string | null = null
  if (comma >= 0) {
    intPart = trimmed.slice(0, comma)
    decPart = trimmed.slice(comma + 1).replace(/\D/g, '').slice(0, 4)
  }
  intPart = intPart.replace(/\D/g, '')
  if (!intPart && decPart == null) return ''
  if (decPart != null) return `${intPart || '0'}.${decPart}`
  return intPart
}

export function formatQtyInput(raw: string) {
  if (!raw) return ''
  const hasDot = raw.includes('.')
  const [intS = '0', decS] = raw.split('.')
  const intN = Number(intS)
  if (!Number.isFinite(intN)) return raw
  const intFmt = intN.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
  if (hasDot) return `${intFmt},${decS ?? ''}`
  return intFmt
}

export function formatMoney(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return n.toLocaleString('vi-VN')
}

export function formatPriceOrDash(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return '—'
  return formatMoney(value)
}

/** Giá trị tiền từ API về chuỗi chỉ có chữ số, dùng làm state của ô nhập. */
export function moneyDigitsFromApi(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return String(Math.round(n))
}

/** Bỏ mọi ký tự không phải chữ số khi người dùng gõ tiền. */
export function moneyDigitsFromInput(value: string) {
  return value.replace(/[^\d]/g, '')
}

/** Chuỗi chữ số về dạng có phân cách nghìn để hiển thị trong ô nhập. */
export function formatMoneyInput(value: string) {
  if (!value) return ''
  return formatMoney(value)
}

function parseYmd(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function formatStockedDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

/** Thời gian tồn tính từ ngày nhập đầu (hoặc ngày tạo NVL nếu chưa nhập). */
export function formatStockAge(value: string | null | undefined, now = new Date()) {
  const start = value ? parseYmd(value) : null
  if (!start) return { label: '—', since: '' }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let years = today.getFullYear() - start.getFullYear()
  let months = today.getMonth() - start.getMonth()
  let days = today.getDate() - start.getDate()
  if (days < 0) {
    months -= 1
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  const parts: string[] = []
  if (years) parts.push(`${years} năm`)
  if (months) parts.push(`${months} tháng`)
  if (!years && !months && days === 0) {
    return { label: 'Hôm nay', since: formatStockedDate(value) }
  }
  if (days || parts.length === 0) parts.push(`${days} ngày`)
  return { label: parts.join(' '), since: formatStockedDate(value) }
}

export function stockStatusFromQty(qty: string) {
  const n = Number(qty)
  if (!Number.isFinite(n) || n <= 0) {
    return { code: 'OUT_OF_STOCK' as const, label: 'Hết hàng' }
  }
  if (n < 5) return { code: 'LOW' as const, label: 'Sắp hết hàng' }
  return { code: 'IN_STOCK' as const, label: 'Còn' }
}
export function isQtyBalanced(row: Pick<StockRow, 'openingQty' | 'inQty' | 'outQty' | 'qty'>) {
  const left = Number(row.openingQty) + Number(row.inQty)
  const right = Number(row.outQty) + Number(row.qty)
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-6
}

export type UpdateStockPayload = {
  sortOrder?: number
  sku?: string
  locationCode?: string
  name?: string
  note?: string | null
  unitId?: string
  shapeId?: string | null
  colorId?: string | null
  materialTypeId?: string | null
  classification?: ClassificationCode
  metalKind?: MetalKindCode | null
  openingQty?: string
  openingAmount?: string
  stockUnitPrice?: string
  inQty?: string
  inAmount?: string
  outQty?: string
  outAmount?: string
  qty?: string
  amount?: string
}

export function getInventoryLookupsApi() {
  return apiFetch<InventoryLookups>('/inventory/lookups')
}

export function updateWarehouseStockApi(
  warehouseCode: string,
  materialId: string,
  payload: UpdateStockPayload,
) {
  return apiFetch<StockRow>(`/warehouses/${warehouseCode}/stock/${materialId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function createWarehouseStockApi(
  warehouseCode: string,
  payload: UpdateStockPayload,
) {
  return apiFetch<StockRow>(`/warehouses/${warehouseCode}/stock`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type InboundRow = {
  id: string
  stt: number
  receivedAt: string
  name: string
  sku: string | null
  unit: string
  unitId: string | null
  qty: string
  stockUnitPrice: string
  unitPrice: string
  amount: string
  note: string | null
  enteredBy: string | null
  supplierSku: string | null
  supplierId: string | null
  supplierName: string | null
  materialId: string | null
}

export type InboundTotals = {
  qty: string
  amount: string
}

export type InboundResponse = {
  warehouse: { id: string; code: string; name: string; shortName: string }
  totals: InboundTotals
  items: InboundRow[]
}

export type CreateInboundPayload = {
  receivedAt: string
  name: string
  sku?: string
  materialId?: string | null
  unitId?: string | null
  unitName?: string
  qty: string
  stockUnitPrice?: string
  unitPrice?: string
  amount?: string
  note?: string
  supplierSku?: string
  supplierId?: string | null
  supplierName?: string
  applyToStock?: boolean
  locationCode?: string | null
}

export function getWarehouseInboundsApi(code: string) {
  return apiFetch<InboundResponse>(`/warehouses/${code}/inbounds`)
}

export function createWarehouseInboundApi(code: string, payload: CreateInboundPayload) {
  return apiFetch<InboundRow>(`/warehouses/${code}/inbounds`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateWarehouseInboundApi(
  code: string,
  inboundId: string,
  payload: CreateInboundPayload,
) {
  return apiFetch<InboundRow>(`/warehouses/${code}/inbounds/${inboundId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteWarehouseInboundApi(code: string, inboundId: string) {
  return apiFetch<{ success: boolean }>(`/warehouses/${code}/inbounds/${inboundId}`, {
    method: 'DELETE',
  })
}

export type OutboundRow = {
  id: string
  stt: number
  issuedAt: string
  name: string
  sku: string | null
  unit: string
  unitId: string | null
  qty: string
  stockUnitPrice: string
  inboundUnitPrice: string
  amount: string
  note: string | null
  issuedBy: string | null
  receivedBy: string | null
  receivedByUserId: string | null
  materialId: string | null
  priceBreakdown?: { qty: string; unitPrice: string; source: 'opening' | 'inbound' }[]
}

export type OutboundTotals = {
  qty: string
  amount: string
}

export type OutboundResponse = {
  warehouse: { id: string; code: string; name: string; shortName: string }
  totals: OutboundTotals
  items: OutboundRow[]
}

export type CreateOutboundPayload = {
  issuedAt: string
  name: string
  sku?: string
  materialId?: string | null
  unitId?: string | null
  unitName?: string
  qty: string
  stockUnitPrice?: string
  inboundUnitPrice?: string
  amount?: string
  note?: string
  issuedBy?: string
  receivedBy?: string
  receivedByUserId?: string | null
  applyToStock?: boolean
}

export function getWarehouseOutboundsApi(code: string) {
  return apiFetch<OutboundResponse>(`/warehouses/${code}/outbounds`)
}

export function createWarehouseOutboundApi(code: string, payload: CreateOutboundPayload) {
  return apiFetch<OutboundRow>(`/warehouses/${code}/outbounds`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateWarehouseOutboundApi(
  code: string,
  outboundId: string,
  payload: CreateOutboundPayload,
) {
  return apiFetch<OutboundRow>(`/warehouses/${code}/outbounds/${outboundId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteWarehouseOutboundApi(code: string, outboundId: string) {
  return apiFetch<{ success: boolean }>(`/warehouses/${code}/outbounds/${outboundId}`, {
    method: 'DELETE',
  })
}
