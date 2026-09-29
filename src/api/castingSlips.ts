import { apiFetch } from './auth'
import type { OrderImage } from './productionOrders'

export type CastingSlipImage = Pick<OrderImage, 'url' | 'publicId' | 'width' | 'height'>

export type CastingSlipOrderLine = {
  intakeOrderId: string
  code: string
  sxCode: string
  productName: string
  trackingCode: string | null
  qty: number
  status: string
  /** TL sáp (cây thông) của đơn lúc lên phiếu (g). */
  waxWeightGram: string
}

export type CastingSlip = {
  id: string
  code: string
  slipDate: string
  /** Tổng TL sáp giao = cộng các đơn trên phiếu. */
  waxWeightGram: string
  batchOrderCodes: string
  orders: CastingSlipOrderLine[]
  issueS999Gram: string | null
  issueMasterAlloyGram: string | null
  issueS925Gram: string | null
  issueTotalGram: string
  createdByName: string | null
  /** Bạc giao chưa dùng (trả kho) = giao − bạc đã dùng. */
  leftoverGram: string | null
  /** Tổng trả = cây thông sau đúc + bạc giao chưa dùng. */
  returnTotalGram: string | null
  /** Hao hụt đúc = bạc đã dùng − cây thông sau đúc. */
  castLossGram: string | null
  castLossPercent: string | null
  lastPrintedAt: string | null
  createdAt: string
  status: CastingSlipStatus
  startedAt: string | null
  startedByName: string | null
  /** Bước 9: TL cây thông sau đúc, bạc và thạch cao đã dùng (g). */
  castTreeWeightGram: string | null
  silverUsedGram: string | null
  plasterUsedGram: string | null
  submittedAt: string | null
  submittedByName: string | null
  confirmedAt: string | null
  confirmedByName: string | null
  /** Ảnh phiếu + vật tư lúc cấp (bước 7). */
  images: CastingSlipImage[]
  /** Ảnh cân cây thông sau đúc (bước 9). */
  resultImages: CastingSlipImage[]
}

export type CastingSlipStatus = 'PENDING_ISSUE' | 'WAIT_CASTING' | 'CASTING' | 'PENDING_CONFIRMATION' | 'DONE'

export type CastingSlipResultPayload = {
  castTreeWeightGram: number
  silverUsedGram: number
  plasterUsedGram: number
  images: CastingSlipImage[]
}

export type CastingSlipList = {
  items: CastingSlip[]
  total: number
  page: number
  pageSize: number
}

/** Đơn đã có sáp (E), chưa lên phiếu — thủ kho chọn để gom vào một lần đúc. */
export type CastingSlipCandidate = {
  id: string
  code: string
  sxCode: string
  productName: string
  trackingCode: string | null
  qty: number
  dueDate: string | null
  hasMold: boolean | null
  waxWeightGram: string | null
}

export type CreateCastingSlipPayload = {
  slipDate: string
  intakeOrderIds: string[]
  issueS999Gram?: number
  issueMasterAlloyGram?: number
  issueS925Gram?: number
}

export type ListCastingSlipsParams = {
  status?: CastingSlipStatus | ''
  search?: string
  slipDate?: string
  intakeCode?: string
  batchOrderCodes?: string
  waxWeight?: string
  issueTotal?: string
  page: number
  pageSize: number
}

export function listCastingSlipsApi(params: ListCastingSlipsParams) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.slipDate?.trim()) query.set('slipDate', params.slipDate.trim())
  if (params.intakeCode?.trim()) query.set('intakeCode', params.intakeCode.trim())
  if (params.batchOrderCodes?.trim()) query.set('batchOrderCodes', params.batchOrderCodes.trim())
  if (params.waxWeight?.trim()) query.set('waxWeight', params.waxWeight.trim())
  if (params.issueTotal?.trim()) query.set('issueTotal', params.issueTotal.trim())
  query.set('page', String(params.page))
  query.set('pageSize', String(params.pageSize))
  return apiFetch<CastingSlipList>(`/casting-slips?${query.toString()}`)
}

export function getCastingSlipApi(id: string) {
  return apiFetch<CastingSlip>(`/casting-slips/${id}`)
}

export function getCastingSlipByCodeApi(code: string) {
  return apiFetch<CastingSlip>(`/casting-slips/by-code/${encodeURIComponent(code)}`)
}

export function listCastingSlipCandidatesApi(search: string) {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
  return apiFetch<CastingSlipCandidate[]>(`/casting-slips/candidates${query}`)
}

export function createCastingSlipApi(payload: CreateCastingSlipPayload) {
  return apiFetch<CastingSlip>('/casting-slips', { method: 'POST', body: JSON.stringify(payload) })
}

/** Bước 7b: chụp ảnh phiếu + vật tư đã cấp, Lưu → đơn Chờ đúc. */
export function issueCastingSlipApi(id: string, images: CastingSlipImage[]) {
  return apiFetch<CastingSlip>(`/casting-slips/${id}/issue`, {
    method: 'POST',
    body: JSON.stringify({ images }),
  })
}

export function deleteCastingSlipApi(id: string) {
  return apiFetch<{ success: true }>(`/casting-slips/${id}`, { method: 'DELETE' })
}

export type CastingLossReport = {
  workers: {
    workerUserId: string | null
    workerName: string
    slipCount: number
    issuedGram: string
    usedGram: string
    castTreeGram: string
    lossGram: string
    lossPercent: string | null
  }[]
  slips: {
    id: string
    code: string
    confirmedAt: string | null
    workerName: string | null
    issuedGram: string
    leftoverGram: string | null
    castLossGram: string | null
    castLossPercent: string | null
  }[]
}

/** Hao hụt đúc theo thợ đúc — phiếu đã xác nhận Đúc xong, lọc theo ngày xác nhận. */
export function getCastingLossReportApi(params: { from?: string; to?: string }) {
  const query = new URLSearchParams()
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  return apiFetch<CastingLossReport>(`/casting-slips/loss-by-worker?${query.toString()}`)
}

export function markCastingSlipPrintedApi(id: string) {
  return apiFetch<{ success: true }>(`/casting-slips/${id}/printed`, { method: 'POST', body: '{}' })
}

export function startCastingSlipApi(id: string) {
  return apiFetch<CastingSlip>(`/casting-slips/${id}/start`, { method: 'POST', body: '{}' })
}

export function submitCastingSlipResultApi(id: string, payload: CastingSlipResultPayload) {
  return apiFetch<CastingSlip>(`/casting-slips/${id}/result`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function confirmCastingSlipApi(id: string) {
  return apiFetch<CastingSlip>(`/casting-slips/${id}/confirm`, { method: 'POST', body: '{}' })
}
