import type { IntakeOrder, IntakeOrderStatus } from '../api/intakeOrders'
import type { OrderImage } from '../api/productionOrders'
import { INTAKE_STATUS_META } from './catalog'

/** Ảnh lúc tạo đơn — cột Ảnh chi tiết. */
export function intakeDetailImages(images: OrderImage[]) {
  return images.filter((image) => image.kind === 'DETAIL')
}

/** Ảnh sau bước cập nhật số liệu sản phẩm. */
export function intakeProductOnlyImages(images: OrderImage[]) {
  return images.filter((image) => image.kind === 'PRODUCT')
}

/** Ảnh sau bước cập nhật cây thông. */
export function intakeCastingTreeImages(images: OrderImage[]) {
  return images.filter((image) => image.kind === 'CASTING_TREE')
}

/** @deprecated Dùng intakeProductOnlyImages / intakeCastingTreeImages. */
export function intakeProductImages(images: OrderImage[]) {
  return images.filter(
    (image) => image.kind === 'PRODUCT' || image.kind === 'CASTING_TREE',
  )
}

export type IntakeImageStageSection = {
  /** Trạng thái công đoạn lúc tải ảnh. */
  status: IntakeOrderStatus
  title: string
  images: OrderImage[]
}

/** Thứ tự công đoạn trên luồng đơn tạo (theo trạng thái). */
const INTAKE_IMAGE_STAGES: Array<{
  status: IntakeOrderStatus
  pick: (images: OrderImage[]) => OrderImage[]
}> = [
  { status: 'PENDING_APPROVAL', pick: intakeDetailImages },
  { status: 'READY_FOR_PRODUCTION', pick: intakeProductOnlyImages },
  { status: 'WAX_PRINTED', pick: intakeCastingTreeImages },
]

function stageLabel(status: IntakeOrderStatus) {
  return INTAKE_STATUS_META[status].label
}

/** Nhóm ảnh theo công đoạn (trạng thái) — dialog Xem chi tiết. */
export function intakeImageStageSections(row: IntakeOrder): IntakeImageStageSection[] {
  return INTAKE_IMAGE_STAGES.map(({ status, pick }) => ({
    status,
    title: stageLabel(status),
    images: pick(row.images),
  })).filter((section) => section.images.length > 0)
}

/**
 * Ảnh hiển thị trên bảng Lệnh sản xuất — chỉ ảnh của công đoạn đang thể hiện trên dòng,
 * không gộp tất cả bước.
 */
export function intakeProductionStageColumn(row: IntakeOrder): {
  label: string
  images: OrderImage[]
} {
  const { status, images } = row
  if (
    status === 'PENDING_APPROVAL' ||
    status === 'APPROVED' ||
    status === 'READY_FOR_PRODUCTION'
  ) {
    return { label: 'Ảnh công đoạn', images: [] }
  }

  const tree = intakeCastingTreeImages(images)
  const product = intakeProductOnlyImages(images)

  if (
    tree.length > 0 &&
    (status === 'PENDING_WAREHOUSE_CONFIRMATION' ||
      status === 'WAX_CONFIRMED' ||
      status === 'WAIT_CASTING')
  ) {
    return { label: stageLabel('WAX_PRINTED'), images: tree }
  }

  if (product.length > 0) {
    return { label: stageLabel('READY_FOR_PRODUCTION'), images: product }
  }

  return { label: 'Ảnh công đoạn', images: [] }
}

/** Giữ ảnh công đoạn (PRODUCT, CASTING_TREE) khi sửa đơn tạo — chỉ đổi DETAIL. */
export function intakeWorkflowImages(images: OrderImage[]) {
  return images.filter((image) => image.kind !== 'DETAIL')
}
