import {
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import {
  getProductionOrderApi,
  type OrderImage,
  type ProductionOrderRow,
} from '../api/productionOrders'
import { formatStockedDate } from '../api/inventory'
import { IntakeImageThumbs } from '../intake/IntakeImageThumbs'
import { formatDateShort, STATUS_META } from './catalog'
import { RequestTypeChip, StatusChip } from './OrderChips'

function optionalDimension(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const IMAGE_KIND_LABEL: Record<string, string> = {
  DETAIL: 'Ảnh chi tiết',
  PRODUCT: 'Ảnh sản phẩm',
  CASTING_TREE: 'Ảnh cây thông',
}

type ProductionOrderViewDialogProps = {
  row: ProductionOrderRow | null
  onClose: () => void
}

export function ProductionOrderViewDialog({ row, onClose }: ProductionOrderViewDialogProps) {
  const code = row?.code ?? null
  const detail = useQuery({
    queryKey: ['production-order', code],
    queryFn: () => getProductionOrderApi(code!),
    enabled: Boolean(code),
    staleTime: 30_000,
  })

  const order = detail.data ?? row
  const rawImages = detail.data?.images ?? row?.images ?? []
  const images: OrderImage[] = rawImages.map((image) => ({
    id: image.id,
    kind: image.kind,
    url: image.url,
    publicId:
      'publicId' in image && typeof image.publicId === 'string' ? image.publicId : image.id,
    width: 'width' in image ? optionalDimension(image.width) : null,
    height: 'height' in image ? optionalDimension(image.height) : null,
  }))

  const imagesByKind = new Map<string, typeof images>()
  for (const image of images) {
    const list = imagesByKind.get(image.kind) ?? []
    list.push(image)
    imagesByKind.set(image.kind, list)
  }

  return (
    <Dialog open={Boolean(row)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Chi tiết lệnh — {code ?? ''}</DialogTitle>
      <DialogContent>
        {!order ? null : detail.isLoading && !detail.data ? (
          <Stack sx={{ py: 3, alignItems: 'center' }}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Stack spacing={0.75}>
              <Typography variant="body2">
                <strong>Tên SP:</strong> {order.productName?.trim() || '—'}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusChip status={order.status} />
                <RequestTypeChip type={order.requestType} />
                <Typography variant="body2" color="text.secondary">
                  SL {order.qty}
                  {order.qtyUnit ? ` ${order.qtyUnit}` : ''}
                  {order.returnedQty ? ` · đã trả ${order.returnedQty}` : ''}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Ngày đặt {formatStockedDate(order.receivedDate)}
                {order.dueDate ? ` · Trả ${formatDateShort(order.dueDate)}` : null}
              </Typography>
              {order.closedBy ? (
                <Typography variant="body2" color="text.secondary">
                  Người chốt: {order.closedBy}
                </Typography>
              ) : null}
              {order.trackingCode?.trim() ? (
                <Typography variant="body2" color="text.secondary">
                  Mã sản phẩm: {order.trackingCode}
                </Typography>
              ) : null}
              {order.description?.trim() ? (
                <Typography variant="body2">{order.description}</Typography>
              ) : null}
            </Stack>

            <Divider />

            {imagesByKind.size ? (
              [...imagesByKind.entries()].map(([kind, kindImages]) => (
                <Stack key={kind} spacing={1}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {IMAGE_KIND_LABEL[kind] ?? kind}
                  </Typography>
                  <IntakeImageThumbs
                    label={IMAGE_KIND_LABEL[kind] ?? kind}
                    images={kindImages}
                  />
                </Stack>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                Chưa có ảnh.
              </Typography>
            )}

            {detail.isError ? (
              <Typography variant="caption" color="warning.main">
                Không tải thêm được chi tiết — đang hiển thị dữ liệu từ danh sách (
                {STATUS_META[order.status].label}).
              </Typography>
            ) : null}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}
