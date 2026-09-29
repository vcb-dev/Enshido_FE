import {
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import type { IntakeOrder } from '../api/intakeOrders'
import { intakeImageStageSections } from './intakeImages'
import { IntakeImageThumbs } from './IntakeImageThumbs'
import { IntakeStatusChip } from './IntakeStatusChip'
import { RequestTypeChip } from '../orders/OrderChips'
import { formatDateShort } from '../orders/catalog'

type IntakeOrderDetailDialogProps = {
  order: IntakeOrder | null
  onClose: () => void
}

export function IntakeOrderDetailDialog({ order, onClose }: IntakeOrderDetailDialogProps) {
  const sections = order ? intakeImageStageSections(order) : []

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
                Ngày tạo {formatDateShort(order.createdDate)}
                {order.dueDate ? ` · Trả ${formatDateShort(order.dueDate)}` : null}
              </Typography>
              {order.description?.trim() ? (
                <Typography variant="body2">{order.description}</Typography>
              ) : null}
            </Stack>

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
