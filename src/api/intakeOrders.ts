import { apiFetch } from './auth'
import type { OrderImage, ProductionRequestType } from './productionOrders'

export type { ProductionRequestType }

export type IntakeOrderStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'READY_FOR_PRODUCTION'
  | 'WAX_PRINTED'
  | 'PENDING_WAREHOUSE_CONFIRMATION'
  | 'WAX_CONFIRMED'
  | 'WAIT_CASTING'
  | 'CASTING'
  | 'CAST_PENDING_CONFIRMATION'
  | 'CAST_DONE'
  | 'WAIT_COOLING'
  | 'REJECTED'
  | 'NEW'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type IntakeOrder = {
  id: string
  code: string
  /** Mã lệnh SX (random) — cột Mã SX trên Lệnh sản xuất. */
  sxCode: string
  status: IntakeOrderStatus
  requestType: ProductionRequestType
  productName: string
  qty: number
  trackingCode: string | null
  placedBy: string
  description: string
  createdDate: string
  dueDate: string | null
  /** null = chưa duyệt; false = cần 3D; true = đã có khuôn. */
  hasMold: boolean | null
  model3dUrl: string | null
  productWeightGram: string | null
  /** Đá theo file 3D (cả đơn); 0 viên = không có đá. */
  stoneCount3d?: number | null
  stoneWeight3dGram?: string | null
  castingTreeWeightGram: string | null
  /** Bước 5–6: TL thủ kho cân kiểm (nếu nhập); không có thì dùng số thợ báo. */
  waxCheckedWeightGram: string | null
  waxCheckedByName: string | null
  /** Bước 2 từ chối đơn: lý do (tuỳ chọn), người và lúc từ chối. */
  rejectReason?: string | null
  rejectedByName?: string | null
  rejectedAt?: string | null
  /** Phiếu đúc đang giữ đơn (kể cả phiếu chưa cấp vật tư). */
  castingSlip?: { code: string; status: string } | null
  /** Mã A… của cùng phiếu; trả về khi đã cắt cây và chuyển sang Nguội. */
  productionOrderCode?: string | null
  createdAt: string
  images: OrderImage[]
}

export type IntakeOrderList = {
  items: IntakeOrder[]
  total: number
  page: number
  pageSize: number
}

export type UpsertIntakeOrderPayload = {
  requestType: ProductionRequestType
  productName: string
  qty: number
  trackingCode?: string | null
  placedBy: string
  description: string
  createdDate: string
  dueDate?: string | null
  status?: IntakeOrderStatus
  images: OrderImage[]
  editReason?: string
}

export function listIntakeOrdersApi(params: {
  status?: IntakeOrderStatus | ''
  unlinkedOnly?: boolean
  requestType?: ProductionRequestType | ''
  search?: string
  page: number
  pageSize: number
}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.unlinkedOnly) query.set('unlinkedOnly', 'true')
  if (params.requestType) query.set('requestType', params.requestType)
  if (params.search?.trim()) query.set('search', params.search.trim())
  query.set('page', String(params.page))
  query.set('pageSize', String(params.pageSize))
  return apiFetch<IntakeOrderList>(`/intake-orders?${query.toString()}`)
}

export type IntakePipelineCounts = Partial<Record<IntakeOrderStatus, number>>

export function getIntakePipelineCountsApi() {
  return apiFetch<IntakePipelineCounts>('/intake-orders/pipeline-counts')
}

export type IntakePipelineLists = Partial<Record<IntakeOrderStatus, IntakeOrderList>>

export function getIntakePipelineListsApi(params: {
  requestType?: ProductionRequestType | ''
  search?: string
  pageSize?: number
}) {
  const query = new URLSearchParams()
  if (params.requestType) query.set('requestType', params.requestType)
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize))
  return apiFetch<IntakePipelineLists>(`/intake-orders/pipeline-lists?${query.toString()}`)
}

export function createIntakeOrderApi(payload: UpsertIntakeOrderPayload) {
  return apiFetch<IntakeOrder>('/intake-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateIntakeOrderApi(id: string, payload: UpsertIntakeOrderPayload) {
  return apiFetch<IntakeOrder>(`/intake-orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteIntakeOrderApi(id: string) {
  return apiFetch<{ success: boolean }>(`/intake-orders/${id}`, { method: 'DELETE' })
}

export function approveIntakeOrderApi(id: string, payload: { hasMold: boolean }) {
  return apiFetch<IntakeOrder>(`/intake-orders/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function rejectIntakeOrderApi(id: string, payload: { reason?: string }) {
  return apiFetch<IntakeOrder>(`/intake-orders/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function attachIntakeModel3dApi(
  id: string,
  payload: { model3dUrl: string; stoneCount3d?: number | null; stoneWeight3dGram?: number | null },
) {
  return apiFetch<IntakeOrder>(`/intake-orders/${id}/model-3d`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function submitIntakeProductSpecsApi(
  id: string,
  payload: {
    productWeightGram: number
    castingTreeWeightGram?: number
    images: OrderImage[]
    stoneCount3d?: number | null
    stoneWeight3dGram?: number | null
  },
) {
  return apiFetch<IntakeOrder>(`/intake-orders/${id}/product-specs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function confirmIntakeWarehouseApi(id: string, checkedWeightGram?: number) {
  return apiFetch<IntakeOrder>(`/intake-orders/${id}/confirm-warehouse`, {
    method: 'POST',
    body: JSON.stringify(checkedWeightGram != null ? { checkedWeightGram } : {}),
  })
}

/** Bước 4: in sáp nhiều đơn một lần — ảnh cả khay + cân nặng từng đơn. */
export function waxPrintBatchApi(payload: {
  items: { id: string; productWeightGram: number }[]
  images: OrderImage[]
}) {
  return apiFetch<{ items: IntakeOrder[] }>('/intake-orders/wax-print', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function submitIntakeCastingTreeSpecsApi(
  id: string,
  payload: { castingTreeWeightGram: number; images: OrderImage[] },
) {
  return apiFetch<IntakeOrder>(`/intake-orders/${id}/casting-tree-specs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Bước 4: một lượt in sáp nhiều đơn — ảnh cả khay + cân nặng từng đơn. */
export function submitIntakeWaxPrintBatchApi(payload: {
  items: { id: string; productWeightGram: number }[]
  images: OrderImage[]
}) {
  return apiFetch<{ count: number }>('/intake-orders/wax-print-batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
