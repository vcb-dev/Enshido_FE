import type { ReactNode } from 'react'
import {
  Alert,
  Box,
  Breadcrumbs,
  Chip,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { getOrderReferenceApi, type OrderReference } from '../api/productionOrders'
import { formatStockedDate } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import { PageHeader } from '../components/ui'
import { STAGE_LABEL } from '../orders/catalog'
import { StatusChip, SubTicketStateChip } from '../orders/OrderChips'

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

  if (detail.isLoading) {
    return (
      <Stack sx={{ py: 6, alignItems: 'center' }}>
        <CircularProgress size={28} />
      </Stack>
    )
  }
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

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Sản phẩm
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {order.images.length ? (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0, flexWrap: 'wrap' }}>
              {order.images.slice(0, 3).map((image) => (
                <Box
                  key={image.id}
                  component="a"
                  href={image.url}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ display: 'block', width: 96, height: 96 }}
                >
                  <Box
                    component="img"
                    src={cloudinaryThumb(image.url, 192)}
                    alt=""
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: '1px solid #d5dbe0',
                    }}
                  />
                </Box>
              ))}
            </Stack>
          ) : null}
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {order.description}
            </Typography>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <Info label="Số lượng đơn" value={order.qty} />
              <Info label="Ngày cần trả" value={order.dueDate ? formatStockedDate(order.dueDate) : null} />
              <Info label="Size" value={order.sizeLabel ?? order.size} />
              <Info label="Chất liệu" value={order.mainMaterial} />
              <Info label="Màu xi" value={order.platingColor} />
              <Info label="Màu đá" value={order.stoneColor} />
              <Info label="Loại đá" value={order.stoneTypes.join(', ')} />
              <Info label="Số lượng đá" value={order.stoneCount} />
            </Box>
            <Info label="Nội dung khắc laser" value={order.laserEngraving} />
            <Info label="Yêu cầu khác" value={order.otherRequirements} />
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

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
        {value == null || value === '' ? '—' : value}
      </Typography>
    </Box>
  )
}
