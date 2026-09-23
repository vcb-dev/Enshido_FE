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
  /** Đơn vị số lượng cần làm: chiếc | đôi. */
  qtyUnit: string | null
  finishedProductQty: number | null
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
  sizeLabel: string | null
  mainMaterial: string | null
  platingColor: string | null
  btpCategory: string | null
  productKind: string | null
  askedUserName: string | null
  receivedDate: string
  dueDate: string | null
  debtStatus: string | null
  createdAt: string
  updatedAt: string
  /** Trạng thái thao tác của phiếu mẹ khi đơn không chia phiếu con. */
  workState: SubTicketState | null
  /** Khâu đang chạy hoặc vừa được KCS nhận lại của phiếu mẹ. */
  workStage: StageCode | null
  images: Array<{ id: string; kind: ProductionImageKind; url: string }>
  /** Phiếu con của đơn — thành dòng con xổ ra dưới đơn ở danh sách. Đơn chưa chia thì rỗng. */
  subTickets: SubTicketSummary[]
}

/** Một phiếu con ở danh sách đơn: đang ở khâu nào, trạng thái gì, ai đang giữ hàng. */
export type SubTicketSummary = {
  code: string
  no: number
  qty: number
  /** Gram bạc đã chia cho phiếu (gồm cả phần cấp thêm). */
  silverWeight: string
  note: string | null
  createdAt: string
  state: SubTicketState
  /** Khâu đang chạy, hoặc khâu vừa xong nếu đang rảnh / đã chốt. Chưa giao khâu nào thì null. */
  stage: StageCode | null
  /** Người đang giữ hàng (đã nhận hoặc đang làm). Đang chờ nhận / rảnh thì null. */
  workerName: string | null
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
  /** Khâu Vào đá: số viên đá phát cho thợ lúc giao. */
  handedStoneCount: number | null
  /** Khâu Vào đá: TL đá phát cho thợ (g). */
  handedStoneWeight: string | null
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
  /** Khâu Vào đá cân cả cụm bạc + đá; khâu khác chỉ là bạc. */
  returnedSilverWeight: string | null
  /** Khâu Vào đá: số viên đá gắn lên, đá không tính hao hụt. */
  stoneCount: number | null
  /** Khâu Vào đá: TL đá gắn lên (g) — cộng vào TL giao khi tính hao hụt. */
  stoneWeight: string | null
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

/** Một lần cấp thêm SL / bạc cho phiếu con khi thợ làm giữa chừng phát hiện thiếu. */
export type SubTicketTopUp = {
  id: string
  qty: number
  silverWeight: string
  reason: string | null
  createdByName: string
  createdAt: string
  /** Đã vào một khâu rồi hay còn chờ giao khâu sau. */
  applied: boolean
}

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
  /** Lịch sử cấp thêm, cũ trước mới sau. */
  topUps: SubTicketTopUp[]
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

/** Phiếu mẹ khi đơn không chia: dùng cùng luồng tự nhận như phiếu con. */
export type OrderWorkTicket = {
  code: string
  state: SubTicketState
  activeStage: StageCode | null
  pendingStage: StageCode | null
  pendingAt: string | null
  pendingByName: string | null
  claimedByUserId: string | null
  claimedByName: string | null
  claimedAt: string | null
  openEntryId: string | null
  availableQty: number
  availableSilver: string | null
}

// Bản chi tiết có `subTickets` đầy đủ của riêng nó — bỏ bản tóm tắt của dòng danh sách đi.
export type ProductionOrderDetail = Omit<
  ProductionOrderRow,
  'images' | 'subTickets' | 'workState' | 'workStage'
> & {
  btp: { id: string; sku: string | null; name: string } | null
  nvl: { id: string; sku: string | null; name: string } | null
  sourceOrderCode: string | null
  askedUserId: string | null
  sizeLabel: string | null
  stoneCount: number | null
  stoneWeight: string | null
  /** Tổng TL bạc của đơn (g) — mốc chia gram cho phiếu con. */
  silverWeight: string | null
  laserEngraving: string | null
  otherRequirements: string | null
  nvlLines: ProductionNvlWorkLine[]
  castingSentDate: string | null
  castingReturnedDate: string | null
  parentCode: string | null
  split: { no: number; total: number }
  children: Array<{ code: string; status: ProductionStatus }>
  /** Số dòng phiếu xuất NVL đang gắn đơn. */
  linkedOutbounds: number
  finishedGoods: {
    /** Số lượng đã được kho xác nhận vào tồn. */
    qty: number
    /** Tổng số lượng sản xuất đã chốt hoàn thiện. */
    completedQty: number
    /** Số lượng đã hoàn thiện nhưng kho chưa xác nhận nhập. */
    pendingQty: number
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
  workTicket: OrderWorkTicket | null
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
  receivedDate?: string
  dueDate?: string
  page: number
  pageSize: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export type UpsertProductionOrderPayload = {
  source: ProductionSource
  btpMaterialId?: string | null
  nvlMaterialId?: string | null
  finishedProductCode?: string | null
  requestType: ProductionRequestType
  receivedDate: string
  closedBy: string
  description: string
  qty: number
  qtyUnit?: string | null
  finishedProductQty?: number | null
  /** Số lượng BTP xuất kho khi lên đơn BTP. */
  btpQty?: number | null
  model3dCode?: string
  model3dUrl?: string | null
  leadTime: string
  trackingCode: string
  stoneColor?: string
  stoneTypes?: string[]
  dueDate: string
  size?: string
  sizeLabel?: string
  stoneCount?: number | null
  stoneWeight?: string | null
  silverWeight?: string | null
  laserEngraving?: string
  otherRequirements?: string
  mainMaterial?: string
  platingColor?: string
  btpCategory?: string
  productKind?: string
  askedUserId?: string | null
  debtStatus?: string
  parentCode?: string
  images: OrderImage[]
  nvlLines?: ProductionNvlWorkLine[]
}

export type HandoverPayload = {
  craftsmanUserId: string
  handedAt: string
  handedQty?: number | null
  handedSilverWeight: string
  /** Khâu Vào đá: số viên đá và TL đá (g) phát cho thợ. Khâu khác không gửi. */
  handedStoneCount?: number | null
  handedStoneWeight?: string | null
  note?: string
}

export type ReturnPayload = {
  returnedAt: string
  returnedQty?: number | null
  laborCost?: string | null
  returnedSilverWeight: string
  /** Khâu Vào đá: số viên đá gắn lên. Khâu khác không gửi. */
  stoneCount?: number | null
  /** Khâu Vào đá: TL đá gắn lên (g). */
  stoneWeight?: string | null
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
  scope: 'ORDER' | 'SUB_TICKET'
  ticketCode: string
  orderCode: string
  no: number | null
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

/**
 * Máy chủ cũ hơn bản FE đang chạy — ảnh docker chưa deploy lại — thì đơn về thiếu hẳn
 * `subTickets`. Các màn đọc thẳng `.length` / `.map` nên thiếu một mảng là trắng cả trang
 * chứ không chỉ hỏng một ô, vì lỗi ném ra từ lúc render. Bù mặc định ngay ở tầng API để
 * component không phải phòng thủ từng chỗ.
 */
type Sparse<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

type SparseOrderRow = Sparse<ProductionOrderRow, 'subTickets' | 'workState' | 'workStage'>
type SparseOrderDetail = Sparse<ProductionOrderDetail, 'subTickets' | 'subTicketTotals'>

function fillOrderRow(row: SparseOrderRow): ProductionOrderRow {
  return {
    ...row,
    workState: row.workState ?? null,
    workStage: row.workStage ?? null,
    subTickets: row.subTickets ?? [],
  }
}

function fillOrderDetail(order: SparseOrderDetail): ProductionOrderDetail {
  return {
    ...order,
    subTickets: order.subTickets ?? [],
    // Máy chủ chưa biết phiếu con thì cũng chưa chia được gì.
    subTicketTotals: order.subTicketTotals ?? { qty: 0, silverWeight: '0' },
  }
}

async function orderFetch(path: string, options?: RequestInit): Promise<ProductionOrderDetail> {
  return fillOrderDetail(await apiFetch<SparseOrderDetail>(path, options))
}

export async function listProductionOrdersApi(params: ProductionOrderListParams) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const res = await apiFetch<Omit<ProductionOrderListResponse, 'items'> & { items: SparseOrderRow[] }>(
    `${BASE}?${query.toString()}`,
  )
  return { ...res, items: res.items.map(fillOrderRow) }
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

export async function getOrderReferenceApi(code: string) {
  const order = await apiFetch<Sparse<OrderReference, 'subTickets'>>(orderPath(code, '/reference'))
  return { ...order, subTickets: order.subTickets ?? [] }
}

/**
 * Chi tiết đơn xem từ mã phiếu con. Trang phiếu con dùng đường này thay vì endpoint đơn mẹ,
 * nhờ vậy màn quản lý đơn chặn được tài khoản thợ.
 */
export function getSubTicketOrderApi(ticketCode: string) {
  return orderFetch(`${BASE}/tickets/${encodeURIComponent(ticketCode)}`)
}

export function getProductionOrderApi(code: string) {
  return orderFetch(orderPath(code))
}

export function createProductionOrderApi(payload: UpsertProductionOrderPayload) {
  return orderFetch(BASE, {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25_000),
  })
}

export function updateProductionOrderApi(code: string, payload: UpsertProductionOrderPayload) {
  return orderFetch(orderPath(code), {
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
  return orderFetch(orderPath(code, '/status'), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function updateCastingApi(code: string, payload: CastingPayload) {
  return orderFetch(orderPath(code, '/casting'), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

/** Giao khâu cho thợ — người giao là tài khoản đăng nhập. */
export function startStageApi(code: string, payload: HandoverPayload & { stage: StageCode }) {
  return orderFetch(orderPath(code, '/stages'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateHandoverApi(code: string, stageId: string, payload: HandoverPayload) {
  return orderFetch(orderPath(code, `/stages/${stageId}`), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

/** KCS nhận lại và cân bạc — người KCS là tài khoản đăng nhập. */
export function returnStageApi(code: string, stageId: string, payload: ReturnPayload) {
  return orderFetch(orderPath(code, `/stages/${stageId}/return`), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function undoReturnApi(code: string, stageId: string) {
  return orderFetch(orderPath(code, `/stages/${stageId}/return`), {
    method: 'DELETE',
  })
}

/** Chốt hàng đạt: đơn sang Hoàn thiện và vào kho thành phẩm. */
export function finishOrderApi(code: string, payload: { finishedAt?: string; note?: string } = {}) {
  return orderFetch(orderPath(code, '/finish'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Admin gỡ hoàn thiện: đơn ra khỏi kho thành phẩm, về lại khâu cuối. */
export function undoFinishOrderApi(code: string) {
  return orderFetch(orderPath(code, '/finish'), { method: 'DELETE' })
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

export type FinishedProductOption = {
  code: string
  description: string
  requestType: ProductionRequestType
  qty: number
  size: string | null
  sizeLabel: string | null
  mainMaterial: string | null
  platingColor: string | null
  stoneColor: string | null
  stoneTypes: string[]
  stoneCount: number | null
  stoneWeight: string | null
  laserEngraving: string | null
  otherRequirements: string | null
  remainingQty: number
  qtyUnit: string | null
  images: Array<{
    kind: ProductionImageKind
    url: string
    publicId: string
    width: number | null
    height: number | null
  }>
  bomLines: FinishedProductBomLine[]
}

export type ProductionNvlWorkLine = {
  materialId: string
  platingColor: string | null
  qty: number | null
  stoneWeight: string | null
  laserEngraving: string | null
  otherRequirements: string | null
}

export type FinishedProductBomLine = {
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
  note: string | null
  imageUrl: string | null
}

export type NvlOption = {
  id: string
  sku: string | null
  name: string
  unit: string
  qty: string
  shape: string | null
  color: string | null
  materialType: string | null
  bodyMetal: string | null
  metalKind: string | null
  sizeLabel: string | null
  note: string | null
  images: Array<{ url: string; publicId: string; width: number | null; height: number | null }>
}

export function listFinishedProductOptionsApi(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<FinishedProductOption[]>(`${BASE}/finished-product-options${query}`)
}

export function listNvlOptionsApi(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch<NvlOption[]>(`${BASE}/nvl-options${query}`)
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
  return orderFetch(orderPath(code, '/sub-tickets'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Lần chia đầu tiên tạo tối thiểu hai phiếu trong cùng một transaction. */
export function splitSubTicketsApi(code: string, tickets: SubTicketPayload[]) {
  return orderFetch(orderPath(code, '/sub-tickets/split'), {
    method: 'POST',
    body: JSON.stringify({ tickets }),
  })
}

export function clearSubTicketsApi(code: string) {
  return orderFetch(orderPath(code, '/sub-tickets'), { method: 'DELETE' })
}

export function updateSubTicketApi(code: string, no: number, payload: SubTicketPayload) {
  return orderFetch(ticketPath(code, no), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteSubTicketApi(code: string, no: number) {
  return orderFetch(ticketPath(code, no), { method: 'DELETE' })
}

/** Mở một khâu cho thợ tự nhận. Bỏ trống `nos` = mọi phiếu con đang rảnh. */
export function openSubTicketStageApi(code: string, payload: { stage: StageCode; nos?: number[] }) {
  return orderFetch(orderPath(code, '/sub-tickets/open-stage'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function openOrderStageApi(code: string, stage: StageCode) {
  return orderFetch(orderPath(code, '/work/open-stage'), {
    method: 'POST',
    body: JSON.stringify({ stage }),
  })
}

export function cancelOrderPendingApi(code: string) {
  return orderFetch(orderPath(code, '/work/pending'), { method: 'DELETE' })
}

export function cancelSubTicketPendingApi(code: string, no: number) {
  return orderFetch(ticketPath(code, no, '/pending'), { method: 'DELETE' })
}

/** Thợ tự nhận khâu đang mở của phiếu con. */
export function claimSubTicketApi(code: string, no: number) {
  return orderFetch(ticketPath(code, no, '/claim'), {
    method: 'POST',
    body: '{}',
  })
}

export function claimOrderApi(code: string) {
  return orderFetch(orderPath(code, '/work/claim'), { method: 'POST', body: '{}' })
}

export function unclaimSubTicketApi(code: string, no: number) {
  return orderFetch(ticketPath(code, no, '/claim'), { method: 'DELETE' })
}

export function unclaimOrderApi(code: string) {
  return orderFetch(orderPath(code, '/work/claim'), { method: 'DELETE' })
}

/** Người giao cân bạc và xác nhận giao khâu cho thợ đã nhận. */
export function handoverSubTicketApi(code: string, no: number, payload: SubTicketHandoverPayload) {
  return orderFetch(ticketPath(code, no, '/handover'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function handoverOrderApi(code: string, payload: SubTicketHandoverPayload) {
  return orderFetch(orderPath(code, '/work/handover'), {
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
  return orderFetch(
    ticketPath(code, no, outcome === 'DEFECT' ? '/defect' : '/finish'),
    { method: 'POST', body: JSON.stringify({ note }) },
  )
}

/** Admin gỡ kết cục phiếu con: phiếu về lại luồng làm, đơn tính lại trạng thái và kho. */
export function clearSubTicketOutcomeApi(code: string, no: number) {
  return orderFetch(ticketPath(code, no, '/outcome'), { method: 'DELETE' })
}

/** Thợ báo đã làm xong khâu đang giữ, nộp hàng cho KCS. */
export function submitSubTicketApi(code: string, no: number) {
  return orderFetch(ticketPath(code, no, '/submit'), {
    method: 'POST',
    body: '{}',
  })
}

export function submitOrderApi(code: string) {
  return orderFetch(orderPath(code, '/work/submit'), { method: 'POST', body: '{}' })
}

export function unsubmitSubTicketApi(code: string, no: number) {
  return orderFetch(ticketPath(code, no, '/submit'), { method: 'DELETE' })
}

export function unsubmitOrderApi(code: string) {
  return orderFetch(orderPath(code, '/work/submit'), { method: 'DELETE' })
}

/** Cấp thêm SL / bạc cho phiếu con. Bỏ trống một trong hai thì hiểu là 0. */
export function topUpSubTicketApi(
  code: string,
  no: number,
  payload: { qty?: number | null; silverWeight?: string | null; reason?: string },
) {
  return orderFetch(ticketPath(code, no, '/top-up'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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
