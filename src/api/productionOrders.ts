import { apiFetch } from './auth'

export type ProductionStatus =
  | 'NEW'
  | 'REDO_3D'
  | 'CASTING'
  | 'FILING'
  | 'STONE_SETTING'
  | 'POLISH_PLATING'
  | 'FINISHING'
  | 'DELIVERED'
  | 'DEFECT'

/** Cột "Quá trình sản xuất" trên phiếu thợ. Khắc + Ngoại Quan thuộc trạng thái Hoàn thiện. */
export type StageCode = 'FILING' | 'STONE_SETTING' | 'POLISH_PLATING' | 'ENGRAVING' | 'APPEARANCE'

export type ProductionRequestType = 'SAMPLE' | 'RETAIL' | 'BULK'

/** Đơn NVL: làm từ đầu (3D → Đúc → khâu). Đơn BTP: lấy BTP có sẵn theo mã, bỏ 3D + Đúc. */
export type ProductionSource = 'NVL' | 'BTP'

export type ProductionImageKind = 'DETAIL' | 'PRODUCT'

export type OrderImage = {
  id?: string
  kind: ProductionImageKind
  url: string
  publicId: string
  width?: number | null
  height?: number | null
}

export type ProductionOrderRow = {
  id: string
  code: string
  status: ProductionStatus
  source: ProductionSource
  /** Mã BTP của Đơn BTP. */
  btpSku: string | null
  requestType: ProductionRequestType
  qty: number
  returnedQty: number
  model3dCode: string | null
  model3dUrl: string | null
  leadTime: string | null
  trackingCode: string | null
  closedBy: string
  description: string
  stoneColor: string | null
  stoneTypes: string[]
  size: string | null
  mainMaterial: string | null
  platingColor: string | null
  askedUserName: string | null
  receivedDate: string
  dueDate: string | null
  debtStatus: string | null
  createdAt: string
  updatedAt: string
  images: Array<{ id: string; kind: ProductionImageKind; url: string }>
}

export type ProductionOrderListResponse = {
  total: number
  statusCounts: Record<ProductionStatus | 'ALL', number>
  items: ProductionOrderRow[]
}

export type StageEntry = {
  id: string
  stage: StageCode
  attempt: number
  handedByName: string
  handedAt: string
  handedTotalWeight: string | null
  handedSilverWeight: string | null
  craftsmanUserId: string | null
  craftsmanName: string
  /** Người KCS — nhân viên cân lại bạc khi thợ nộp lại. */
  returnedByName: string | null
  returnedAt: string | null
  returnedTotalWeight: string | null
  returnedSilverWeight: string | null
  btpRecoveredWeight: string | null
  silverRecoveredWeight: string | null
  silverLoss: string | null
  silverLossPercent: string | null
  laborCost: string | null
  note: string | null
}

export type StatusLog = {
  id: string
  fromStatus: ProductionStatus | null
  toStatus: ProductionStatus
  note: string | null
  changedBy: string | null
  changedAt: string
}

export type ProductionOrderDetail = Omit<ProductionOrderRow, 'images'> & {
  btp: { id: string; sku: string | null; name: string } | null
  askedUserId: string | null
  sizeLabel: string | null
  stoneCount: number | null
  stoneWeight: string | null
  laserEngraving: string | null
  otherRequirements: string | null
  castingSentDate: string | null
  castingReturnedDate: string | null
  parentCode: string | null
  split: { no: number; total: number }
  children: Array<{ code: string; status: ProductionStatus }>
  /** Số dòng phiếu xuất NVL đang gắn đơn. */
  linkedOutbounds: number
  finishedGoods: {
    qty: number
    receivedAt: string
    receivedByName: string
    shippedQty: number
    remainingQty: number
    shipments: Array<{ code: string; shippedAt: string; customerName: string; qty: number }>
  } | null
  lastPrintedAt: string | null
  dataChangedAt: string
  createdBy: string | null
  images: Array<OrderImage & { id: string }>
  stages: StageEntry[]
  statusLogs: StatusLog[]
}

export type ProductionOrderLookups = {
  users: Array<{ id: string; username: string; fullName: string }>
  closers: string[]
  stoneTypes: string[]
  leadTimes: string[]
  debtStatuses: string[]
}

