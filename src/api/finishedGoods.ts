import { apiFetch } from './auth'
import type { AvailabilityCode, StockTotals } from './inventory'
import type { ProductionRequestType } from './productionOrders'

export type FinishedGoodsReceiptRow = {
  id: string
  orderCode: string
  description: string
  qtyUnit: string | null
  sizeLabel: string | null
  weight?: string | null
  mainMaterial: string | null
  imageUrl: string | null
  qty: string
  stockedQty: number
  pendingQty: number
  status: 'PENDING' | 'RECEIVED'
  unitPrice: string
  amount: string
  shippedQty: number
  remainingQty: number
  receivedAt: string
  receivedByName: string
  note: string | null
}

export type FinishedGoodsStockRow = {
  id: string
  orderCode: string
  /** Mã sản xuất trên lệnh / tồn đầu kỳ — hiển thị trên Tồn. */
  model3dCode: string | null
  description: string
  requestType: ProductionRequestType
  qtyUnit: string | null
  sizeLabel: string | null
  weight?: string | null
  mainMaterial: string | null
  platingColor: string | null
  imageUrl: string | null
  /** NVL cấu thành thành phẩm — nhiều mã xếp chồng trên bảng Tồn. */
  bomLines: FinishedGoodsNvlOption[]
  openingQty: string
  openingAmount: string
  inQty: string
  inAmount: string
  outQty: string
  outAmount: string
  qty: string
  amount: string
  receivedQty: number
  shippedQty: number
  remainingQty: number
  receivedAt: string
  receivedByName: string
  unitCost: string
  stockValue: string
  costWarnings: number
  availability: AvailabilityCode
  availabilityLabel: string
  /** true = tạo trên Tồn (đầu kỳ). false = phiếu tab Nhập. */
  isOpening?: boolean
}

/** Trạng thái kho (nhập/xuất) — khác trạng thái thành phẩm (còn / hết hàng). */
export type FgFlowStatus = 'WAITING_IN' | 'RECEIVED' | 'WAITING_OUT' | 'SHIPPED'

export const FG_FLOW_STATUS: Record<FgFlowStatus, { label: string; color: 'warning' | 'success' | 'info' | 'default' }> = {
  WAITING_IN: { label: 'Chờ nhập', color: 'warning' },
  RECEIVED: { label: 'Đã nhập', color: 'success' },
  WAITING_OUT: { label: 'Chờ xuất', color: 'info' },
  SHIPPED: { label: 'Đã xuất', color: 'default' },
}

export function fgFlowStatus(
  row: Pick<FinishedGoodsStockRow, 'qty' | 'shippedQty'>,
): FgFlowStatus {
  const remaining = Number(row.qty) || 0
  const shipped = Number(row.shippedQty) || 0
  if (remaining <= 0 && shipped > 0) return 'SHIPPED'
  if (remaining > 0 && shipped === 0) return 'RECEIVED'
  if (remaining > 0 && shipped > 0) return 'WAITING_OUT'
  return 'WAITING_IN'
}

export type ShipmentListLine = {
  id: string
  orderCode: string
  description: string
  sizeLabel: string | null
  mainMaterial: string | null
  qty: string
  unitPrice: string
  amount: string
  note: string | null
}

export type ShipmentListRow = {
  code: string
  shippedAt: string
  customerName: string
  paymentMethod: string | null
  note: string | null
  orderCodes: string[]
  qty: number
  amount: string
  costAmount: string
  createdByName: string
  createdAt: string
  autoIssued?: boolean
  lines: ShipmentListLine[]
}

export type ShipmentLine = {
  id: string
  orderCode: string
  description: string
  sizeLabel: string | null
  size: string | null
  mainMaterial: string | null
  imageUrl: string | null
  qty: number
  unitPrice: string
  amount: string
  /** Giá vốn chụp lúc lập / sửa phiếu. */
  unitCost: string
  costAmount: string
  note: string | null
}

export type ShipmentDetail = {
  code: string
  shippedAt: string
  customerName: string
  paymentMethod: string | null
  note: string | null
  autoIssued?: boolean
  createdByName: string
  createdAt: string
  updatedAt: string
  lastPrintedAt: string | null
  dataChangedAt: string
  lines: ShipmentLine[]
  totals: { qty: number; amount: string; costAmount: string }
}

export type ShipmentPayload = {
  shippedAt: string
  customerName: string
  paymentMethod?: string
  note?: string
  lines: Array<{ orderCode: string; qty: number; unitPrice: string; note?: string }>
  editReason?: string
}

