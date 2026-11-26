import { apiFetch } from './auth'

const BASE = '/tools'

/** Loại phiếu dụng cụ — chỉ thủ kho ghi. */
export type ToolMoveKind = 'ISSUE' | 'RETURN' | 'TRANSFER' | 'WORN' | 'DAMAGED' | 'LOST'

export const TOOL_MOVE_KINDS: ToolMoveKind[] = ['ISSUE', 'RETURN', 'TRANSFER', 'WORN', 'DAMAGED', 'LOST']

export const TOOL_MOVE_LABEL: Record<ToolMoveKind, string> = {
  ISSUE: 'Xuất cho thợ',
  RETURN: 'Trả về kho',
  TRANSFER: 'Chuyển thợ',
  WORN: 'Hao mòn',
  DAMAGED: 'Hỏng',
  LOST: 'Mất',
}

/** Mô tả ngắn từng loại trên hộp thoại ghi phiếu. */
export const TOOL_MOVE_HINT: Record<ToolMoveKind, string> = {
  ISSUE: 'Xuất khỏi kho dụng cụ (giá FIFO), cộng vào dụng cụ thợ đang giữ.',
  RETURN: 'Thợ trả dụng cụ còn dùng được — nhập lại kho theo giá bình quân thợ đang giữ.',
  TRANSFER: 'Chuyển thẳng từ thợ này sang thợ khác, không qua kho.',
  WORN: 'Dùng tới mòn hết (mũi khoan, lưỡi cưa…) — hao mòn bình thường, không tính lỗi thợ.',
  DAMAGED: 'Hỏng trước khi mòn hết. Bắt buộc ghi lý do.',
  LOST: 'Thợ làm mất. Bắt buộc ghi lý do; giá trị hiện ở cột Mất để khấu trừ.',
}

/** Loại nào cần thợ giao / thợ nhận. */
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
