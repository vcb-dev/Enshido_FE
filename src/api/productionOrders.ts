import { apiFetch } from './auth'

export type ProductionStatus =
  | 'NEW'
  | 'REDO_3D'
  | 'CASTING'
  | 'FILING'
  | 'STONE_SETTING'
  | 'ENGRAVING'
  | 'POLISHING'
  | 'PLATING'
  | 'DEFECT'
  | 'FINISHING'
  | 'DELIVERED'

/** Khâu giao thợ trên phiếu. Lỗi / Hoàn thiện là kết cục cuối phiếu, không phải khâu. */
export type StageCode = 'FILING' | 'STONE_SETTING' | 'ENGRAVING' | 'POLISHING' | 'PLATING'

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
  /** Phiếu con của thợ; null = khâu giao cho cả đơn. */
  subTicketId: string | null
  subTicketNo: number | null
  stage: StageCode
  attempt: number
  handedByName: string
  handedAt: string
  /** Số lượng sản phẩm giao cho thợ (đơn cũ chưa ghi thì null). */
  handedQty: number | null
  handedSilverWeight: string | null
  craftsmanUserId: string | null
  craftsmanName: string
  /** Thợ bấm "Đã làm xong" lúc nào; null là chưa báo. */
  submittedAt: string | null
  submittedByName: string | null
  /** Người KCS — nhân viên cân lại bạc khi thợ nộp lại. */
  returnedByName: string | null
  returnedAt: string | null
  /** Số lượng KCS nhận lại — ít hơn số giao khi có hàng hỏng ở khâu. */
  returnedQty: number | null
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

/**
 * Phiếu con đang ở đâu trong khâu hiện tại: chờ mở khâu · chờ thợ nhận ·
 * thợ đã nhận (chờ người giao xác nhận) · đang làm (chờ KCS nhận lại).
 */
export type SubTicketState =
  | 'IDLE'
  | 'WAITING'
  | 'CLAIMED'
  | 'WORKING'
  /** Thợ đã báo làm xong, chờ KCS cân lại. */
  | 'SUBMITTED'
  | 'DEFECT'
  | 'FINISH'

/** Hai nhánh kết thúc một phiếu con — cùng bộ với hai cột cuối phiếu thợ. */
export type SubTicketOutcome = 'DEFECT' | 'FINISH'

export type SubTicket = {
  id: string
  no: number
  /** Mã phiếu con, vd A012-1. */
  code: string
  qty: number
  silverWeight: string
  note: string | null
  state: SubTicketState
  /** Khâu đang chờ nhận hoặc đang làm. */
  activeStage: StageCode | null
  pendingStage: StageCode | null
  pendingAt: string | null
  pendingByName: string | null
  claimedByUserId: string | null
  claimedByName: string | null
  claimedAt: string | null
  /** Khâu đang giao cho thợ, chờ KCS nhận lại. */
  openEntryId: string | null
  entryCount: number
  /** Số lượng / gram đang có để giao khâu sau (theo lần KCS nhận lại gần nhất). */
  availableQty: number
  availableSilver: string
  /** Kết cục riêng của phiếu con; null là phiếu vẫn đang chạy. */
  outcome: SubTicketOutcome | null
  outcomeAt: string | null
  outcomeByName: string | null
  /** Khâu phiếu đang ở lúc chốt — cột Lỗi ghi khâu nào lỗi. */
  outcomeStage: StageCode | null
  /** Số lượng chốt hoàn thiện, đã vào kho thành phẩm. */
  outcomeQty: number | null
  outcomeNote: string | null
  lastPrintedAt: string | null
  createdByName: string
  createdAt: string
}

export type ProductionOrderDetail = Omit<ProductionOrderRow, 'images'> & {
  btp: { id: string; sku: string | null; name: string } | null
  askedUserId: string | null
  sizeLabel: string | null
  stoneCount: number | null
  stoneWeight: string | null
  /** Tổng TL bạc của đơn (g) — mốc chia gram cho phiếu con. */
  silverWeight: string | null
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
  /** Người lên đơn — cùng admin được chia phiếu con. Đơn cũ để trống. */
  createdByUserId: string | null
  images: Array<OrderImage & { id: string }>
  stages: StageEntry[]
  subTickets: SubTicket[]
  subTicketTotals: { qty: number; silverWeight: string }
  statusLogs: StatusLog[]
}

