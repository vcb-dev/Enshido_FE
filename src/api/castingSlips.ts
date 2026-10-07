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
  /** Trạng thái lệnh SX thật (sau cắt: WAIT_FILING → …). */
  orderStatus?: string | null
  productionOrderCode: string | null
  /** Số liệu phôi đã cắt; có thể có trên phiếu cũ thiếu trọng lượng cây còn lại. */
  blankQty?: number | null
  blankWeightGram?: string | null
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
  estimateS999Gram: string | null
  estimateMasterAlloyGram: string | null
  estimateS925Gram: string | null
  estimateTotalGram: string
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
  restWeightGram: string | null
  cutLossGram: string | null
  restImages: CastingSlipImage[]
  rejectedAt: string | null
  rejectedByName: string | null
  redoOfSlipId: string | null
  /** Ảnh phiếu + vật tư lúc cấp (bước 7). */
  images: CastingSlipImage[]
  /** Ảnh cân cây thông sau đúc (bước 9). */
  resultImages: CastingSlipImage[]
  /** Phiếu làm lại sau lỗi đúc — hiển thị dưới phiếu cha trên bảng. */
  redos?: CastingSlip[]
}

export type CastingSlipStatus =
  | 'PENDING_ISSUE'
  | 'WAIT_CASTING'
  | 'CASTING'
  | 'PENDING_CONFIRMATION'
  | 'DONE'
  | 'CAST_FAILED'

export type CastingSlipResultPayload = {
  castTreeWeightGram: number
  silverUsedGram: number
  plasterUsedGram: number
  images: CastingSlipImage[]
}

export type ConfirmCastingSlipPayload = {
  blanks: Array<{
    intakeOrderId: string
    qty: number
    weightGram: number
    images: CastingSlipImage[]
  }>
  restWeightGram: number
  restMaterialId?: string | null
  restImages: CastingSlipImage[]
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

export type CastCastWorkerOption = {
  id: string
  fullName: string
  username: string
}

export type CreateCastingSlipPayload = {
  slipDate: string
  intakeOrderIds: string[]
  assignedUserId: string
  estimateS999Gram?: number
  estimateMasterAlloyGram?: number
  estimateS925Gram?: number
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
  awaitingCut?: boolean
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
  if (params.awaitingCut) query.set('awaitingCut', 'true')
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

export function listCastWorkersApi() {
  return apiFetch<CastCastWorkerOption[]>('/casting-slips/cast-workers')
}

export function createCastingSlipApi(payload: CreateCastingSlipPayload) {
  return apiFetch<CastingSlip>('/casting-slips', { method: 'POST', body: JSON.stringify(payload) })
}

/** Bước 7b: thực xuất (trống = ước tính) + ảnh phiếu, Lưu → đơn Chờ đúc. */
export function issueCastingSlipApi(
  id: string,
  payload: {
    images: CastingSlipImage[]
    issueS999Gram?: number
    issueMasterAlloyGram?: number
    issueS925Gram?: number
  },
) {
  return apiFetch<CastingSlip>(`/casting-slips/${id}/issue`, {
    method: 'POST',
    body: JSON.stringify(payload),
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
  return apiFetch<CastingSlip>(`/casting-slips/${id}/confirm`, {
    method: 'POST',
    body: '{}',
  })
}

/** Cắt cây thông sau Đúc xong — chia phôi, sinh lệnh SX Chờ nguội. */
export function cutCastingSlipApi(id: string, payload: ConfirmCastingSlipPayload) {
  return apiFetch<CastingSlip>(`/casting-slips/${id}/cut`, {
    method: 'POST',
    body: JSON.stringify({
      blanks: payload.blanks,
      restWeightGram: payload.restWeightGram,
      restMaterialId: payload.restMaterialId,
      restImages: payload.restImages,
    }),
  })
}

/** Mã NVL (gram, kho NVL chính) nhận phần cây còn lại lúc xác nhận đúc. */
export type RestMaterialOptions = {
  defaultName: string
  items: { id: string; sku: string | null; name: string }[]
}

export function listRestMaterialOptionsApi() {
  return apiFetch<RestMaterialOptions>('/casting-slips/rest-material-options')
}

/** Thủ kho báo lỗi đúc — trả về phiếu làm lại (Chờ đúc). */
export function rejectCastingSlipApi(id: string) {
  return apiFetch<CastingSlip>(`/casting-slips/${id}/reject-cast`, { method: 'POST', body: '{}' })
}

export type CutCastingSlipItem = ConfirmCastingSlipPayload & { slipId: string }

export function cutCastingSlipsApi(items: CutCastingSlipItem[]) {
  return apiFetch<CastingSlip[]>('/casting-slips/cut-many', {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}
