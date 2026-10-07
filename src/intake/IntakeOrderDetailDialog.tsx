import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import type { IntakeOrder } from '../api/intakeOrders'
import { formatCt } from '../api/inventory'
import { formatIntakeGram } from './intakeDisplay'
import { intakeCastingTreeImages, intakeDetailImages, intakeProductOnlyImages } from './intakeImages'
import { IntakeImageThumbs } from './IntakeImageThumbs'
import { IntakeStatusChip } from './IntakeStatusChip'
import { RequestTypeChip } from '../orders/OrderChips'
import { formatDateShort, formatDateTime } from '../orders/catalog'

type IntakeOrderDetailDialogProps = {
  order: IntakeOrder | null
  onClose: () => void
}

export function IntakeOrderDetailDialog({ order, onClose }: IntakeOrderDetailDialogProps) {
  const waxWeight = order ? formatIntakeGram(order.productWeightGram) : null
  const treeWeight = order ? formatIntakeGram(order.castingTreeWeightGram) : null
  const checkedWeight = order ? formatIntakeGram(order.waxCheckedWeightGram) : null
  const stoneLine = order
    ? [
        order.stoneCount3d != null ? `${order.stoneCount3d} viên` : null,
        order.stoneWeight3dGram ? formatCt(order.stoneWeight3dGram) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const detailImages = order ? intakeDetailImages(order.images) : []
  const waxImages = order ? intakeProductOnlyImages(order.images) : []
  const treeImages = order ? intakeCastingTreeImages(order.images) : []
  const hasWaxSpecs = Boolean(
    waxWeight ||
      checkedWeight ||
      stoneLine ||
      order?.hasMold === true ||
      order?.hasMold === false,
  )
  const hasStages = Boolean(detailImages.length || hasWaxSpecs || waxImages.length || treeWeight || treeImages.length)

  return (
    <Dialog open={Boolean(order)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Chi tiết đơn — {order?.code ?? ''}</DialogTitle>
      <DialogContent>
        {order ? (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Stack spacing={0.75}>
              <Typography variant="body2">
                <strong>Tên SP:</strong> {order.productName?.trim() || '—'}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <IntakeStatusChip status={order.status} />
                <RequestTypeChip type={order.requestType} />
                <Typography variant="body2" color="text.secondary">
                  SL {order.qty}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Ngày tạo {formatDateShort(order.createdAt)}
                {order.dueDate ? ` · Trả ${formatDateShort(order.dueDate)}` : null}
              </Typography>
              {order.description?.trim() ? (
                <Typography variant="body2">{order.description}</Typography>
              ) : null}
              {order.model3dUrl?.trim() ? (
                <Typography variant="body2">
                  <strong>Link file 3D:</strong>{' '}
                  {/^https?:\/\//i.test(order.model3dUrl.trim()) ? (
                    <Link href={order.model3dUrl.trim()} target="_blank" rel="noreferrer">
                      {order.model3dUrl.trim()}
                    </Link>
                  ) : (
                    order.model3dUrl.trim()
                  )}
                </Typography>
              ) : null}
            </Stack>

            {order.status === 'REJECTED' ? (
              <Alert severity="error" sx={{ py: 0.25 }}>
                <Typography variant="body2">
                  <strong>Lý do từ chối:</strong> {order.rejectReason?.trim() || 'Không ghi lý do'}
                </Typography>
                {order.rejectedByName || order.rejectedAt ? (
                  <Typography variant="caption" color="text.secondary">
                    {[order.rejectedByName, order.rejectedAt ? formatDateTime(order.rejectedAt) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                ) : null}
              </Alert>
            ) : null}

            {order.productionOrderCode ? (
              <Button
                component={RouterLink}
                to={`/orders/${order.productionOrderCode}`}
                variant="contained"
                onClick={onClose}
                sx={{ alignSelf: 'flex-start' }}
              >
                Xem chi tiết phiếu sản xuất
              </Button>
            ) : null}

            <Divider />

            {detailImages.length ? (
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Chờ duyệt — ảnh chi tiết
                </Typography>
                <IntakeImageThumbs label="Ảnh chi tiết" images={detailImages} />
              </Stack>
            ) : null}

            {hasWaxSpecs || waxImages.length ? (
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Số liệu sáp / sản phẩm
                </Typography>
                {order.hasMold === true ? (
                  <Typography variant="body2">
                    <strong>Khuôn:</strong> Đã có khuôn
                  </Typography>
                ) : order.hasMold === false ? (
                  <Typography variant="body2">
                    <strong>Khuôn:</strong> Cần vẽ 3D in resin
                  </Typography>
                ) : null}
                {waxWeight ? (
                  <Typography variant="body2">
                    <strong>Trọng lượng sáp:</strong> {waxWeight}
                  </Typography>
                ) : null}
                {stoneLine ? (
                  <Typography variant="body2">
                    <strong>Đá theo 3D:</strong> {stoneLine}
                  </Typography>
                ) : null}
                {checkedWeight ? (
                  <Typography variant="body2">
                    <strong>TL thủ kho cân kiểm:</strong> {checkedWeight}
                    {order.waxCheckedByName ? ` · ${order.waxCheckedByName}` : null}
                  </Typography>
                ) : null}
                {waxImages.length ? <IntakeImageThumbs label="Số liệu sáp / sản phẩm" images={waxImages} /> : null}
              </Stack>
            ) : null}

            {treeWeight || treeImages.length ? (
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Cấy cây thông
                </Typography>
                {treeWeight ? (
                  <Typography variant="body2">
                    <strong>Trọng lượng cây thông:</strong> {treeWeight}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Chưa có số liệu.
                  </Typography>
                )}
                {treeImages.length ? <IntakeImageThumbs label="Cấy cây thông" images={treeImages} /> : null}
              </Stack>
            ) : null}

            {!hasStages ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có số liệu hay ảnh công đoạn.
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
