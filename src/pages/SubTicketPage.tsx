import { useState } from 'react'
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { can, isWorkerOnly, Permission } from '../auth/permissions'
import {
  getSubTicketOrderApi,
  parseSubTicketCode,
  type OrderWorkTicket,
  type ProductionOrderDetail,
  type StageEntry,
  type SubTicket,
} from '../api/productionOrders'
import { formatQty, formatStockedDate } from '../api/inventory'
import { ImageLightbox, ZoomThumb } from '../components/ImageLightbox'
import { PageHeader, TicketDetailSkeleton } from '../components/ui'
import { formatDateShort, SILVER_LOSS_TONE, silverLossLevel, STAGE_LABEL } from '../orders/catalog'
import { StatusChip, SubTicketStateChip } from '../orders/OrderChips'
import { SubTicketMatrixCard } from '../orders/SubTicketMatrixCard'
import { TicketMatrix } from '../orders/TicketMatrix'
import { VerticalInfoList } from '../orders/VerticalInfoList'
import { useQueuedSubTickets, useSubTicketAction } from '../orders/subTicketActions'
import { queuedLabel, type SubTicketAction } from '../orders/subTicketQueue'

/** Trang phiếu con mở từ QR: thợ xem phần việc của mình và bấm nhận khâu đang mở. */
export function SubTicketPage() {
  const { ticketCode = '' } = useParams()
  const parsed = parseSubTicketCode(ticketCode)
  const orderCode = parsed?.orderCode ?? ticketCode.trim().toUpperCase()

  // Đi qua đường phiếu con: tài khoản thợ bị chặn khỏi endpoint đơn mẹ. Vẫn dùng chung
  // queryKey với các mutation phiếu con để cache không bị lệch.
  const detail = useQuery({
    queryKey: ['production-order', orderCode],
    queryFn: () => getSubTicketOrderApi(ticketCode),
    enabled: Boolean(orderCode),
    staleTime: 10_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  if (detail.isLoading) return <TicketDetailSkeleton />
  const order = detail.data
  const ticket = parsed ? order?.subTickets.find((item) => item.no === parsed.no) : null
  const parentTicket = parsed ? null : order?.workTicket
  if (!order || (!ticket && !parentTicket)) {
    // Mất mạng mà phiếu này chưa từng được tải về: nói đúng lý do, đừng để thợ tưởng là
    // quét nhầm mã. Phiếu thuộc phần việc của mình thì màn "Phiếu của tôi" đã kéo sẵn.
    if (detail.isPaused) {
      return (
        <Alert severity="warning">
          Đang ngoại tuyến và máy chưa tải phiếu {ticketCode} lần nào — mở lại khi có mạng.
        </Alert>
      )
    }
    return (
      <Alert severity="error">
        {detail.error instanceof Error ? detail.error.message : `Không tìm thấy phiếu ${ticketCode}`}
      </Alert>
    )
  }
  return ticket ? (
    <TicketView order={order} ticket={ticket} />
  ) : (
    <ParentTicketView order={order} ticket={parentTicket!} />
  )
}

function ParentTicketView({ order, ticket }: { order: ProductionOrderDetail; ticket: OrderWorkTicket }) {
  const { user } = useAuth()
  const isWorker = can(user, Permission.PRODUCTION_WORKER)
  const workerOnly = isWorkerOnly(user)
  const claim = useSubTicketAction('claim')
  const unclaim = useSubTicketAction('unclaim')
  const submit = useSubTicketAction('submit')
  const unsubmit = useSubTicketAction('unsubmit')
  const queued = useQueuedSubTickets().get(ticket.code)
  const sending = (action: SubTicketAction) => queued?.action === action && !queued.waiting
  const vars = { orderCode: order.code, no: null, ticketCode: ticket.code }
  const entries = order.stages.filter((entry) => !entry.subTicketId)
  const openEntry = entries.find((entry) => !entry.returnedAt)
  const last = entries.at(-1)
  const mine = ticket.claimedByUserId != null && ticket.claimedByUserId === user?.id
  const workingIsMine = openEntry?.craftsmanUserId != null && openEntry.craftsmanUserId === user?.id
  const closed = order.status === 'DELIVERED' || order.finishedGoods != null
  const images = order.images.filter((image) => image.kind === 'PRODUCT')
  const pool = images.length ? images : order.images
  const shown = pool.slice(0, 3)
  const [viewing, setViewing] = useState<number | null>(null)

  return (
    <Stack spacing={1.5} sx={{ pb: 3 }}>
      <PageHeader
        title={`Phiếu sản xuất ${order.code}`}
        titleAdornment={
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <SubTicketStateChip state={ticket.state} />
            {workerOnly ? null : <StatusChip status={order.status} />}
            {queued ? <Chip size="small" color="warning" label={queuedLabel(queued)} sx={{ borderRadius: 1 }} /> : null}
          </Stack>
        }
        subtitle={`${order.qty} sp · ${order.silverWeight != null ? `${formatQty(order.silverWeight)} g bạc` : 'chưa có TL bạc'}`}
        breadcrumbs={
          <Breadcrumbs>
            {isWorker ? (
              <Link component={RouterLink} to="/my-tickets" underline="hover" color="inherit">
                Phiếu của tôi
              </Link>
            ) : null}
            {workerOnly ? null : (
              <Link component={RouterLink} to={`/orders/${order.code}?tab=production`} underline="hover" color="inherit">
                Đơn {order.code}
              </Link>
            )}
            <Typography color="text.primary">{order.code}</Typography>
          </Breadcrumbs>
        }
        actions={
          workerOnly ? undefined : (
            <Button variant="outlined" component={RouterLink} to={`/orders/${order.code}?tab=production`}>
              Mở đơn {order.code}
            </Button>
          )
        }
      />

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Khâu hiện tại
        </Typography>
        {closed ? (
          <Typography variant="body2">Đơn đã hoàn thiện / đã giao — không còn khâu nào để nhận.</Typography>
        ) : ticket.state === 'WAITING' && ticket.pendingStage ? (
          <Stack spacing={1.25}>
            <Typography variant="body2">
              Đang mở khâu <b>{STAGE_LABEL[ticket.pendingStage]}</b> — {ticket.availableQty} sp ·{' '}
              {ticket.availableSilver != null ? formatQty(ticket.availableSilver) : '—'} g bạc. Chưa có thợ nhận.
            </Typography>
            {isWorker ? (
              <Button
                variant="contained"
                size="large"
                disabled={queued != null}
                loading={sending('claim')}
                onClick={() => claim.mutate(vars)}
                sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
              >
                Nhận phiếu — khâu {STAGE_LABEL[ticket.pendingStage]}
              </Button>
            ) : null}
          </Stack>
        ) : ticket.state === 'CLAIMED' && ticket.pendingStage ? (
          <Stack spacing={1.25}>
            <Typography variant="body2">
              {mine ? 'Bạn' : `Thợ ${ticket.claimedByName ?? ''}`} đã nhận khâu{' '}
              <b>{STAGE_LABEL[ticket.pendingStage]}</b> lúc {formatDateShort(ticket.claimedAt)} — chờ người giao cân
              bạc và xác nhận giao.
            </Typography>
            {mine ? (
              <Button
                color="inherit"
                variant="outlined"
                disabled={queued != null}
                loading={sending('unclaim')}
                onClick={() => unclaim.mutate(vars)}
                sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
              >
                Huỷ nhận
              </Button>
            ) : null}
          </Stack>
        ) : (ticket.state === 'WORKING' || ticket.state === 'SUBMITTED') && openEntry ? (
          <Stack spacing={1.25}>
            <Typography variant="body2">
              Thợ <b>{openEntry.craftsmanName}</b> đang làm khâu <b>{STAGE_LABEL[openEntry.stage]}</b> từ{' '}
              {formatDateShort(openEntry.handedAt)} — nhận {openEntry.handedQty ?? '—'} sp ·{' '}
              {openEntry.handedSilverWeight ? formatQty(openEntry.handedSilverWeight) : '—'} g bạc.
              {ticket.state === 'SUBMITTED'
                ? ` Đã báo xong lúc ${formatDateShort(openEntry.submittedAt)} — chờ KCS cân lại.`
                : ' Làm xong thì bấm “Đã làm xong” rồi mang hàng tới KCS cân lại.'}
            </Typography>
            {workingIsMine && ticket.state === 'WORKING' ? (
              <Button
                variant="contained"
                size="large"
                disabled={queued != null}
                loading={sending('submit')}
                onClick={() => submit.mutate(vars)}
                sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
              >
                Đã làm xong — nộp cho KCS
              </Button>
            ) : null}
            {workingIsMine && ticket.state === 'SUBMITTED' ? (
              <Button
                color="inherit"
                variant="outlined"
                disabled={queued != null}
                loading={sending('unsubmit')}
                onClick={() => unsubmit.mutate(vars)}
                sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
              >
                Bỏ báo xong
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Typography variant="body2">
            {last ? `Đã xong khâu ${STAGE_LABEL[last.stage]} — chờ mở khâu tiếp theo.` : 'Chưa mở khâu nào.'}
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Sản phẩm
        </Typography>
        <Stack spacing={2}>
          {shown.length ? (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              {shown.map((image, index) => (
                <ZoomThumb
                  key={image.id}
                  url={image.url}
                  label={`Xem ảnh lớn ${index + 1}/${pool.length}`}
                  more={index === shown.length - 1 ? pool.length - shown.length : 0}
                  onClick={() => setViewing(index)}
                />
              ))}
            </Stack>
          ) : null}
          <ImageLightbox
            images={pool}
            index={viewing}
            title={images.length ? 'Ảnh sản phẩm' : 'Ảnh đơn hàng'}
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
                  { label: 'Số lượng', value: `${order.qty} ${order.qtyUnit ?? 'sp'}` },
                  {
                    label: 'Hiện có',
                    value: `${ticket.availableQty} sp · ${ticket.availableSilver != null ? formatQty(ticket.availableSilver) : '—'} g`,
                  },
                  { label: 'Ngày cần trả', value: order.dueDate ? formatStockedDate(order.dueDate) : null },
                  { label: 'Size', value: order.sizeLabel },
                  { label: 'Chất liệu', value: order.mainMaterial },
                  { label: 'Màu xi', value: order.platingColor },
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

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Quá trình sản xuất của phiếu
        </Typography>
        <TicketMatrix order={order} />
      </Box>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Các khâu của phiếu
        </Typography>
        {entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Chưa giao khâu nào.</Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1}>
            {entries.map((entry) => <EntryRow key={entry.id} entry={entry} />)}
          </Stack>
        )}
      </Paper>
    </Stack>
  )
}

function TicketView({ order, ticket }: { order: ProductionOrderDetail; ticket: SubTicket }) {
  const { user } = useAuth()
  const isWorker = can(user, Permission.PRODUCTION_WORKER)
  const isAdmin = user?.roleCode === 'ADMIN' || Boolean(user?.extraRoles?.includes('ADMIN'))
  // Thợ không có đơn mẹ: giấu mã đơn, trạng thái đơn và mọi lối mở màn quản lý đơn.
  const workerOnly = isWorkerOnly(user)
  // Mất mạng thì 4 thao tác này nằm trong hàng chờ và tự gửi khi có sóng — thợ quét QR
  // ngoài xưởng không phải đứng đợi vạch sóng. Xem orders/subTicketActions.ts.
  const claim = useSubTicketAction('claim')
  const unclaim = useSubTicketAction('unclaim')
  const submit = useSubTicketAction('submit')
  const unsubmit = useSubTicketAction('unsubmit')
  const queued = useQueuedSubTickets().get(ticket.code)
  // Đang gửi lên máy chủ thì nút quay; nằm chờ mạng thì chỉ khoá — chip "Chờ gửi" đã nói rõ.
  const sending = (action: SubTicketAction) => queued?.action === action && !queued.waiting
  const vars = { orderCode: order.code, no: ticket.no, ticketCode: ticket.code }

  const entries = order.stages.filter((entry) => entry.subTicketId === ticket.id)
  const openEntry = entries.find((entry) => !entry.returnedAt)
  const last = entries.at(-1)
  const images = order.images.filter((image) => image.kind === 'PRODUCT')
  // Hàng ảnh chỉ hiện 3 ảnh đầu; hộp xem ảnh lướt được hết.
  const pool = images.length ? images : order.images
  const shown = pool.slice(0, 3)
  const [viewing, setViewing] = useState<number | null>(null)
  const mine = ticket.claimedByUserId != null && ticket.claimedByUserId === user?.id
  // Khâu đang mở là của chính mình — chỉ người đó mới báo xong được (khớp luật ở BE).
  const workingIsMine = openEntry?.craftsmanUserId != null && openEntry.craftsmanUserId === user?.id
  const closed = order.status === 'DELIVERED' || order.finishedGoods != null

  return (
    <Stack spacing={1.5} sx={{ pb: 3 }}>
      <PageHeader
        title={`Phiếu con ${ticket.code}`}
        titleAdornment={
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <SubTicketStateChip state={ticket.state} />
            {workerOnly ? null : <StatusChip status={order.status} />}
            {/* Trạng thái bên cạnh vẫn là cái máy chủ đang giữ — chip này chỉ nói thao tác
                của thợ chưa lên tới nơi, không phải là đã nhận / đã xong. */}
            {queued ? (
              <Chip size="small" color="warning" label={queuedLabel(queued)} sx={{ borderRadius: 1 }} />
            ) : null}
          </Stack>
        }
        subtitle={
          workerOnly
            ? `Chia ${ticket.qty} sp · ${formatQty(ticket.silverWeight)} g bạc`
            : `Đơn ${order.code} · chia ${ticket.qty} sp · ${formatQty(ticket.silverWeight)} g bạc`
        }
        breadcrumbs={
          <Breadcrumbs>
            {isWorker ? (
              <Link component={RouterLink} to="/my-tickets" underline="hover" color="inherit">
                Phiếu của tôi
              </Link>
            ) : null}
            {workerOnly ? null : (
              <Link
                component={RouterLink}
                to={`/orders/${order.code}?tab=production`}
                underline="hover"
                color="inherit"
              >
                Đơn {order.code}
              </Link>
            )}
            <Typography color="text.primary">{ticket.code}</Typography>
          </Breadcrumbs>
        }
        actions={
          workerOnly ? undefined : (
            <Button variant="outlined" component={RouterLink} to={`/orders/${order.code}?tab=production`}>
              Mở đơn {order.code}
            </Button>
          )
        }
      />

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Khâu hiện tại
        </Typography>
        {ticket.outcome ? (
          <Typography variant="body2">
            Phiếu đã chốt <b>{ticket.outcome === 'DEFECT' ? 'Lỗi' : 'Hoàn thiện'}</b>
            {ticket.outcomeAt ? ` lúc ${formatDateShort(ticket.outcomeAt)}` : ''}
            {ticket.outcomeByName ? ` bởi ${ticket.outcomeByName}` : ''} — không còn khâu nào để nhận.
          </Typography>
        ) : closed ? (
          <Typography variant="body2">Đơn đã hoàn thiện / đã giao — phiếu không còn khâu nào để nhận.</Typography>
        ) : ticket.state === 'WAITING' && ticket.pendingStage ? (
          <Stack spacing={1.25}>
            <Typography variant="body2">
              Đang mở khâu <b>{STAGE_LABEL[ticket.pendingStage]}</b> — {ticket.availableQty} sp ·{' '}
              {formatQty(ticket.availableSilver)} g bạc. Chưa có thợ nhận.
            </Typography>
            {isWorker ? (
              <Button
                variant="contained"
                size="large"
                disabled={queued != null}
                loading={sending('claim')}
                onClick={() => claim.mutate(vars)}
                sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
              >
                Nhận phiếu — khâu {STAGE_LABEL[ticket.pendingStage]}
              </Button>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Chỉ tài khoản có quyền Thợ sản xuất mới nhận phiếu được.
              </Typography>
            )}
          </Stack>
        ) : ticket.state === 'CLAIMED' && ticket.pendingStage ? (
          <Stack spacing={1.25}>
            <Typography variant="body2">
              {mine ? 'Bạn' : `Thợ ${ticket.claimedByName ?? ''}`} đã nhận khâu{' '}
              <b>{STAGE_LABEL[ticket.pendingStage]}</b> lúc {formatDateShort(ticket.claimedAt)} — chờ người giao cân
              bạc và xác nhận giao ({ticket.availableQty} sp · {formatQty(ticket.availableSilver)} g).
            </Typography>
            {mine ? (
              <Button
                color="inherit"
                variant="outlined"
                disabled={queued != null}
                loading={sending('unclaim')}
                onClick={() => unclaim.mutate(vars)}
                sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
              >
                Huỷ nhận
              </Button>
            ) : null}
          </Stack>
        ) : (ticket.state === 'WORKING' || ticket.state === 'SUBMITTED') && openEntry ? (
          <Stack spacing={1.25}>
            <Typography variant="body2">
              Thợ <b>{openEntry.craftsmanName}</b> đang làm khâu <b>{STAGE_LABEL[openEntry.stage]}</b> từ{' '}
              {formatDateShort(openEntry.handedAt)} — nhận {openEntry.handedQty ?? '—'} sp ·{' '}
              {openEntry.handedSilverWeight ? formatQty(openEntry.handedSilverWeight) : '—'} g bạc (người giao{' '}
              {openEntry.handedByName}).
              {ticket.state === 'SUBMITTED'
                ? ` Đã báo xong lúc ${formatDateShort(openEntry.submittedAt)} — chờ KCS cân lại.`
                : ' Làm xong thì bấm "Đã làm xong" rồi mang hàng tới KCS cân lại.'}
            </Typography>
            {workingIsMine && ticket.state === 'WORKING' ? (
              <Button
                variant="contained"
                size="large"
                disabled={queued != null}
                loading={sending('submit')}
                onClick={() => submit.mutate(vars)}
                sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
              >
                Đã làm xong — nộp cho KCS
              </Button>
            ) : null}
            {workingIsMine && ticket.state === 'SUBMITTED' ? (
              <Button
                color="inherit"
                variant="outlined"
                disabled={queued != null}
                loading={sending('unsubmit')}
                onClick={() => unsubmit.mutate(vars)}
                sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
              >
                Bỏ báo xong
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Typography variant="body2">
            {last
              ? `Đã xong khâu ${STAGE_LABEL[last.stage]} — chờ mở khâu tiếp theo.`
              : 'Chưa mở khâu nào cho phiếu này.'}
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Sản phẩm
        </Typography>
        <Stack spacing={2}>
          {shown.length ? (
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              {shown.map((image, index) => (
                <ZoomThumb
                  key={image.id}
                  url={image.url}
                  label={`Xem ảnh lớn ${index + 1}/${pool.length}`}
                  more={index === shown.length - 1 ? pool.length - shown.length : 0}
                  onClick={() => setViewing(index)}
                />
              ))}
            </Stack>
          ) : null}
          <ImageLightbox
            images={pool}
            index={viewing}
            title={images.length ? 'Ảnh sản phẩm' : 'Ảnh đơn hàng'}
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
                  { label: 'Phiếu con', value: `${ticket.qty} sp · ${formatQty(ticket.silverWeight)} g` },
                  { label: 'Hiện có', value: `${ticket.availableQty} sp · ${formatQty(ticket.availableSilver)} g` },
                  { label: 'Ngày cần trả', value: order.dueDate ? formatStockedDate(order.dueDate) : null },
                  { label: 'Size', value: order.sizeLabel },
                  { label: 'Chất liệu', value: order.mainMaterial },
                  { label: 'Màu xi', value: order.platingColor },
                  { label: 'Loại đá', value: order.stoneTypes.join(', ') },
                  { label: 'Số lượng đá', value: order.stoneCount },
                  { label: 'Nội dung khắc laser', value: order.laserEngraving },
                  { label: 'Yêu cầu khác', value: order.otherRequirements },
                  ...(ticket.note ? [{ label: 'Ghi chú phiếu', value: ticket.note }] : []),
                ]}
              />
            </Box>
          </Stack>
        </Stack>
      </Paper>

      {ticket.topUps.length ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Đã cấp thêm
          </Typography>
          <Stack spacing={0.75}>
            {ticket.topUps.map((item) => (
              <Typography key={item.id} variant="body2">
                <b>
                  {item.qty ? `+${item.qty} sp` : ''}
                  {item.qty && Number(item.silverWeight) ? ' · ' : ''}
                  {Number(item.silverWeight) ? `+${formatQty(item.silverWeight)} g bạc` : ''}
                </b>{' '}
                · {formatDateShort(item.createdAt)} · {item.createdByName}
                {item.applied ? '' : ' · chờ giao khâu sau'}
                {item.reason ? ` — ${item.reason}` : ''}
              </Typography>
            ))}
          </Stack>
        </Paper>
      ) : null}

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Quá trình sản xuất của phiếu
        </Typography>
        <SubTicketMatrixCard order={order} ticket={ticket} isAdmin={isAdmin} showHeader={false} />
      </Box>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Các khâu của phiếu
        </Typography>
        {entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa giao khâu nào.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1}>
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  )
}

function EntryRow({ entry }: { entry: StageEntry }) {
  const level = entry.returnedAt ? silverLossLevel(entry.silverLossPercent) : null
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {STAGE_LABEL[entry.stage]}
        {entry.attempt > 1 ? ` (lần ${entry.attempt})` : ''} · thợ {entry.craftsmanName}
      </Typography>
      <Typography variant="body2">
        Giao {formatDateShort(entry.handedAt)} · {entry.handedQty ?? '—'} sp ·{' '}
        {entry.handedSilverWeight ? formatQty(entry.handedSilverWeight) : '—'} g · người giao {entry.handedByName}
      </Typography>
      {entry.returnedAt ? (
        <Typography variant="body2">
          KCS {entry.returnedByName ?? '—'} nhận lại {formatDateShort(entry.returnedAt)} · {entry.returnedQty ?? '—'} sp ·{' '}
          {entry.returnedSilverWeight ? formatQty(entry.returnedSilverWeight) : '—'} g
          {entry.silverLoss != null ? (
            <Box
              component="span"
              sx={
                level
                  ? { ml: 0.5, px: 0.5, borderRadius: 0.5, bgcolor: SILVER_LOSS_TONE[level].bg, color: SILVER_LOSS_TONE[level].fg }
                  : { ml: 0.5 }
              }
            >
              hao hụt {formatQty(entry.silverLoss)} g
              {entry.silverLossPercent != null ? ` (${formatQty(entry.silverLossPercent)}%)` : ''}
            </Box>
          ) : null}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Chưa được KCS nhận lại
        </Typography>
      )}
    </Box>
  )
}
