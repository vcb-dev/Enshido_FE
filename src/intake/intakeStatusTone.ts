import type { IntakeOrderStatus } from '../api/intakeOrders'
import type { ProductionStatus } from '../api/productionOrders'
import { STATUS_META } from '../orders/catalog'
import { INTAKE_STATUS_META } from './catalog'

type ChipTone = { label: string; bg: string; fg: string }

/**
 * Màu + nhãn trạng thái của một đơn ở màn Tạo đơn. BE trả thẳng trạng thái lệnh SX cho đơn chưa
 * cắt cây, nên có lúc là trạng thái không thuộc luồng tạo đơn — thủ kho đổi đơn đang ở bước sáp
 * sang Sửa 3D / Sản xuất lỗi, hay lô SX SLL đúc hỏng chốt Lỗi. Tra thẳng INTAKE_STATUS_META khi
 * đó ra undefined và cả màn hình sập; lấy nhãn lệnh SX thay vào.
 */
export function intakeStatusTone(status: IntakeOrderStatus | ProductionStatus | string): ChipTone {
  return (
    INTAKE_STATUS_META[status as IntakeOrderStatus] ??
    STATUS_META[status as ProductionStatus] ?? { label: String(status), bg: '#eee8df', fg: '#4a3d2f' }
  )
}