export type ProductionOrderLookups = {
  users: Array<{ id: string; username: string; fullName: string }>
  /** Tài khoản có quyền Thợ sản xuất. */
  workerIds: string[]
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
  silverWeight?: string | null
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
  handedQty?: number | null
  handedSilverWeight: string
  note?: string
}

export type ReturnPayload = {
  returnedAt: string
  returnedQty?: number | null
  laborCost?: string | null
  returnedSilverWeight: string
  btpRecoveredWeight?: string | null
  silverRecoveredWeight?: string | null
  note?: string
}

export type CastingPayload = {
  sentDate: string
  returnedDate?: string | null
  /** Tổng TL bạc (g); bỏ trống thì giữ số cũ. */
  silverWeight?: string | null
}

export type SubTicketPayload = { qty: number; silverWeight: string; note?: string }

export type SubTicketHandoverPayload = Omit<HandoverPayload, 'craftsmanUserId'>

/** Một dòng ở màn "Phiếu của tôi". */
export type MyTicketItem = {
  ticketCode: string
  orderCode: string
  no: number
  orderStatus: ProductionStatus
  description: string
  dueDate: string | null
  imageUrl: string | null
  /** null = đã được KCS nhận lại. */
  state: SubTicketState | null
  stage: StageCode | null
  qty: number
  silverWeight: string | null
  pendingAt: string | null
  claimedAt: string | null
  submittedAt: string | null
  handedAt: string | null
  handedByName: string | null
  returnedAt: string | null
  returnedByName: string | null
  returnedSilverWeight: string | null
  silverLoss: string | null
}

export type MyTickets = {
  /** Khâu đang mở, chưa ai nhận. */
  available: MyTicketItem[]
  /** Mình đã nhận (chờ giao) hoặc đang làm. */
  mine: MyTicketItem[]
  /** KCS vừa nhận lại. */
  recent: MyTicketItem[]
}

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
    /** Mã phiếu con, null = khâu của cả đơn. */
    ticketCode: string | null
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

/** Thông tin đơn chỉ-đọc cho thợ quét QR trên phiếu giấy — không có chi phí / kho / khách. */
export type OrderReference = {
  code: string
  status: ProductionStatus
  qty: number
  description: string
  dueDate: string | null
  size: string | null
  sizeLabel: string | null
  mainMaterial: string | null
  platingColor: string | null
  stoneColor: string | null
  stoneTypes: string[]
  stoneCount: number | null
  laserEngraving: string | null
  otherRequirements: string | null
  images: Array<{ id: string; kind: OrderImage['kind']; url: string }>
  subTickets: Array<{
    code: string
    no: number
    qty: number
    state: SubTicketState
    activeStage: StageCode | null
    claimedByName: string | null
  }>
}

export function getOrderReferenceApi(code: string) {
  return apiFetch<OrderReference>(orderPath(code, '/reference'))
}

/**
 * Chi tiết đơn xem từ mã phiếu con. Trang phiếu con dùng đường này thay vì endpoint đơn mẹ,
 * nhờ vậy màn quản lý đơn chặn được tài khoản thợ.
 */