export type ProductionOrderListParams = {
  status?: ProductionStatus | ''
  requestType?: ProductionRequestType | ''
  source?: ProductionSource | ''
  search?: string
  page: number
  pageSize: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export type UpsertProductionOrderPayload = {
  source: ProductionSource
  btpMaterialId?: string | null
  requestType: ProductionRequestType
  receivedDate: string
  closedBy: string
  description: string
  qty: number
  model3dCode?: string
  model3dUrl?: string | null
  leadTime?: string
  trackingCode?: string
  stoneColor?: string
  stoneTypes?: string[]
  dueDate?: string | null
  size?: string
  sizeLabel?: string
  stoneCount?: number | null
  stoneWeight?: string | null
  laserEngraving?: string
  otherRequirements?: string
  mainMaterial?: string
  platingColor?: string
  askedUserId?: string | null
  debtStatus?: string
  parentCode?: string
  images: OrderImage[]
}

export type HandoverPayload = {
  craftsmanUserId: string
  handedAt: string
  handedTotalWeight?: string | null
  handedSilverWeight: string
  note?: string
}

export type ReturnPayload = {
  returnedAt: string
  laborCost?: string | null
  returnedTotalWeight?: string | null
  returnedSilverWeight: string
  btpRecoveredWeight?: string | null
  silverRecoveredWeight?: string | null
  note?: string
}

export type CastingPayload = { sentDate: string; returnedDate?: string | null }

export type OrderOption = { code: string; description: string; status: ProductionStatus }

/** BTP còn tồn, kèm thông tin điền sẵn vào Đơn BTP. */
export type BtpOption = {
  id: string
  sku: string | null
  name: string
  unit: string
  qty: string
  bodyMetal: string | null
  productKind: string | null
  category: string | null
  platingColor: string | null
  stoneColor: string | null
  sizeLabel: string | null
  images: Array<{ url: string; publicId: string; width: number | null; height: number | null }>
}

export type OrderCosting = {
  qty: number
  materials: Array<{
    id: string
    issuedAt: string
    warehouseCode: string
    warehouseName: string
    name: string
    sku: string | null
    qty: string
    unit: string
    unitPrice: string
    amount: string
    isSilver: boolean
  }>
  materialTotal: string
  silver: { grams: string; amount: string; unitPrice: string | null }
  recovered: { grams: string; amount: string }
  silverLoss: { grams: string; amount: string | null }
  labor: Array<{
    stageEntryId: string
    stage: StageCode
    stageLabel: string
    attempt: number
    craftsmanName: string
    amount: string
  }>
  laborTotal: string
  others: Array<{
    id: string
    name: string
    amount: string
    note: string | null
    createdByName: string | null
    createdAt: string
  }>
  otherTotal: string
  total: string
  unitCost: string
  warnings: string[]
}

export type OrderCostPayload = { name: string; amount: string; note?: string }

const BASE = '/production-orders'

function orderPath(code: string, suffix = '') {
  return `${BASE}/${encodeURIComponent(code)}${suffix}`
}

export function listProductionOrdersApi(params: ProductionOrderListParams) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  return apiFetch<ProductionOrderListResponse>(`${BASE}?${query.toString()}`)
}

export function getProductionOrderLookupsApi() {
  return apiFetch<ProductionOrderLookups>(`${BASE}/lookups`)
}

export function getProductionOrderApi(code: string) {
  return apiFetch<ProductionOrderDetail>(orderPath(code))
}

export function createProductionOrderApi(payload: UpsertProductionOrderPayload) {
  return apiFetch<ProductionOrderDetail>(BASE, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProductionOrderApi(code: string, payload: UpsertProductionOrderPayload) {
  return apiFetch<ProductionOrderDetail>(orderPath(code), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteProductionOrderApi(code: string) {
  return apiFetch<{ success: boolean }>(orderPath(code), { method: 'DELETE' })
}

export function changeProductionStatusApi(
  code: string,
  payload: { status: ProductionStatus; note?: string },
) {
  return apiFetch<ProductionOrderDetail>(orderPath(code, '/status'), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function updateCastingApi(code: string, payload: CastingPayload) {
  return apiFetch<ProductionOrderDetail>(orderPath(code, '/casting'), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

/** Giao khâu cho thợ — người giao là tài khoản đăng nhập. */
export function startStageApi(code: string, payload: HandoverPayload & { stage: StageCode }) {
  return apiFetch<ProductionOrderDetail>(orderPath(code, '/stages'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateHandoverApi(code: string, stageId: string, payload: HandoverPayload) {
  return apiFetch<ProductionOrderDetail>(orderPath(code, `/stages/${stageId}`), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

/** KCS nhận lại và cân bạc — người KCS là tài khoản đăng nhập. */
export function returnStageApi(code: string, stageId: string, payload: ReturnPayload) {
  return apiFetch<ProductionOrderDetail>(orderPath(code, `/stages/${stageId}/return`), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function undoReturnApi(code: string, stageId: string) {
  return apiFetch<ProductionOrderDetail>(orderPath(code, `/stages/${stageId}/return`), {
    method: 'DELETE',
  })
}

export function markTicketPrintedApi(code: string) {
  return apiFetch<{ lastPrintedAt: string | null }>(orderPath(code, '/printed'), {
    method: 'POST',
    body: '{}',
  })
}

/** Đơn chưa giao cho ô chọn "Mã đơn SX" ở phiếu xuất NVL. */
export function listOrderOptionsApi(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<OrderOption[]>(`${BASE}/options${query}`)
}

export function listBtpOptionsApi(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<BtpOption[]>(`${BASE}/btp-options${query}`)
}

export function getOrderCostingApi(code: string) {
  return apiFetch<OrderCosting>(orderPath(code, '/costing'))
}

export function addOrderCostApi(code: string, payload: OrderCostPayload) {
  return apiFetch<{ success: boolean }>(orderPath(code, '/costs'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateOrderCostApi(code: string, costId: string, payload: OrderCostPayload) {
  return apiFetch<{ success: boolean }>(orderPath(code, `/costs/${costId}`), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteOrderCostApi(code: string, costId: string) {
  return apiFetch<{ success: boolean }>(orderPath(code, `/costs/${costId}`), { method: 'DELETE' })
}