const BASE = '/finished-goods'

function shipmentPath(code: string, suffix = '') {
  return `${BASE}/shipments/${encodeURIComponent(code)}${suffix}`
}

export function getFinishedGoodsStockApi(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<{ totals: StockTotals; items: FinishedGoodsStockRow[] }>(`${BASE}/stock${query}`)
}

export function listFinishedGoodsReceiptsApi(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<{ items: FinishedGoodsReceiptRow[] }>(`${BASE}/receipts${query}`)
}

export type FinishedGoodsOrderOption = {
  code: string
  description: string
  qty: number
  qtyUnit: string | null
  sizeLabel: string | null
  weight?: string | null
  mainMaterial: string | null
  /** Đã có trên tab Tồn — nhập thêm cộng vào dòng đó. */
  inStock?: boolean
  remainingQty?: number
}

export type FinishedGoodsNvlOption = {
  id: string
  sku: string | null
  name: string
  unit: string
  qty: string
  locationCode: string | null
  shape: string | null
  color: string | null
  materialType: string | null
  bodyMetal: string | null
  metalKind: string | null
  sizeLabel: string | null
  stoneWeight?: string | null
  weight?: string | null
  note: string | null
  imageUrl: string | null
}

export function listFinishedGoodsOrderOptionsApi(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<{ items: FinishedGoodsOrderOption[] }>(`${BASE}/order-options${query}`)
}

export function listFinishedGoodsNvlOptionsApi(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<{ items: FinishedGoodsNvlOption[] }>(`${BASE}/nvl-options${query}`)
}

export type UpsertReceiptPayload = {
  orderCode?: string
  description?: string
  mainMaterial?: string
  platingColor?: string
  stockUnitPrice?: string
  qty: number
  receivedAt: string
  sizeLabel?: string
  qtyUnit?: string
  model3dCode?: string
  editReason?: string
}

export function createFinishedGoodsReceiptApi(payload: UpsertReceiptPayload) {
  return apiFetch<{ success: boolean }>(`${BASE}/receipts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFinishedGoodsReceiptApi(id: string, payload: UpsertReceiptPayload) {
  return apiFetch<{ success: boolean }>(`${BASE}/receipts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

/** Kho xác nhận nhận hàng vào tồn. Bỏ trống `qty` là nhận hết phần đang chờ. */
export function receiveFinishedGoodsReceiptApi(id: string, qty?: number) {
  return apiFetch<{ success: boolean }>(`${BASE}/receipts/${encodeURIComponent(id)}/receive`, {
    method: 'POST',
    body: JSON.stringify(qty != null ? { qty } : {}),
  })
}

export function deleteFinishedGoodsReceiptApi(id: string) {
  return apiFetch<{ success: boolean }>(`${BASE}/receipts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function getFinishedGoodsLookupsApi() {
  return apiFetch<{ customers: string[]; paymentMethods: string[] }>(`${BASE}/lookups`)
}

export function listShipmentsApi(params: { search?: string; page: number; pageSize: number }) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  query.set('page', String(params.page))
  query.set('pageSize', String(params.pageSize))
  return apiFetch<{ total: number; items: ShipmentListRow[] }>(`${BASE}/shipments?${query.toString()}`)
}

const SHIPMENT_PAGE_SIZE = 200

export async function listAllShipmentsApi(search = '') {
  const first = await listShipmentsApi({ search, page: 1, pageSize: SHIPMENT_PAGE_SIZE })
  if (first.total <= first.items.length) return first
  const pages = Math.ceil(first.total / SHIPMENT_PAGE_SIZE)
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      listShipmentsApi({ search, page: index + 2, pageSize: SHIPMENT_PAGE_SIZE }),
    ),
  )
  return {
    total: first.total,
    items: first.items.concat(...rest.map((page) => page.items)),
  }
}

export function getShipmentApi(code: string) {
  return apiFetch<ShipmentDetail>(shipmentPath(code))
}

export function createShipmentApi(payload: ShipmentPayload) {
  return apiFetch<ShipmentDetail>(`${BASE}/shipments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateShipmentApi(code: string, payload: ShipmentPayload) {
  return apiFetch<ShipmentDetail>(shipmentPath(code), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteShipmentApi(code: string) {
  return apiFetch<{ success: boolean }>(shipmentPath(code), { method: 'DELETE' })
}

export function markShipmentPrintedApi(code: string) {
  return apiFetch<{ lastPrintedAt: string | null }>(shipmentPath(code, '/printed'), {
    method: 'POST',
    body: '{}',
  })
}
