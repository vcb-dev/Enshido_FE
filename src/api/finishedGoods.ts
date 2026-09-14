import { apiFetch } from './auth'
import type { ProductionRequestType } from './productionOrders'

export type FinishedGoodsStockRow = {
  orderCode: string
  description: string
  requestType: ProductionRequestType
  sizeLabel: string | null
  mainMaterial: string | null
  imageUrl: string | null
  receivedQty: number
  shippedQty: number
  remainingQty: number
  receivedAt: string
  receivedByName: string
  /** Giá vốn / sản phẩm theo chi phí hiện tại của đơn. */
  unitCost: string
  stockValue: string
  costWarnings: number
}

export type ShipmentListRow = {
  code: string
  shippedAt: string
  customerName: string
  paymentMethod: string | null
  orderCodes: string[]
  qty: number
  amount: string
  costAmount: string
  createdByName: string
  createdAt: string
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
}

const BASE = '/finished-goods'

function shipmentPath(code: string, suffix = '') {
  return `${BASE}/shipments/${encodeURIComponent(code)}${suffix}`
}

export function getFinishedGoodsStockApi(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<{ items: FinishedGoodsStockRow[] }>(`${BASE}/stock${query}`)
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
