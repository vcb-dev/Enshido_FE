import { toast } from 'sonner'
import {
  assignOrderApi,
  assignSubTicketApi,
  returnStageApi,
  reviseReturnApi,
  type ProductionOrderDetail,
  type ReturnPayload,
  type StageCode,
  type StageEntry,
} from '../api/productionOrders'
import { skipsStone } from './catalog'

/**
 * Khâu kế là Khắc (Vào đá, hoặc Nguội của đơn không có đá): QC lưu là xác nhận luôn thay thủ kho
 * rồi giao Khắc, hàng không quay về kho. Khớp `qcConfirmsStage` phía BE.
 */
export function qcConfirmsStage(
  order: Parameters<typeof skipsStone>[0],
  stage: StageCode,
) {
  return stage === 'STONE_SETTING' || (stage === 'FILING' && skipsStone(order))
}

/** Phiếu của `entry` đang chờ thợ khắc nhận — tức là giao Khắc đã thành công. */
export function engravingPending(order: ProductionOrderDetail, entry: StageEntry) {
  const ticket =
    entry.subTicketNo != null ? order.subTickets.find((item) => item.no === entry.subTicketNo) : order.workTicket
  return ticket?.pendingStage === 'ENGRAVING'
}

/**
 * Lưu kết quả QC; có chọn thợ khắc thì giao Khắc ngay sau đó. Giao lỗi thì kết quả QC vẫn giữ —
 * báo để QC giao lại ở chi tiết lệnh, không làm hỏng lần lưu QC.
 */
export async function saveQcReturn(
  order: ProductionOrderDetail,
  entry: StageEntry,
  payload: ReturnPayload,
  engraverUserId?: string | null,
) {
  if (entry.returnedAt) return reviseReturnApi(order.code, entry.id, payload)
  const saved = await returnStageApi(order.code, entry.id, payload)
  if (!engraverUserId) return saved
  try {
    return entry.subTicketNo != null
      ? await assignSubTicketApi(order.code, entry.subTicketNo, { stage: 'ENGRAVING', craftsmanUserId: engraverUserId })
      : await assignOrderApi(order.code, { stage: 'ENGRAVING', craftsmanUserId: engraverUserId })
  } catch (error) {
    toast.warning(
      `Đã lưu QC nhưng chưa giao Khắc được: ${error instanceof Error ? error.message : String(error)}. Giao lại ở chi tiết lệnh.`,
    )
    return saved
  }
}
