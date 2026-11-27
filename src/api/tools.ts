import { apiFetch } from './auth'

const BASE = '/tools'

/** Loại phiếu dụng cụ — chỉ thủ kho ghi. */
export type ToolMoveKind = 'ISSUE' | 'RETURN' | 'TRANSFER' | 'WORN' | 'DAMAGED' | 'LOST'

/** Loại phiếu thủ kho / QC ghi được trên màn: xuất cho người giữ, chuyển người giữ, hỏng. Trả / hao mòn / mất đã bỏ
 * khỏi màn (BE vẫn hiểu để đọc phiếu cũ nếu có). */
export const TOOL_MOVE_KINDS: ToolMoveKind[] = ['ISSUE', 'TRANSFER', 'DAMAGED']

export const TOOL_MOVE_LABEL: Record<ToolMoveKind, string> = {
  ISSUE: 'Xuất cho người giữ',
  RETURN: 'Trả về kho',
  TRANSFER: 'Chuyển người giữ',
  WORN: 'Hao mòn',
  DAMAGED: 'Hỏng',
  LOST: 'Mất',
}

/** Mô tả ngắn từng loại trên hộp thoại ghi phiếu. */
export const TOOL_MOVE_HINT: Record<ToolMoveKind, string> = {
  ISSUE: 'Xuất khỏi kho dụng cụ (giá FIFO), giao cho một nhân viên giữ.',
  RETURN: 'Thợ trả dụng cụ còn dùng được — nhập lại kho theo giá bình quân thợ đang giữ.',
  TRANSFER: 'Chuyển thẳng từ người này sang người khác, không qua kho.',
  WORN: 'Dùng tới mòn hết (mũi khoan, lưỡi cưa…) — hao mòn bình thường, không tính lỗi thợ.',
  DAMAGED: 'Hỏng trước khi mòn hết. Bắt buộc ghi lý do.',
  LOST: 'Thợ làm mất. Bắt buộc ghi lý do; giá trị hiện ở cột Mất để khấu trừ.',
}

/** Loại nào cần người giao / người nhận. */
export function toolMoveSides(kind: ToolMoveKind) {
  if (kind === 'ISSUE') return { from: false, to: true }
  if (kind === 'TRANSFER') return { from: true, to: true }
  return { from: true, to: false }
}

export const TOOL_REASON_REQUIRED: ToolMoveKind[] = ['DAMAGED', 'LOST']

export type ToolWorker = { id: string; name: string; isActive: boolean }

export type ToolHolding = {
  workerId: string
  workerName: string
  materialId: string
  sku: string | null
  name: string
  unitName: string
  qty: string
  amount: string
  updatedAt: string
}

/** Dụng cụ thợ đang giữ — màn thợ, không có tiền. */
export type MyToolHolding = Omit<ToolHolding, 'amount'>

export type ToolFigure = { qty: string; amount: string }

export type ToolSummaryRow = {
  workerId: string
  workerName: string
  /** Số mã dụng cụ đang giữ. */
  holdingItems: number
  holding: ToolFigure
  issued: ToolFigure
  returned: ToolFigure
  transferredIn: ToolFigure
  transferredOut: ToolFigure
  worn: ToolFigure
  damaged: ToolFigure
  lost: ToolFigure
}

export type ToolPerson = { id: string; name: string }

export type ToolMoveRow = {
  id: string
  no: number
  code: string
  kind: ToolMoveKind
  kindLabel: string
  movedAt: string
  material: { id: string; sku: string | null; name: string; unitName: string }
  fromWorker: ToolPerson | null
  toWorker: ToolPerson | null
  qty: string
  amount: string
  note: string | null
  createdByName: string
  createdAt: string
  /** Có phiếu nhập / xuất kho đi kèm (xuất / trả). */
  hasStockLine: boolean
}

export type CreateToolMovePayload = {
  kind: ToolMoveKind
  movedAt: string
  materialId: string
  fromWorkerId?: string | null
  toWorkerId?: string | null
  qty: string
  note?: string | null
}

type Period = { from: string; to: string }

const periodQuery = (period: Period) => new URLSearchParams({ from: period.from, to: period.to }).toString()

export function getToolWorkersApi() {
  return apiFetch<ToolWorker[]>(`${BASE}/workers`)
}

export function getToolHoldingsApi(workerId?: string) {
  return apiFetch<ToolHolding[]>(`${BASE}/holdings${workerId ? `?workerId=${workerId}` : ''}`)
}

export function getMyToolsApi() {
  return apiFetch<MyToolHolding[]>(`${BASE}/mine`)
}

export function getToolSummaryApi(period: Period) {
  return apiFetch<ToolSummaryRow[]>(`${BASE}/summary?${periodQuery(period)}`)
}

