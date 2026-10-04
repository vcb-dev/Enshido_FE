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
export type MetalKindCode = 'SILVER' | 'GOLD' | 'STONE' | 'ALLOY' | 'COPPER'

export type LookupItem = {
  id: string
  code: string
  name: string
  metalKind?: MetalKindCode | 'OTHER' | null
  group?: string
}

export type InventoryLookups = {
  units: LookupItem[]
  materialTypes: LookupItem[]
  shapes: LookupItem[]
  colors: LookupItem[]
  suppliers?: LookupItem[]
  otherClasses?: LookupItem[]
  consumableCategories?: LookupItem[]
  bodyMetals?: LookupItem[]
  btpCategories?: LookupItem[]
  productKinds?: LookupItem[]
  platingColors?: LookupItem[]
  users?: DirectoryUser[]
}

export type DirectoryUser = {
  id: string
  username: string
  fullName: string
}

export type ClassificationCode = 'RAW_MATERIAL' | 'CONSUMABLE' | 'SEMI_FINISHED'

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
  /** Tồn thực / giữ chỗ / khả dụng — chỉ có ở danh sách tồn của kho. */
  onHandQty?: string
  heldQty?: string
  availableQty?: string
  ledgerMismatch?: boolean
  gramOnHand?: string | null
  gramBaseAt?: string | null
  priceLayers?: { qty: string; unitPrice: string; source?: 'opening' | 'inbound' }[]
  materialTypeId: string | null
  materialType: string | null
  otherClassId: string | null
  otherClass: string | null
  otherClassCode?: string | null
  otherClassParentId: string | null
  otherClassParent: string | null
  bodyMetalId: string | null
  bodyMetal: string | null
  productKindId: string | null
  productKind: string | null
  /** Màu xi (kho BTP). Màu đá dùng `colorId`. */
  platingColorId?: string | null
  platingColor?: string | null
  sizeLabel?: string | null
  stoneWeight?: string | null
  weight?: string | null
  images?: MaterialImage[]
  classificationCode: ClassificationCode
  classification: string
  metalKind: MetalKindCode | null
  metalKindLabel: string | null
  availability: AvailabilityCode
  availabilityLabel: string
}

