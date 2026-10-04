import {
  Alert,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import type { IntakeOrder } from '../api/intakeOrders'
import { formatCt } from '../api/inventory'
import { formatIntakeGram } from './intakeDisplay'
import { intakeImageStageSections } from './intakeImages'
import { IntakeImageThumbs } from './IntakeImageThumbs'
import { IntakeStatusChip } from './IntakeStatusChip'
import { RequestTypeChip } from '../orders/OrderChips'
import { formatDateShort, formatDateTime } from '../orders/catalog'

type IntakeOrderDetailDialogProps = {
  order: IntakeOrder | null
  onClose: () => void
}

export function IntakeOrderDetailDialog({ order, onClose }: IntakeOrderDetailDialogProps) {
  const sections = order ? intakeImageStageSections(order) : []
  const waxWeight = order ? formatIntakeGram(order.productWeightGram) : null
  const treeWeight = order ? formatIntakeGram(order.castingTreeWeightGram) : null
  const checkedWeight = order ? formatIntakeGram(order.waxCheckedWeightGram) : null

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
              {order.hasMold === true ? (
                <Typography variant="body2" color="text.secondary">
                  Đã có khuôn
                </Typography>
              ) : order.hasMold === false ? (
                <Typography variant="body2" color="text.secondary">
                  Cần vẽ 3D in resin
                </Typography>
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
              {order.stoneCount3d != null || order.stoneWeight3dGram ? (
                <Typography variant="body2">
                  <strong>Đá theo 3D:</strong>{' '}
                  {[
                    order.stoneCount3d != null ? `${order.stoneCount3d} viên` : null,
                    order.stoneWeight3dGram ? formatCt(order.stoneWeight3dGram) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </Typography>
              ) : null}
              {waxWeight ? (
                <Typography variant="body2">
                  <strong>Trọng lượng sáp:</strong> {waxWeight}
                </Typography>
              ) : null}
              {treeWeight ? (
                <Typography variant="body2">
                  <strong>Trọng lượng cây thông:</strong> {treeWeight}
                </Typography>
              ) : null}
              {checkedWeight ? (
                <Typography variant="body2">
                  <strong>TL thủ kho cân kiểm:</strong> {checkedWeight}
                  {order.waxCheckedByName ? ` · ${order.waxCheckedByName}` : null}
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

            <Divider />

            {sections.length ? (
              sections.map((section) => (
                <Stack key={section.status} spacing={1}>
                  <IntakeStatusChip status={section.status} />
                  <IntakeImageThumbs label={section.title} images={section.images} />
                </Stack>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                Chưa có ảnh công đoạn nào.
              </Typography>
            )}
          </Stack>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
