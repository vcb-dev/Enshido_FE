import { apiFetch } from './auth'

export type CastingNvlOption = {
  id: string
  sku: string
  name: string
  locationCode: string | null
  category: string | null
  materialType: string | null
  shape: string | null
  color: string | null
  unit: string
  sizeLabel: string | null
}

export type CastingOrderLine = {
  id: string
  materialId: string
  materialSku: string | null
  materialName: string
  locationCode: string | null
  category: string | null
  materialType: string | null
  shape: string | null
  color: string | null
  unit: string
  gramQty: string
}

export type CastingOrder = {
  id: string
  code: string
  moldCount: number
  lines: CastingOrderLine[]
  createdAt: string
}

export type CastingOrderList = {
  items: CastingOrder[]
  total: number
  page: number
  pageSize: number
}

export function listCastingOrdersApi(params: {
  sku?: string
  name?: string
  page: number
  pageSize: number
}) {
  const query = new URLSearchParams()
  if (params.sku) query.set('sku', params.sku)
  if (params.name) query.set('name', params.name)
  query.set('page', String(params.page))
  query.set('pageSize', String(params.pageSize))
  return apiFetch<CastingOrderList>(`/casting-orders?${query.toString()}`)
}

export function listCastingNvlOptionsApi() {
  return apiFetch<CastingNvlOption[]>('/casting-orders/nvl-options')
}

export type CastingOrderPayload = {
  code: string
  moldCount: number
  lines: { materialId: string; gramQty: string }[]
  editReason?: string
}

export function createCastingOrderApi(payload: CastingOrderPayload) {
  return apiFetch<CastingOrder>('/casting-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateCastingOrderApi(id: string, payload: CastingOrderPayload) {
  return apiFetch<CastingOrder>(`/casting-orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