export type MaterialImage = {
  url: string
  publicId: string
  width?: number | null
  height?: number | null
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

export function getWarehouseStockApi(code: string, opts?: { layers?: boolean }) {
  const query = opts?.layers ? '?layers=1' : ''
  return apiFetch<StockResponse>(`/warehouses/${code}/stock${query}`)
}

export function formatQty(value: string) {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
}

/**
 * Đá nhập / hiện trọng lượng theo ct (1 ct = 0,2 g); DB và phép tính hao hụt (cộng với bạc)
 * vẫn dùng g — quy đổi ngay ở ô nhập và lúc hiển thị.
 */
export const CT_PER_GRAM = 5

const STONE_UNITS = ['viên', 'vien', 'ct']

/** Mã là đá: loại Đá, hoặc đơn vị viên / ct (dữ liệu cũ gắn nhầm đá là Bạc). */
export function isStoneMaterial(material: { unit?: string | null; metalKind?: string | null }) {
  return (
    material.metalKind === 'STONE' || STONE_UNITS.includes((material.unit ?? '').trim().toLowerCase())
  )
}

const round4 = (n: number) => Math.round(n * 10000) / 10000

/** TL g (từ API) → ct, dạng số chuỗi để điền vào ô nhập. Trống / không hợp lệ → ''. */
export function gramToCt(gram: string | number | null | undefined) {
  if (gram == null || gram === '') return ''
  const n = Number(gram)
  return Number.isFinite(n) ? String(round4(n * CT_PER_GRAM)) : ''
}

/** TL ct (ô nhập) → g để gửi API. Trống giữ trống. */
export function ctToGram(ct: string | null | undefined) {
  if (ct == null || ct === '') return ''
  const n = Number(ct)
  return Number.isFinite(n) ? String(round4(n / CT_PER_GRAM)) : ''
}

/** Hiện TL đá: "1,25 ct" từ số g của API. */
export function formatCt(gram: string | number | null | undefined) {
  const ct = gramToCt(gram)
  return ct === '' ? '—' : `${formatQty(ct)} ct`
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

/**
 * Ô số lượng / trọng lượng hiển thị "." là phân cách nghìn và "," là thập phân (1.250,5).
 * Người dùng hay gõ "12.5" nên ký tự "." hoặc "," vừa gõ đều coi là dấu thập phân —
 * nếu để nguyên, "." bị bỏ và 12.5 thành 125. Đã có phần thập phân thì bỏ ký tự vừa gõ.
 */
export function typedDecimalAsComma(input: HTMLInputElement | HTMLTextAreaElement, typed: string | null) {
  const raw = input.value
  if (typed !== '.' && typed !== ',') return raw
  const caret = input.selectionStart ?? raw.length
  const before = raw.slice(0, Math.max(0, caret - 1))
  const after = raw.slice(caret)
  if (`${before}${after}`.includes(',')) return `${before}${after}`
  return `${before},${after}`
}

/**
 * Chuỗi dán vào ô số (Ctrl+V, tự điền): chỉ có đúng một dấu chấm và không có dấu phẩy thì
 * chấm là thập phân ("12.5", "100.000" → 100) — giống lúc gõ phím ".". Có dấu phẩy, hoặc
 * nhiều dấu chấm ("1.250.000"), thì giữ cách hiểu vi-VN (chấm ngăn nghìn).
 */
export function pastedQtyText(text: string) {
  const compact = text.trim().replace(/\s/g, '')
  if (compact.includes(',')) return compact
  const dots = compact.split('.').length - 1
  return dots === 1 ? compact.replace('.', ',') : compact
}

/** Dán vào ô số tại vị trí con trỏ; trả chuỗi số chuẩn mới cho state của ô. */
export function pasteIntoQty(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = input.selectionStart ?? input.value.length
  const end = input.selectionEnd ?? start
  return parseQtyInput(input.value.slice(0, start) + pastedQtyText(text) + input.value.slice(end))
}

/** Ô nhập gram: nhận biết qua nhãn có "(g)" để hiện số quy đổi kg. */
export function isGramLabel(label: unknown) {
  return typeof label === 'string' && /\(g\)/.test(label)
}

/**
 * Đọc lại số đã hiểu dưới ô gram: ≥ 1.000 g thì kèm kg để thấy ngay khi nhầm chấm/phẩy
 * ("100.000" là một trăm nghìn gam = 100 kg, không phải 100 g).
 */
export function gramReadout(canonical: string) {
  const n = Number(canonical)
  if (!canonical || !Number.isFinite(n) || n < 1000) return ''
  return `= ${formatQty(canonical)} g (${formatQty(String(n / 1000))} kg)`
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
  const day = value.slice(0, 10)
  const [y, m, d] = day.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

/** Ngày nhập phiếu: phiếu mới hiện cả giờ; phiếu cũ chỉ có ngày thì giữ dd/mm/yyyy. */
export function formatInboundDateTime(value: string | null | undefined) {
  if (!value) return '—'
  if (!value.includes('T')) return formatStockedDate(value)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return formatStockedDate(value)
  const utcMidnight =
    date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0
  if (utcMidnight) return formatStockedDate(value)
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
/**
 * Tồn thực = tồn đầu kỳ + phiếu nhập − phiếu xuất (đúng số BE dùng để chặn xuất); giữ chỗ = đá
 * đang giữ cho phiếu Vào đá chờ thủ kho xác nhận; khả dụng = thực − giữ chỗ. `ledgerMismatch`:
 * sổ tồn ghi khác tồn thực — cần kiểm kê.
 */
export type StockSnapshot = {
  onHandQty: string
  heldQty: string
  availableQty: string
  ledgerMismatch: boolean
  /** TL tồn (g): mã gram = tồn thực; mã khác = TL kho cân + nhập − xuất sau đó; null = chưa cân. */
  gramOnHand: string | null
  /** Lúc kho cân TL tồn gần nhất (mã không tính theo gram). */
  gramBaseAt: string | null
}

/** Dòng tóm tắt tồn khi chọn mã: "Khả dụng 1.507 viên · giữ chỗ 20 · sổ ghi 2.962 — cần kiểm kê". */
export function stockSummary(item: Partial<StockSnapshot> & { qty: string; unit: string }) {
  if (item.availableQty == null) return `Tồn ${formatQty(item.qty)} ${item.unit}`
  const parts = [`Khả dụng ${formatQty(item.availableQty)} ${item.unit}`]
  if (Number(item.heldQty) > 0) parts.push(`giữ chỗ ${formatQty(item.heldQty ?? '0')}`)
  if (item.ledgerMismatch) parts.push(`sổ ghi ${formatQty(item.qty)} — cần kiểm kê`)
  return parts.join(' · ')
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
  colorName?: string | null
  materialTypeId?: string | null
  classification?: ClassificationCode
  metalKind?: MetalKindCode | null
  otherClassName?: string | null
  otherClassId?: string | null
  bodyMetalId?: string | null
  productKindId?: string | null
  btpCategoryId?: string | null
  platingColorId?: string | null
  sizeLabel?: string | null
  stoneWeight?: string | null
  weight?: string | null
  images?: MaterialImage[]
  openingQty?: string
  /** TL tồn vừa cân (g) — lấy làm mốc TL tồn từ lúc lưu. Chỉ gửi khi kho vừa cân. */
  gramBase?: string | null
  openingAmount?: string
  stockUnitPrice?: string
  inQty?: string
  inAmount?: string
  outQty?: string
  outAmount?: string
  editReason?: string
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
  /** Trọng lượng nhập (g) — kho NVL chính; mã tính theo gram thì bằng SL. */
  gramQty?: string | null
  stockUnitPrice: string
  unitPrice: string
  amount: string
  note: string | null
  enteredBy: string | null
  supplierSku: string | null
  supplierId: string | null
  supplierName: string | null
  materialId: string | null
  sourceWarehouseCode?: string | null
  sourceWarehouseName?: string | null
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
  /** Trọng lượng nhập (g) — kho NVL chính; mã tính theo gram BE tự lấy bằng SL. */
  gramQty?: string | null
  stockUnitPrice?: string
  unitPrice?: string
  amount?: string
  note?: string
  supplierSku?: string
  supplierId?: string | null
  supplierName?: string
  applyToStock?: boolean
  locationCode?: string | null
  otherClassId?: string | null
  editReason?: string
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
  /** Số gram xuất — chỉ dùng ở Kho NVL chính. */
  gramQty: string | null
  stockUnitPrice: string
  inboundUnitPrice: string
  amount: string
  note: string | null
  issuedBy: string | null
  receivedBy: string | null
  receivedByUserId: string | null
  materialId: string | null
  /** Mã đơn sản xuất dùng NVL này. */
  productionOrderCode: string | null
  /** Phiếu do lên Đơn BTP tự tạo — chỉ sửa / xoá qua đơn. */
  autoIssued?: boolean
  destWarehouseCode?: string | null
  destWarehouseName?: string | null
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
  gramQty?: string | null
  stockUnitPrice?: string
  inboundUnitPrice?: string
  amount?: string
  note?: string
  issuedBy?: string
  receivedBy?: string
  receivedByUserId?: string | null
  applyToStock?: boolean
  /** Rỗng = bỏ gắn đơn. */
  productionOrderCode?: string | null
  destWarehouseCode?: string | null
  editReason?: string
}

export function getWarehouseOutboundsApi(code: string) {
  return apiFetch<OutboundResponse>(`/warehouses/${code}/outbounds`)
}

/** Phiếu xuất nháp: đá cấp cho khâu Vào đá — chưa trừ tồn, trừ vào khả dụng. */
export type OutboundDraftStatus = 'DRAFT' | 'POSTED' | 'VOID'

export type OutboundDraftRow = {
  id: string
  stt: number
  issuedAt: string
  name: string
  sku: string | null
  unit: string
  /** SL / TL gói còn đang giữ (đã trừ phần thợ trả giữa khâu). */
  qty: string
  gramQty: string | null
  stoneCount: number | null
  earlyReturnedWeight: string | null
  status: OutboundDraftStatus
  note: string | null
  createdByName: string
  orderCode: string
  ticketCode: string
  /** Thợ xin thêm (true) hay cấp lúc chỉ định thợ. */
  fromRequest: boolean
  /** Phiếu xuất thật khi thủ kho xác nhận. */
  posted: { stt: number; qty: string; gramQty: string | null } | null
  closedAt: string | null
  closedByName: string | null
}

export function getWarehouseOutboundDraftsApi(code: string) {
  return apiFetch<OutboundDraftRow[]>(`/warehouses/${code}/outbound-drafts`)
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
