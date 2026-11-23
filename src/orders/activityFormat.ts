import { gramToCt } from '../api/inventory'
import type { StageCode } from '../api/productionOrders'
import { formatDateTime, STAGE_LABEL } from './catalog'

/** Nhãn tiếng Việt cho các trường hay gặp trong giá trị trước / sau. */
const FIELD_LABEL: Record<string, string> = {
  status: 'Trạng thái',
  qty: 'SL',
  silverWeight: 'Gram bạc',
  note: 'Ghi chú',
  name: 'Tên',
  amount: 'Số tiền',
  attempt: 'Lần',
  craftsmanName: 'Thợ',
  handedByName: 'Người giao',
  handedAt: 'Giờ giao',
  handedQty: 'SL giao',
  handedSilverWeight: 'TL giao (g)',
  handedStoneCount: 'Đá giao (viên)',
  handedStoneWeight: 'Đá giao (ct)',
  submittedByName: 'Người báo xong',
  submittedAt: 'Giờ báo xong',
  returnedByName: 'QC',
  returnedAt: 'Giờ nhận lại',
  returnedQty: 'SL sản phẩm đạt',
  returnedSilverWeight: 'TL sản phẩm đạt (g)',
  stoneCount: 'Đá gắn (viên)',
  stoneWeight: 'Đá gắn (ct)',
  returnedStoneCount: 'Đá trả lại (viên)',
  btpRecoveredWeight: 'BTP thu hồi (g)',
  silverRecoveredWeight: 'Bạc thu hồi (g)',
  laborCost: 'Tiền công',
  pendingByName: 'Người mở khâu',
  pendingAt: 'Giờ mở khâu',
  claimedByName: 'Thợ đã nhận',
  claimedAt: 'Giờ nhận',
  outcome: 'Kết cục',
  outcomeQty: 'SL chốt',
  sku: 'Mã',
  unit: 'Đơn vị',
  castingSentDate: 'Ngày báo Đúc',
  castingReturnedDate: 'Ngày Đúc về',
  cutCode: 'Phiếu cắt',
  cutAt: 'Giờ cắt',
  weight: 'TL (g)',
  finishedAt: 'Giờ hoàn thiện',
  goodQty: 'Hàng đạt (sp)',
  goodWeight: 'TL hàng đạt (g)',
  defectQty: 'Hàng lỗi (sp)',
  scrapS999Weight: 'S999 thừa (g)',
  stockInboundCount: 'Số phiếu nhập kho',
  stockInboundIds: 'Phiếu nhập kho',
  acceptedBy: 'Thợ xác nhận',
  heldStoneCount: 'Đá giữ chỗ (viên)',
  productWeightGram: 'TL sáp (g)',
  waxImageCount: 'Số ảnh sáp',
  castingTreeWeightGram: 'TL cây thông (g)',
  pendingStage: 'Khâu đang chờ',
  stage: 'Chuyển sang',
  skipped: 'Bỏ qua',
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function formatObject(value: unknown) {
  const record = asRecord(value)
  return Object.entries(record)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${FIELD_LABEL[k] ?? k} ${fieldValue(k, v)}`)
    .join(' · ')
}

/** TL đá trong nhật ký lưu theo g — hiện theo ct cho khớp ô nhập. */
const CARAT_FIELDS = new Set(['handedStoneWeight', 'stoneWeight'])
/** Trường lưu mã khâu (FILING…) — hiện tên khâu. */
const STAGE_FIELDS = new Set(['pendingStage', 'stage', 'skipped'])

function stageName(value: unknown) {
  return typeof value === 'string' && value in STAGE_LABEL ? STAGE_LABEL[value as StageCode] : formatValue(value)
}

function fieldValue(key: string, value: unknown) {
  if (STAGE_FIELDS.has(key)) {
    return Array.isArray(value) ? (value.length ? value.map(stageName).join(', ') : '—') : stageName(value)
  }
  if (CARAT_FIELDS.has(key) && value != null && value !== '' && Number.isFinite(Number(value))) {
    return gramToCt(String(value))
  }
  return formatValue(value)
}

function formatValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value)
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  if (typeof value === 'object') return formatObject(value)
  return String(value)
}
