import { apiFetch } from './auth'

const BASE = '/repairs'

/** Hàng sửa chữa trước khi nhập kho hay đã nằm trong kho. */
export type RepairStage = 'BEFORE_STOCK' | 'IN_STOCK'
/** Hàng của VPC hay VCB. */
export type RepairSource = 'VPC' | 'VCB'

export const REPAIR_STAGE_OPTIONS: Array<{ value: RepairStage; label: string }> = [
  { value: 'BEFORE_STOCK', label: 'Trước khi nhập kho' },
  { value: 'IN_STOCK', label: 'Trong kho' },
]

export const REPAIR_SOURCE_OPTIONS: Array<{ value: RepairSource; label: string }> = [
  { value: 'VPC', label: 'Hàng VPC' },
  { value: 'VCB', label: 'Hàng VCB' },
]

export const REPAIR_STAGE_LABEL: Record<RepairStage, string> = {
  BEFORE_STOCK: 'Trước khi nhập kho',
  IN_STOCK: 'Trong kho',
}

/** Chờ thủ kho nhận (thủ kho chưa nhập gì) → Đang sửa → Đã trả đủ. */
export type RepairStatus = 'WAITING' | 'REPAIRING' | 'RETURNED'

export const REPAIR_STATUS_OPTIONS: Array<{ value: RepairStatus; label: string }> = [
  { value: 'WAITING', label: 'Chờ thủ kho nhận' },
  { value: 'REPAIRING', label: 'Đang sửa' },
  { value: 'RETURNED', label: 'Đã trả' },
]

/** Phần khách (VCB / VPC) nhập. Ngày dạng YYYY-MM-DD. */
export type RepairCustomerPart = {
  receivedAt: string
  stage: RepairStage
  productCode: string | null
  productName: string | null
  qty: number
  content: string
  senderName: string | null
  /** Số phiếu sửa — một phiếu gom nhiều mã, các dòng cùng phiếu ghi cùng số. */
  ticketCode: string | null
}

/** Phần thủ kho nhập. */
export type RepairKeeperPart = {
  /** null = chưa trả. */
  returnedQty: number | null
  returnedAt: string | null
  note: string | null
  transferConfirmedBy: string | null
  issuerName: string | null
  repairedBy: string | null
  returnedBy: string | null
  receiverName: string | null
}

export type RepairItem = RepairCustomerPart &
  RepairKeeperPart & {
    id: string
    source: RepairSource
    status: RepairStatus
    /** Thủ kho đã nhập gì đó — khách hết sửa / xoá. */
    keeperTouched: boolean
    /** Tài khoản tạo dòng. */
    createdByName: string
    createdAt: string
    updatedAt: string
  }

/** Khách gửi phần của mình (source theo tài khoản); thủ kho gửi đủ cả hai phần + source. */
export type RepairItemPayload = RepairCustomerPart & Partial<RepairKeeperPart> & { source?: RepairSource }

export function getRepairItemsApi() {
  return apiFetch<RepairItem[]>(BASE)
}

export function createRepairItemApi(payload: RepairItemPayload) {
  return apiFetch<RepairItem>(BASE, { method: 'POST', body: JSON.stringify(payload) })
}

/** Một phiếu sửa nhiều mã sản phẩm — mỗi mã một dòng, BE lưu cùng lúc. */
export function createRepairItemsApi(items: RepairItemPayload[]) {
  return apiFetch<RepairItem[]>(`${BASE}/batch`, { method: 'POST', body: JSON.stringify({ items }) })
}

/** Ô thủ kho ghi chung khi xác nhận cả phiếu. Không gửi key = giữ nguyên từng dòng; null = xoá. */
export type RepairConfirmShared = Partial<
  Pick<RepairKeeperPart, 'returnedAt' | 'transferConfirmedBy' | 'issuerName' | 'repairedBy' | 'returnedBy' | 'receiverName'>
>

export type RepairConfirmPayload = RepairConfirmShared & {
  lines: Array<{ id: string; returnedQty: number | null; note: string | null }>
}

/** Thủ kho xác nhận cả phiếu sửa một lần (chỉ thủ kho). */
export function confirmRepairSlipApi(payload: RepairConfirmPayload) {
  return apiFetch<RepairItem[]>(`${BASE}/confirm`, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateRepairItemApi(id: string, payload: RepairItemPayload) {
  return apiFetch<RepairItem>(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteRepairItemApi(id: string) {
  return apiFetch<{ ok: true }>(`${BASE}/${id}`, { method: 'DELETE' })
}
