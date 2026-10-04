import { useState } from 'react'
import { Alert, Box, Button, ButtonBase, Chip, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EventIcon from '@mui/icons-material/Event'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { getOrderReferenceApi, type OrderReference } from '../api/productionOrders'
import { formatStockedDate } from '../api/inventory'
import { ImageLightbox, ZoomThumb } from '../components/ImageLightbox'
import { TicketDetailSkeleton } from '../components/ui'
import { STAGE_LABEL } from '../orders/catalog'
import { StatusChip, SubTicketStateChip } from '../orders/OrderChips'
import { dueInfo, FactGrid, MetaItem, SectionCard, TicketThumb } from '../worker/WorkerUi'

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
      <Stack spacing={2}>
        <BackLink />
        <Alert severity="error">
          {detail.error instanceof Error ? detail.error.message : `Không tìm thấy đơn ${code}`}
        </Alert>
      </Stack>
    )
  }
  return <ReferenceView order={detail.data} />
}

function BackLink() {
  return (
    <Button
      component={RouterLink}
      to="/my-tickets"
      startIcon={<ArrowBackIcon />}
      color="inherit"
      sx={{ alignSelf: 'flex-start', color: 'text.secondary', ml: -1 }}
    >
      Phiếu của tôi
    </Button>
  )
}

function ReferenceView({ order }: { order: OrderReference }) {
  // Hàng ảnh chỉ hiện 4 ảnh đầu; hộp xem ảnh lướt được hết.
  const shown = order.images.slice(0, 4)
  const [viewing, setViewing] = useState<number | null>(null)
  const due = dueInfo(order.dueDate)
  return (
    <Stack spacing={{ xs: 1.5, md: 2 }}>
      <BackLink />

      <SectionCard>
        <Stack direction="row" spacing={{ xs: 1.5, md: 2 }} sx={{ alignItems: 'flex-start' }}>
          <TicketThumb url={order.images[0]?.url} size={72} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
                Đơn {order.code}
              </Typography>
              <StatusChip status={order.status} />
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {order.description}
            </Typography>
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 0.75, flexWrap: 'wrap' }}>
              <MetaItem icon={<Inventory2OutlinedIcon />}>{order.qty} sp</MetaItem>
              {due ? (
                <MetaItem icon={<EventIcon />} tone={due.tone}>
                  {due.label}
                </MetaItem>
              ) : null}
            </Stack>
          </Box>
        </Stack>
      </SectionCard>

      <WorkerOverview order={order} />

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, md: 2 },
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.4fr) minmax(300px, 1fr)' },
          alignItems: 'start',
        }}
      >
        <SectionCard title={`Phiếu con (${order.subTickets.length})`}>
          {order.subTickets.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Đơn chưa chia phiếu con nào.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {order.subTickets.map((ticket) => (
                <ButtonBase
                  key={ticket.code}
                  component={RouterLink}
                  to={`/tickets/${ticket.code}`}
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    gap: 1.25,
                    p: 1.25,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 800 }}>{ticket.code}</Typography>
                      <Chip size="small" label={`${ticket.qty} sp`} sx={{ height: 22, borderRadius: 1 }} />
                      <SubTicketStateChip state={ticket.state} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {ticket.activeStage ? `Khâu ${STAGE_LABEL[ticket.activeStage]}` : 'Chưa mở khâu'}
                      {ticket.claimedByName ? ` · thợ ${ticket.claimedByName}` : ''}
                    </Typography>
                  </Box>
                  <ChevronRightIcon sx={{ color: 'text.disabled' }} />
                </ButtonBase>
              ))}
            </Stack>
          )}
        </SectionCard>

        <SectionCard title="Thông số sản phẩm">
          {shown.length ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, mb: 2 }}>
              {shown.map((image, index) => (
                <ZoomThumb
                  key={image.id}
                  url={image.url}
                  size={120}
                  label={`Xem ảnh lớn ${index + 1}/${order.images.length}`}
                  more={index === shown.length - 1 ? order.images.length - shown.length : 0}
                  onClick={() => setViewing(index)}
                  sx={{ width: '100%', height: 'auto', aspectRatio: '1 / 1' }}
                />
              ))}
            </Box>
          ) : null}
          <ImageLightbox
            images={order.images}
            index={viewing}
            title="Ảnh đơn hàng"
            onIndexChange={setViewing}
            onClose={() => setViewing(null)}
          />
          <FactGrid
            columns={{ xs: 2 }}
            items={[
              { label: 'Số lượng đơn', value: `${order.qty} sp` },
              { label: 'Ngày cần trả', value: order.dueDate ? formatStockedDate(order.dueDate) : null },
              { label: 'Size', value: order.sizeLabel ?? order.size },
              { label: 'Chất liệu', value: order.mainMaterial },
              { label: 'Màu xi', value: order.platingColor },
              { label: 'Màu đá', value: order.stoneColor },
              { label: 'Loại đá', value: order.stoneTypes.join(', ') },
              { label: 'Số lượng đá', value: order.stoneCount },
              { label: 'Khắc laser', value: order.laserEngraving },
              { label: 'Yêu cầu khác', value: order.otherRequirements },
            ]}
          />
        </SectionCard>
      </Box>
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
  let detail = 'Trang chỉ để xem thông số. Chờ người giao mở khâu cho phiếu con.'
  if (count('WORKING') > 0) {
    title = `${count('WORKING')} phiếu đang được làm`
    detail = 'Mở đúng phiếu của bạn; làm xong thì báo hoàn thành và nộp hàng cho QC.'
  } else if (count('CLAIMED') > 0) {
    title = `${count('CLAIMED')} phiếu đã có thợ nhận`
    detail = 'Chờ người giao cân bạc và xác nhận giao trước khi bắt đầu làm.'
  } else if (count('WAITING') > 0) {
    title = `${count('WAITING')} phiếu đang chờ thợ nhận`
    detail = 'Chọn phiếu đúng khâu của bạn và bấm nhận phiếu.'
  } else if (count('SUBMITTED') > 0) {
    title = `${count('SUBMITTED')} phiếu đã báo xong`
    detail = 'Mang hàng tới QC và chờ cân nhận lại.'
  }

  return (
    <SectionCard sx={{ borderColor: 'primary.light', bgcolor: '#fbf4e8' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Việc cần làm
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {detail}
          </Typography>
        </Box>
        {actionable ? (
          <Button component={RouterLink} to={`/tickets/${actionable.code}`} variant="contained" size="large" sx={{ flexShrink: 0 }}>
            Mở phiếu {actionable.code}
          </Button>
        ) : null}
      </Stack>
    </SectionCard>
  )
}