/** Phiếu dụng cụ trong kỳ — truyền `workerId` để lấy phiếu của một thợ (thợ giao hoặc thợ nhận). */
export function getToolMovesApi(period: Period, workerId?: string) {
  const worker = workerId ? `&workerId=${workerId}` : ''
  return apiFetch<ToolMoveRow[]>(`${BASE}/moves?${periodQuery(period)}${worker}`)
}

export function createToolMoveApi(payload: CreateToolMovePayload) {
  return apiFetch<ToolMoveRow>(`${BASE}/moves`, { method: 'POST', body: JSON.stringify(payload) })
}

export function deleteToolMoveApi(id: string) {
  return apiFetch<{ ok: true }>(`${BASE}/moves/${id}`, { method: 'DELETE' })
}

// ——— Sổ tài sản (kho dụng cụ) ———

export type ToolDepartment = 'XUONG_KIM_HOAN' | 'XUONG_DA' | 'NHA_CHUNG_01' | 'NHA_CHUNG_02'

export const TOOL_DEPARTMENTS: Array<{ value: ToolDepartment; label: string }> = [
  { value: 'XUONG_KIM_HOAN', label: 'Xưởng Kim Hoàn' },
  { value: 'XUONG_DA', label: 'Xưởng đá' },
  { value: 'NHA_CHUNG_01', label: 'Nhà chung 01' },
  { value: 'NHA_CHUNG_02', label: 'Nhà chung 02' },
]

export type AssetStatus = 'IN_USE' | 'UNUSED' | 'DAMAGED' | 'NONE'

export type ToolGroup = {
  id: string
  /** 2 chữ in hoa — đứng trong mã TS (X + mã nhóm + MMYY + STT). */
  code: string
  name: string
  sortOrder: number
  isActive: boolean
  _count: { materials: number }
}

export type ToolAsset = {
  id: string
  /** Mã TS, vd XBA0425001. */
  code: string | null
  name: string
  group: { id: string; code: string; name: string } | null
  purchasedAt: string | null
  unit: { id: string; name: string }
  purchasedQty: string
  unitPrice: string
  purchaseAmount: string
  openingQty: string
  openingUnitPrice: string
  inStock: string
  held: string
  damaged: string
  holders: Array<{ id: string; name: string; qty: string }>
  status: AssetStatus
  statusLabel: string
  department: ToolDepartment | null
  departmentLabel: string | null
  labelStuck: boolean
  companyAllocation: string | null
  note: string | null
  auditCheckedAt: string | null
  auditCheckedByName: string | null
  accountingCheckedAt: string | null
  accountingCheckedByName: string | null
  /** Đã có phiếu nhập / xuất / giao người giữ → khoá SL, đơn giá ban đầu, không xoá được. */
  locked: boolean
}

export type ToolAssetPayload = {
  groupId: string
  purchasedAt: string
  /** Bỏ trống = hệ thống tự sinh. */
  code?: string | null
  name: string
  unitId: string
  qty: string
  unitPrice?: string | null
  department?: ToolDepartment | null
  labelStuck?: boolean
  companyAllocation?: string | null
  note?: string | null
}

export type ToolGroupPayload = { code: string; name: string; sortOrder?: number; isActive?: boolean }

export function getToolGroupsApi(includeInactive = false) {
  return apiFetch<ToolGroup[]>(`${BASE}/groups${includeInactive ? '?all=true' : ''}`)
}

export function createToolGroupApi(payload: ToolGroupPayload) {
  return apiFetch<ToolGroup>(`${BASE}/groups`, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateToolGroupApi(id: string, payload: ToolGroupPayload) {
  return apiFetch<ToolGroup>(`${BASE}/groups/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function getToolAssetsApi() {
  return apiFetch<ToolAsset[]>(`${BASE}/assets`)
}

export function getNextAssetCodeApi(groupId: string, purchasedAt: string) {
  const query = new URLSearchParams({ groupId, purchasedAt }).toString()
  return apiFetch<{ code: string }>(`${BASE}/assets/next-code?${query}`)
}

export function createToolAssetApi(payload: ToolAssetPayload) {
  return apiFetch<ToolAsset>(`${BASE}/assets`, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateToolAssetApi(id: string, payload: ToolAssetPayload) {
  return apiFetch<ToolAsset>(`${BASE}/assets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteToolAssetApi(id: string) {
  return apiFetch<{ ok: true }>(`${BASE}/assets/${id}`, { method: 'DELETE' })
}

export function confirmAssetAuditApi(id: string, confirmed: boolean) {
  return apiFetch<ToolAsset>(`${BASE}/assets/${id}/audit`, { method: 'POST', body: JSON.stringify({ confirmed }) })
}

export function confirmAssetAccountingApi(id: string, confirmed: boolean) {
  return apiFetch<ToolAsset>(`${BASE}/assets/${id}/accounting`, {
    method: 'POST',
    body: JSON.stringify({ confirmed }),
  })
}
