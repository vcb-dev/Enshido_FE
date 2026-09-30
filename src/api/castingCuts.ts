import { apiFetch } from './auth'
import type { ProductionStatus } from './productionOrders'

export type CutImage = {
  url: string
  publicId: string
  width?: number | null
  height?: number | null
}

export type CastingCutLine = {
  id: string
  qty: number
  weight: string
  btpMaterial: { id: string; sku: string | null; name: string }
  images: CutImage[]
  order: {
    id: string
    code: string
    /** Mã đơn tạo (DH…) khi phiếu sản xuất sinh ra từ đơn tạo lúc cắt cây. */
    intakeCode: string | null
    status: ProductionStatus
    model3dCode: string | null
    description: string
    qty: number
    qtyUnit: string | null
    imageUrl: string | null
  }
}

export type CastingCut = {
  id: string
  code: string
  castingOrder: { id: string; code: string } | null
  /** Phiếu đúc (lệnh đúc bước 7–9) của cây thông. */
  castingSlip: { id: string; code: string } | null
  cutAt: string
  treeWeight: string
  restWeight: string
  blankWeight: string
  lossWeight: string
  restMaterial: { id: string; sku: string | null; name: string } | null
  restImages: CutImage[]
  note: string | null
  cutByName: string
  lastPrintedAt: string | null
  createdAt: string
  deletable: boolean
  lines: CastingCutLine[]
}

export type CastingCutList = {
  items: CastingCut[]
  total: number
  page: number
  pageSize: number
}

export type CutOrderOption = {
  /** `intake` = đơn tạo đã Đúc xong (H); `order` = phiếu sản xuất cũ tạo tay. */
  kind: 'intake' | 'order'
  id: string
  code: string
  status: string
  model3dCode: string | null
  description: string
  qty: number
  qtyUnit: string | null
  castingSentDate: string | null
  imageUrl: string | null
  /** TL cây thông sau đúc (tổng các phiếu đúc của đơn tạo) — gợi ý cho ô TL cây. */
  castTreeWeight: string | null
  /** Phiếu đúc của đơn tạo — các đơn chung phiếu thì chung một cây. */
  castingSlipCode: string | null
}

export type RestMaterialOptions = {
  defaultName: string
  items: { id: string; sku: string | null; name: string }[]
}

/** Phiếu đúc đã Đúc xong, chưa cắt — một phiếu là một cây thông. */
export type CutSlipOption = {
  id: string
  code: string
  slipDate: string
  castTreeWeight: string | null
  castByName: string | null
  orders: CutOrderOption[]
}

export type CastingOrderOption = { id: string; code: string; moldCount: number; createdAt: string }

export type CastingCutPayload = {
  castingOrderId: string | null
  castingSlipId: string | null
  cutAt: string
  treeWeight: string
  restWeight: string
  restMaterialId: string | null
  restImages: CutImage[]
  note: string | null
  lines: {
    orderId?: string
    intakeOrderId?: string
    qty: number
    weight: string
    images: CutImage[]
  }[]
}

export function listCastingCutsApi(params: { search?: string; page: number; pageSize: number }) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  query.set('page', String(params.page))
  query.set('pageSize', String(params.pageSize))
  return apiFetch<CastingCutList>(`/casting-cuts?${query.toString()}`)
}

export function getCastingCutApi(code: string) {
  return apiFetch<CastingCut>(`/casting-cuts/${encodeURIComponent(code)}`)
}

export function listCutOrderOptionsApi(search: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<CutOrderOption[]>(`/casting-cuts/order-options${query}`)
}

export function listRestMaterialOptionsApi() {
  return apiFetch<RestMaterialOptions>('/casting-cuts/rest-material-options')
}

export function listCutSlipOptionsApi() {
  return apiFetch<CutSlipOption[]>('/casting-cuts/casting-slip-options')
}

export function listCutCastingOrderOptionsApi() {
  return apiFetch<CastingOrderOption[]>('/casting-cuts/casting-order-options')
}

export function createCastingCutApi(payload: CastingCutPayload) {
  return apiFetch<CastingCut>('/casting-cuts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteCastingCutApi(code: string, reason: string) {
  return apiFetch<{ success: true }>(`/casting-cuts/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  })
}

export function markCastingCutPrintedApi(code: string) {
  return apiFetch<{ success: true }>(`/casting-cuts/${encodeURIComponent(code)}/printed`, {
    method: 'POST',
    body: '{}',
  })
}