export function getSubTicketOrderApi(ticketCode: string) {
  return apiFetch<ProductionOrderDetail>(`${BASE}/tickets/${encodeURIComponent(ticketCode)}`)
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

/** Chốt hàng đạt: đơn sang Hoàn thiện và vào kho thành phẩm. */
export function finishOrderApi(code: string, payload: { finishedAt?: string; note?: string } = {}) {
  return apiFetch<ProductionOrderDetail>(orderPath(code, '/finish'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Admin gỡ hoàn thiện: đơn ra khỏi kho thành phẩm, về lại khâu cuối. */
export function undoFinishOrderApi(code: string) {
  return apiFetch<ProductionOrderDetail>(orderPath(code, '/finish'), { method: 'DELETE' })
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

/** Sửa tiền công một khâu ngay ở phần chi phí (khâu đã được KCS nhận lại). */
export function updateStageLaborApi(code: string, stageId: string, laborCost: string | null) {
  return apiFetch<{ success: boolean }>(orderPath(code, `/stages/${stageId}/labor`), {
    method: 'PATCH',
    body: JSON.stringify({ laborCost }),
  })
}

export function deleteOrderCostApi(code: string, costId: string) {
  return apiFetch<{ success: boolean }>(orderPath(code, `/costs/${costId}`), { method: 'DELETE' })
}

function ticketPath(code: string, no: number, suffix = '') {
  return orderPath(code, `/sub-tickets/${no}${suffix}`)
}

export function createSubTicketApi(code: string, payload: SubTicketPayload) {
  return apiFetch<ProductionOrderDetail>(orderPath(code, '/sub-tickets'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSubTicketApi(code: string, no: number, payload: SubTicketPayload) {
  return apiFetch<ProductionOrderDetail>(ticketPath(code, no), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteSubTicketApi(code: string, no: number) {
  return apiFetch<ProductionOrderDetail>(ticketPath(code, no), { method: 'DELETE' })
}

/** Mở một khâu cho thợ tự nhận. Bỏ trống `nos` = mọi phiếu con đang rảnh. */
export function openSubTicketStageApi(code: string, payload: { stage: StageCode; nos?: number[] }) {
  return apiFetch<ProductionOrderDetail>(orderPath(code, '/sub-tickets/open-stage'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function cancelSubTicketPendingApi(code: string, no: number) {
  return apiFetch<ProductionOrderDetail>(ticketPath(code, no, '/pending'), { method: 'DELETE' })
}

/** Thợ tự nhận khâu đang mở của phiếu con. */
export function claimSubTicketApi(code: string, no: number) {
  return apiFetch<ProductionOrderDetail>(ticketPath(code, no, '/claim'), {
    method: 'POST',
    body: '{}',
  })
}

export function unclaimSubTicketApi(code: string, no: number) {
  return apiFetch<ProductionOrderDetail>(ticketPath(code, no, '/claim'), { method: 'DELETE' })
}

/** Người giao cân bạc và xác nhận giao khâu cho thợ đã nhận. */
export function handoverSubTicketApi(code: string, no: number, payload: SubTicketHandoverPayload) {
  return apiFetch<ProductionOrderDetail>(ticketPath(code, no, '/handover'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** KCS chốt phiếu con ở nhánh Lỗi (lý do bắt buộc) hoặc Hoàn thiện. */
export function setSubTicketOutcomeApi(
  code: string,
  no: number,
  outcome: SubTicketOutcome,
  note?: string,
) {
  return apiFetch<ProductionOrderDetail>(
    ticketPath(code, no, outcome === 'DEFECT' ? '/defect' : '/finish'),
    { method: 'POST', body: JSON.stringify({ note }) },
  )
}

/** Admin gỡ kết cục phiếu con: phiếu về lại luồng làm, đơn tính lại trạng thái và kho. */
export function clearSubTicketOutcomeApi(code: string, no: number) {
  return apiFetch<ProductionOrderDetail>(ticketPath(code, no, '/outcome'), { method: 'DELETE' })
}

/** Thợ báo đã làm xong khâu đang giữ, nộp hàng cho KCS. */
export function submitSubTicketApi(code: string, no: number) {
  return apiFetch<ProductionOrderDetail>(ticketPath(code, no, '/submit'), {
    method: 'POST',
    body: '{}',
  })
}

export function unsubmitSubTicketApi(code: string, no: number) {
  return apiFetch<ProductionOrderDetail>(ticketPath(code, no, '/submit'), { method: 'DELETE' })
}

export function markSubTicketPrintedApi(code: string, no: number) {
  return apiFetch<{ lastPrintedAt: string | null }>(ticketPath(code, no, '/printed'), {
    method: 'POST',
    body: '{}',
  })
}

export function getMyTicketsApi() {
  return apiFetch<MyTickets>(`${BASE}/my-tickets`)
}

/** Tách mã phiếu con "A012-2" → đơn A012, phiếu số 2. */
export function parseSubTicketCode(value: string): { orderCode: string; no: number } | null {
  const match = /^(.+)-(\d+)$/.exec(value.trim().toUpperCase())
  if (!match) return null
  return { orderCode: match[1], no: Number(match[2]) }
}
