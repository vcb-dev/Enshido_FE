import { useState } from 'react'
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { getOrderReferenceApi, type OrderReference } from '../api/productionOrders'
import { formatStockedDate } from '../api/inventory'
import { ImageLightbox, ZoomThumb } from '../components/ImageLightbox'
import { PageHeader, TicketDetailSkeleton } from '../components/ui'
import { STAGE_LABEL } from '../orders/catalog'
import { StatusChip, SubTicketStateChip } from '../orders/OrderChips'
import { VerticalInfoList } from '../orders/VerticalInfoList'

/**
 * Thợ quét QR trên phiếu giấy đã in sẽ vào đây thay vì màn quản lý đơn: đủ thông số để làm
 * hàng, kèm danh sách phiếu con để bấm sang phiếu của mình. Không có thao tác nào.
 */
export function OrderReferencePage() {
  const { code = '' } = useParams()
  const detail = useQuery({
    queryKey: ['production-order-reference', code],
    queryFn: () => getOrderReferenceApi(code),
    staleTime: 30_000,
  })

  if (detail.isLoading) return <TicketDetailSkeleton maxWidth={820} />
  if (!detail.data) {
    return (
      <Alert severity="error">
        {detail.error instanceof Error ? detail.error.message : `Không tìm thấy đơn ${code}`}
      </Alert>
    )
  }
  return <ReferenceView order={detail.data} />
}

function ReferenceView({ order }: { order: OrderReference }) {
  // Hàng ảnh chỉ hiện 3 ảnh đầu; hộp xem ảnh lướt được hết.
  const shown = order.images.slice(0, 3)
  const [viewing, setViewing] = useState<number | null>(null)
  return (
    <Stack spacing={1.5} sx={{ pb: 3, maxWidth: 820 }}>
      <PageHeader
        title={`Đơn ${order.code}`}
        titleAdornment={<StatusChip status={order.status} />}
        subtitle={`${order.qty} sản phẩm · thông tin tham khảo`}
        breadcrumbs={
          <Breadcrumbs>
            <Link component={RouterLink} to="/my-tickets" underline="hover" color="inherit">
              Phiếu của tôi
            </Link>
            <Typography color="text.primary">{order.code}</Typography>
          </Breadcrumbs>
        }
      />

      <Alert severity="info">
        Trang chỉ để xem thông số làm hàng. Chọn phiếu con của bạn bên dưới để nhận khâu và
        báo làm xong.
      </Alert>

      <WorkerOverview order={order} />

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Sản phẩm
        </Typography>
        <Stack spacing={2}>
          {order.images.length ? (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0, flexWrap: 'wrap' }}>
              {shown.map((image, index) => (
                <ZoomThumb
                  key={image.id}
                  url={image.url}
                  label={`Xem ảnh lớn ${index + 1}/${order.images.length}`}
                  more={index === shown.length - 1 ? order.images.length - shown.length : 0}
                  onClick={() => setViewing(index)}
                />
              ))}
            </Stack>
          ) : null}
          <ImageLightbox
            images={order.images}
            index={viewing}
            title="Ảnh đơn hàng"
            onIndexChange={setViewing}
            onClose={() => setViewing(null)}
          />
          <Stack spacing={1.25} sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {order.description}
            </Typography>
            <Box sx={{ px: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <VerticalInfoList
                items={[
                  { label: 'Số lượng đơn', value: order.qty },
                  { label: 'Ngày cần trả', value: order.dueDate ? formatStockedDate(order.dueDate) : null },
                  { label: 'Size', value: order.sizeLabel ?? order.size },
                  { label: 'Chất liệu', value: order.mainMaterial },
                  { label: 'Màu xi', value: order.platingColor },
                  { label: 'Màu đá', value: order.stoneColor },
                  { label: 'Loại đá', value: order.stoneTypes.join(', ') },
                  { label: 'Số lượng đá', value: order.stoneCount },
                  { label: 'Nội dung khắc laser', value: order.laserEngraving },
                  { label: 'Yêu cầu khác', value: order.otherRequirements },
                ]}
              />
            </Box>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Phiếu con của đơn
        </Typography>
        {order.subTickets.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Đơn chưa chia phiếu con nào.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {order.subTickets.map((ticket) => (
              <Stack
                key={ticket.code}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Link
                  component={RouterLink}
                  to={`/tickets/${ticket.code}`}
                  sx={{ fontWeight: 700, minWidth: 96 }}
                >
                  {ticket.code}
                </Link>
                <Chip size="small" label={`${ticket.qty} sp`} sx={{ borderRadius: 1 }} />
                <SubTicketStateChip state={ticket.state} />
                <Typography variant="body2" color="text.secondary">
                  {ticket.activeStage ? `Khâu ${STAGE_LABEL[ticket.activeStage]}` : '—'}
                  {ticket.claimedByName ? ` · thợ ${ticket.claimedByName}` : ''}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  )
}

function WorkerOverview({ order }: { order: OrderReference }) {
  const count = (state: OrderReference['subTickets'][number]['state']) =>
    order.subTickets.filter((ticket) => ticket.state === state).length
  const actionable =
    order.subTickets.find((ticket) => ticket.state === 'WORKING') ??
    order.subTickets.find((ticket) => ticket.state === 'CLAIMED') ??
    order.subTickets.find((ticket) => ticket.state === 'WAITING') ??
    order.subTickets.find((ticket) => ticket.state === 'SUBMITTED')

  let title = 'Chưa có phiếu nào cần xử lý'
  let detail = 'Theo dõi trạng thái đơn và chờ người điều hành mở khâu.'
  if (count('WORKING') > 0) {
    title = `${count('WORKING')} phiếu đang được thực hiện`
    detail = 'Mở đúng phiếu của bạn; làm xong thì báo hoàn thành và nộp hàng cho KCS.'
  } else if (count('CLAIMED') > 0) {
    title = `${count('CLAIMED')} phiếu đã có thợ nhận`
    detail = 'Chờ người giao cân bạc và xác nhận giao trước khi bắt đầu làm.'
  } else if (count('WAITING') > 0) {
    title = `${count('WAITING')} phiếu đang chờ thợ nhận`
    detail = 'Chọn phiếu đúng khâu của bạn và bấm nhận phiếu.'
  } else if (count('SUBMITTED') > 0) {
    title = `${count('SUBMITTED')} phiếu đã báo xong`
    detail = 'Mang hàng tới KCS và chờ cân nhận lại.'
  }

  return (
    <Paper sx={{ p: 2, border: '1px solid', borderColor: 'primary.light', bgcolor: '#fbf4e8' }}>
      <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
        Việc cần làm
      </Typography>
      <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
        {detail}
      </Typography>
      {actionable ? (
        <Button
          component={RouterLink}
          to={`/tickets/${actionable.code}`}
          variant="contained"
          sx={{ mt: 1.25 }}
        >
          Mở phiếu {actionable.code}
        </Button>
      ) : null}
    </Paper>
  )
}
