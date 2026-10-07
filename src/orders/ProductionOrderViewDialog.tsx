import {
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import {
  getProductionOrderApi,
  type OrderImage,
  type ProductionOrderDetail,
  type ProductionOrderRow,
} from '../api/productionOrders'
import { formatCt, formatStockedDate } from '../api/inventory'
import { formatIntakeGram } from '../intake/intakeDisplay'
import { IntakeImageThumbs } from '../intake/IntakeImageThumbs'
import { formatDateShort, STATUS_META } from './catalog'
import { RequestTypeChip, StatusChip } from './OrderChips'

function optionalDimension(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

type StageSpec = { label: string; value: string | null | undefined }

function StageSection({
  title,
  specs,
  images,
}: {
  title: string
  specs: StageSpec[]
  images: OrderImage[]
}) {
  const shown = specs.filter((item) => item.value)
  if (!shown.length && !images.length) return null
  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {shown.length ? (
        <Stack spacing={0.35}>
          {shown.map((item) => (
            <Typography key={item.label} variant="body2">
              <strong>{item.label}:</strong> {item.value}
            </Typography>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Chưa có số liệu.
        </Typography>
      )}
      {images.length ? <IntakeImageThumbs label={title} images={images} /> : null}
    </Stack>
  )
}

function toImages(raw: Array<OrderImage | ProductionOrderRow['images'][number]>): OrderImage[] {
  return raw.map((image) => ({
    id: image.id,
    kind: image.kind,
    url: image.url,
    publicId:
      'publicId' in image && typeof image.publicId === 'string' ? image.publicId : image.id,
    width: 'width' in image ? optionalDimension(image.width) : null,
    height: 'height' in image ? optionalDimension(image.height) : null,
  }))
}

function imagesOf(images: OrderImage[], kind: OrderImage['kind']) {
  return images.filter((image) => image.kind === kind)
}

function stoneLine(count: number | null | undefined, weight: string | null | undefined) {
  const parts = [
    count != null ? `${count} viên` : null,
    weight ? formatCt(weight) : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
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
  const images = toImages(detail.data?.images ?? row?.images ?? [])
  const specs = detail.data

  return (
    <Dialog open={Boolean(row)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {row?.status === 'WAIT_FILING' ? 'Chi tiết các khâu trước' : 'Chi tiết lệnh'}
        {code ? ` — ${code}` : ''}
      </DialogTitle>
      <DialogContent>
        {!order ? null : detail.isLoading && !detail.data ? (
          <Stack sx={{ py: 3, alignItems: 'center' }}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <HeaderBlock order={order} />

            <Divider />

            <StageSection
              title="Chờ duyệt — ảnh chi tiết"
              specs={[]}
              images={imagesOf(images, 'DETAIL')}
            />
            <StageSection
              title="Số liệu sáp / sản phẩm"
              specs={waxSpecs(specs)}
              images={imagesOf(images, 'PRODUCT')}
            />
            <StageSection
              title="Cấy cây thông"
              specs={[
                { label: 'Trọng lượng cây thông', value: formatIntakeGram(specs?.castingTreeWeightGram) },
              ]}
              images={imagesOf(images, 'CASTING_TREE')}
            />
            <CutStageSection
              order={specs}
              blankImages={imagesOf(images, 'CUT_BLANK')}
            />

            {!images.length && !hasAnyStageSpec(specs) ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có số liệu hay ảnh công đoạn.
              </Typography>
            ) : null}

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

function HeaderBlock({ order }: { order: ProductionOrderRow | ProductionOrderDetail }) {
  return (
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
      {order.description?.trim() ? (
        <Typography variant="body2">{order.description}</Typography>
      ) : null}
    </Stack>
  )
}

function waxSpecs(order: ProductionOrderDetail | undefined): StageSpec[] {
  if (!order) return []
  return [
    {
      label: 'Khuôn',
      value:
        order.hasMold === true ? 'Đã có khuôn' : order.hasMold === false ? 'Cần vẽ 3D in resin' : null,
    },
    { label: 'Trọng lượng sáp', value: formatIntakeGram(order.productWeightGram) },
    { label: 'Đá theo 3D', value: stoneLine(order.stoneCount, order.stoneWeight) },
    {
      label: 'TL thủ kho cân kiểm',
      value: formatIntakeGram(order.waxCheckedWeightGram)
        ? `${formatIntakeGram(order.waxCheckedWeightGram)}${order.waxCheckedByName ? ` · ${order.waxCheckedByName}` : ''}`
        : null,
    },
  ]
}

function CutStageSection({
  order,
  blankImages,
}: {
  order: ProductionOrderDetail | undefined
  blankImages: OrderImage[]
}) {
  const restImages: OrderImage[] = (order?.cut?.restImages ?? []).map((image, index) => ({
    kind: 'CASTING_TREE',
    url: image.url,
    publicId: image.publicId,
    width: image.width,
    height: image.height,
    sortOrder: index,
  }))
  if (!order?.cut && !blankImages.length && !restImages.length) return null
  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        Cắt cây thông
      </Typography>
      {order?.cut ? (
        <Stack spacing={0.35}>
          <Typography variant="body2">
            <strong>Số phôi:</strong> {order.cut.qty}
          </Typography>
          <Typography variant="body2">
            <strong>Trọng lượng phôi:</strong> {formatIntakeGram(order.cut.weight) ?? '—'}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Chưa có số liệu phôi.
        </Typography>
      )}
      {blankImages.length ? (
        <IntakeImageThumbs label="Ảnh cân phôi" images={blankImages} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Chưa có ảnh cân phôi.
        </Typography>
      )}
      <Typography variant="body2">
        <strong>Phần cây còn lại:</strong>{' '}
        {formatIntakeGram(order?.cut?.restWeightGram) ?? '—'}
      </Typography>
      {restImages.length ? (
        <IntakeImageThumbs label="Ảnh cân phần cây còn lại" images={restImages} />
      ) : Number(order?.cut?.restWeightGram) > 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có ảnh cân phần cây còn lại.
        </Typography>
      ) : null}
    </Stack>
  )
}

function hasAnyStageSpec(order: ProductionOrderDetail | undefined) {
  return Boolean(
    order &&
      (waxSpecs(order).some((item) => item.value) ||
        formatIntakeGram(order.castingTreeWeightGram) ||
        order.cut),
  )
}
