import { useState, type ReactNode } from 'react'
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EventIcon from '@mui/icons-material/Event'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import ScaleIcon from '@mui/icons-material/Scale'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { can, isWorkerOnly, Permission } from '../auth/permissions'
import {
  getSubTicketOrderApi,
  parseSubTicketCode,
  type ProductionOrderDetail,
  type StageCode,
  type StageEntry,
  type SubTicketState,
  type TicketMaterials,
} from '../api/productionOrders'
import { formatQty, formatStockedDate } from '../api/inventory'
import { ImageLightbox, ZoomThumb } from '../components/ImageLightbox'
import { TicketDetailSkeleton } from '../components/ui'
import { formatDateShort, SILVER_LOSS_TONE, silverLossLevel, STAGE_LABEL } from '../orders/catalog'
import { StatusChip, SubTicketStateChip } from '../orders/OrderChips'
import { MaterialRequestsCard, stageIssuesStock } from '../orders/MaterialRequests'
import { SubTicketMatrixCard } from '../orders/SubTicketMatrixCard'
import { TicketMatrix } from '../orders/TicketMatrix'
import { useQueuedSubTickets, useSubTicketAction } from '../orders/subTicketActions'
import { queuedLabel, type SubTicketAction } from '../orders/subTicketQueue'
import {
  dueInfo,
  FactGrid,
  MetaItem,
  SectionCard,
  StageProgress,
  StickyActions,
  TicketThumb,
} from '../worker/WorkerUi'

/** Phiếu mẹ (đơn chưa chia) và phiếu con quy về cùng một dạng để dùng chung một màn. */
type TicketModel = {
  code: string
  /** null = phiếu mẹ. */
  no: number | null
  heading: string
  qty: number
  state: SubTicketState
  pendingStage: StageCode | null
  claimedByUserId: string | null
  claimedByName: string | null
  claimedAt: string | null
  availableQty: number
  availableSilver: string | null
  materials: TicketMaterials
  entries: StageEntry[]
  note: string | null
  outcome: { label: string; at: string | null; by: string | null } | null
}

/** Trang phiếu mở từ QR: thợ xem phần việc của mình và bấm nhận / báo xong khâu đang mở. */
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
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  if (detail.isLoading) return <TicketDetailSkeleton />
  const order = detail.data
  const model = order ? toModel(order, parsed?.no ?? null) : null
  if (!order || !model) {
    // Mất mạng mà phiếu này chưa từng được tải về: nói đúng lý do, đừng để thợ tưởng là
    // quét nhầm mã. Phiếu thuộc phần việc của mình thì màn "Phiếu của tôi" đã kéo sẵn.
    return (
      <Stack spacing={2}>
        <BackLink />
        {detail.isPaused ? (
          <Alert severity="warning">Đang ngoại tuyến và máy chưa tải phiếu {ticketCode} lần nào — mở lại khi có mạng.</Alert>
        ) : (
          <Alert severity="error">
            {detail.error instanceof Error ? detail.error.message : `Không tìm thấy phiếu ${ticketCode}`}
          </Alert>
        )}
      </Stack>
    )
  }
  return <TicketDetail order={order} model={model} />
}

function toModel(order: ProductionOrderDetail, no: number | null): TicketModel | null {
  if (no == null) {
    const ticket = order.workTicket
    if (!ticket) return null
    return {
      code: ticket.code,
      no: null,
      heading: `Phiếu ${order.code}`,
      qty: order.qty,
      state: ticket.state,
      pendingStage: ticket.pendingStage,
      claimedByUserId: ticket.claimedByUserId,
      claimedByName: ticket.claimedByName,
      claimedAt: ticket.claimedAt,
      availableQty: ticket.availableQty,
      availableSilver: ticket.availableSilver,
      materials: ticket.materials,
      entries: order.stages.filter((entry) => !entry.subTicketId),
      note: null,
      outcome: null,
    }
  }
  const ticket = order.subTickets.find((item) => item.no === no)
  if (!ticket) return null
  return {
    code: ticket.code,
    no: ticket.no,
    heading: `Phiếu ${ticket.code}`,
    qty: ticket.qty,
    state: ticket.state,
    pendingStage: ticket.pendingStage,
    claimedByUserId: ticket.claimedByUserId,
    claimedByName: ticket.claimedByName,
    claimedAt: ticket.claimedAt,
    availableQty: ticket.availableQty,
    availableSilver: ticket.availableSilver,
    materials: ticket.materials,
    entries: order.stages.filter((entry) => entry.subTicketId === ticket.id),
    note: ticket.note,
    outcome: ticket.outcome
      ? { label: ticket.outcome === 'DEFECT' ? 'Lỗi' : 'Hoàn thiện', at: ticket.outcomeAt, by: ticket.outcomeByName }
      : null,
  }
}

function BackLink() {
  const { user } = useAuth()
  if (!can(user, Permission.PRODUCTION_WORKER)) return null
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

function TicketDetail({ order, model }: { order: ProductionOrderDetail; model: TicketModel }) {
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
  const queued = useQueuedSubTickets().get(model.code)
  // Đang gửi lên máy chủ thì nút quay; nằm chờ mạng thì chỉ khoá — chip "Chờ gửi" đã nói rõ.
  const sending = (action: SubTicketAction) => queued?.action === action && !queued.waiting
  const vars = { orderCode: order.code, no: model.no, ticketCode: model.code }

  const openEntry = model.entries.find((entry) => !entry.returnedAt)
  const last = model.entries.at(-1)
  const mine = model.claimedByUserId != null && model.claimedByUserId === user?.id
  // Khâu đang mở là của chính mình — chỉ người đó mới báo xong được (khớp luật ở BE).
  const workingIsMine = openEntry?.craftsmanUserId != null && openEntry.craftsmanUserId === user?.id
  const closed = order.status === 'DELIVERED' || order.finishedGoods != null
  const due = dueInfo(order.dueDate)

  const doneStages = Array.from(new Set(model.entries.filter((entry) => entry.returnedAt).map((entry) => entry.stage)))
  const currentStage = model.outcome || closed ? null : (openEntry?.stage ?? model.pendingStage)

  // Một câu trạng thái + các số liệu + nút chính, tuỳ khâu đang ở bước nào.
  let headline: string
  let hint: string | null = null
  let facts: Array<{ label: string; value: ReactNode }> = []
  const actions: ReactNode[] = []
  const busy = queued != null

  if (model.outcome) {
    headline = `Phiếu đã chốt ${model.outcome.label}`
    hint = [model.outcome.at ? `lúc ${formatDateShort(model.outcome.at)}` : '', model.outcome.by ? `bởi ${model.outcome.by}` : '']
      .filter(Boolean)
      .join(' ')
  } else if (closed) {
    headline = 'Đơn đã hoàn thiện / đã giao'
    hint = 'Phiếu không còn khâu nào để nhận.'
  } else if (model.state === 'WAITING' && model.pendingStage) {
    headline = `Khâu ${STAGE_LABEL[model.pendingStage]} đang chờ thợ nhận`
    facts = [
      { label: 'Số lượng', value: `${model.availableQty} sp` },
      { label: 'Bạc hiện có', value: model.availableSilver != null ? `${formatQty(model.availableSilver)} g` : '—' },
    ]
    if (isWorker) {
      actions.push(
        <Button key="claim" variant="contained" size="large" disabled={busy} loading={sending('claim')} onClick={() => claim.mutate(vars)}>
          Nhận phiếu · {STAGE_LABEL[model.pendingStage]}
        </Button>,
      )
    } else {
      hint = 'Chỉ tài khoản có quyền Thợ sản xuất mới nhận phiếu được.'
    }
  } else if (model.state === 'CLAIMED' && model.pendingStage) {
    headline = `${mine ? 'Bạn' : `Thợ ${model.claimedByName ?? ''}`} đã nhận khâu ${STAGE_LABEL[model.pendingStage]}`
    hint = `Chờ người giao ${stageIssuesStock(model.pendingStage) ? 'xuất NVL, ' : ''}cân bạc và xác nhận giao.`
    facts = [
      { label: 'Nhận lúc', value: formatDateShort(model.claimedAt) },
      { label: 'Số lượng', value: `${model.availableQty} sp` },
      { label: 'Bạc hiện có', value: model.availableSilver != null ? `${formatQty(model.availableSilver)} g` : '—' },
    ]
    if (mine) {
      actions.push(
        <Button key="unclaim" variant="outlined" color="inherit" size="large" disabled={busy} loading={sending('unclaim')} onClick={() => unclaim.mutate(vars)}>
          Huỷ nhận
        </Button>,
      )
    }
  } else if ((model.state === 'WORKING' || model.state === 'SUBMITTED') && openEntry) {
    headline =
      model.state === 'SUBMITTED'
        ? `Đã báo xong khâu ${STAGE_LABEL[openEntry.stage]}`
        : `${workingIsMine ? 'Bạn' : `Thợ ${openEntry.craftsmanName}`} đang làm khâu ${STAGE_LABEL[openEntry.stage]}`
    hint =
      model.state === 'SUBMITTED'
        ? `Báo xong lúc ${formatDateShort(openEntry.submittedAt)} — mang hàng tới KCS cân lại.`
        : workingIsMine
          ? 'Làm xong thì bấm "Đã làm xong" rồi mang hàng tới KCS cân lại.'
          : null
    facts = [
      { label: 'Bắt đầu', value: formatDateShort(openEntry.handedAt) },
      { label: 'SL nhận', value: `${openEntry.handedQty ?? '—'} sp` },
      { label: 'Bạc vào khâu', value: openEntry.silverIn ? `${formatQty(openEntry.silverIn)} g` : '—' },
      { label: 'Người giao', value: openEntry.handedByName },
    ]
    if (workingIsMine && model.state === 'WORKING') {
      actions.push(
        <Button key="submit" variant="contained" size="large" disabled={busy} loading={sending('submit')} onClick={() => submit.mutate(vars)}>
          Đã làm xong · nộp KCS
        </Button>,
      )
    }
    if (workingIsMine && model.state === 'SUBMITTED') {
      actions.push(
        <Button key="unsubmit" variant="outlined" color="inherit" size="large" disabled={busy} loading={sending('unsubmit')} onClick={() => unsubmit.mutate(vars)}>
          Bỏ báo xong
        </Button>,
      )
    }
  } else {
    headline = last ? `Đã xong khâu ${STAGE_LABEL[last.stage]}` : 'Chưa mở khâu nào'
    hint = last ? 'Chờ người giao mở khâu tiếp theo.' : 'Người giao sẽ mở khâu đầu tiên cho phiếu này.'
  }

  return (
    <Stack spacing={{ xs: 1.5, md: 2 }}>
      <BackLink />

      {/* Đầu trang: mã phiếu, trạng thái và các thông số chính của hàng. */}
      <SectionCard>
        <Stack direction="row" spacing={{ xs: 1.5, md: 2 }} sx={{ alignItems: 'flex-start' }}>
          <TicketThumb url={order.images.find((image) => image.kind === 'PRODUCT')?.url ?? order.images[0]?.url} size={72} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
                {model.heading}
              </Typography>
              <SubTicketStateChip state={model.state} />
              {workerOnly ? null : <StatusChip status={order.status} />}
              {/* Trạng thái bên cạnh vẫn là cái máy chủ đang giữ — chip này chỉ nói thao tác
                  của thợ chưa lên tới nơi, không phải là đã nhận / đã xong. */}
              {queued ? <Chip size="small" color="warning" label={queuedLabel(queued)} sx={{ borderRadius: 1 }} /> : null}
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {order.description}
            </Typography>
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 0.75, flexWrap: 'wrap' }}>
              <MetaItem icon={<Inventory2OutlinedIcon />}>
                {model.no == null ? `${model.qty} sp` : `Chia ${model.qty} sp`}
              </MetaItem>
              {model.availableSilver != null ? <MetaItem icon={<ScaleIcon />}>{formatQty(model.availableSilver)} g</MetaItem> : null}
              {due ? (
                <MetaItem icon={<EventIcon />} tone={due.tone}>
                  {due.label}
                </MetaItem>
              ) : null}
            </Stack>
          </Box>
          {workerOnly ? null : (
            <Button
              variant="outlined"
              component={RouterLink}
              to={`/orders/${order.code}?tab=production`}
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, flexShrink: 0 }}
            >
              Mở đơn {order.code}
            </Button>
          )}
        </Stack>
      </SectionCard>

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, md: 2 },
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.65fr) minmax(300px, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={{ xs: 1.5, md: 2 }} sx={{ minWidth: 0 }}>
          <SectionCard title="Khâu hiện tại">
            <StageProgress done={doneStages} current={currentStage} />
            <Box
              sx={{
                mt: 2,
                p: { xs: 1.5, md: 2 },
                borderRadius: 2,
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography sx={{ fontWeight: 700 }}>{headline}</Typography>
              {hint ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {hint}
                </Typography>
              ) : null}
              {facts.length ? (
                <Box sx={{ mt: 1.5 }}>
                  <FactGrid items={facts} columns={{ xs: 2, sm: 4 }} />
                </Box>
              ) : null}
            </Box>
            {actions.length ? (
              <Stack direction="row" spacing={1} sx={{ mt: 2, display: { xs: 'none', md: 'flex' } }}>
                {actions}
              </Stack>
            ) : null}
          </SectionCard>

          <MaterialRequestsCard
            order={order}
            ticketNo={model.no}
            materials={model.materials}
            userId={user?.id ?? null}
            canHandle={!workerOnly && can(user, Permission.WAREHOUSE_KEEPER)}
            isAdmin={isAdmin}
          />

          <SectionCard title="Quá trình sản xuất">
            <Box sx={{ overflowX: 'auto' }}>
              {model.no == null ? (
                <TicketMatrix order={order} />
              ) : (
                <SubTicketMatrixCard
                  order={order}
                  ticket={order.subTickets.find((item) => item.no === model.no)!}
                  isAdmin={isAdmin}
                  showHeader={false}
                />
              )}
            </Box>
          </SectionCard>

          <SectionCard title="Lịch sử các khâu">
            {model.entries.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Chưa giao khâu nào.
              </Typography>
            ) : (
              <Stack spacing={0}>
                {[...model.entries].reverse().map((entry, index, all) => (
                  <EntryRow key={entry.id} entry={entry} lastRow={index === all.length - 1} />
                ))}
              </Stack>
            )}
          </SectionCard>
        </Stack>

        <ProductCard order={order} model={model} />
      </Box>

      {actions.length ? <StickyActions>{actions}</StickyActions> : null}
    </Stack>
  )
}

function ProductCard({ order, model }: { order: ProductionOrderDetail; model: TicketModel }) {
  const images = order.images.filter((image) => image.kind === 'PRODUCT')
  // Hàng ảnh chỉ hiện 4 ảnh đầu; hộp xem ảnh lướt được hết.
  const pool = images.length ? images : order.images
  const shown = pool.slice(0, 4)
  const [viewing, setViewing] = useState<number | null>(null)
  return (
    <SectionCard title="Thông số sản phẩm" sx={{ position: { md: 'sticky' }, top: { md: 0 } }}>
      {shown.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, mb: 2 }}>
          {shown.map((image, index) => (
            <ZoomThumb
              key={image.id}
              url={image.url}
              size={120}
              label={`Xem ảnh lớn ${index + 1}/${pool.length}`}
              more={index === shown.length - 1 ? pool.length - shown.length : 0}
              onClick={() => setViewing(index)}
              sx={{ width: '100%', height: 'auto', aspectRatio: '1 / 1' }}
            />
          ))}
        </Box>
      ) : null}
      <ImageLightbox
        images={pool}
        index={viewing}
        title={images.length ? 'Ảnh sản phẩm' : 'Ảnh đơn hàng'}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
        {order.description}
      </Typography>
      <FactGrid
        columns={{ xs: 2 }}
        items={[
          { label: model.no == null ? 'Số lượng đơn' : 'Phiếu con', value: `${model.qty} ${order.qtyUnit ?? 'sp'}` },
          { label: 'Hiện có', value: `${model.availableQty} sp` },
          { label: 'Ngày cần trả', value: order.dueDate ? formatStockedDate(order.dueDate) : null },
          { label: 'Size', value: order.sizeLabel },
          { label: 'Chất liệu', value: order.mainMaterial },
          { label: 'Màu xi', value: order.platingColor },
          { label: 'Loại đá', value: order.stoneTypes.join(', ') },
          { label: 'Số lượng đá', value: order.stoneCount },
          { label: 'Khắc laser', value: order.laserEngraving },
          { label: 'Yêu cầu khác', value: order.otherRequirements },
          { label: 'Ghi chú phiếu', value: model.note },
        ]}
      />
    </SectionCard>
  )
}

function EntryRow({ entry, lastRow }: { entry: StageEntry; lastRow: boolean }) {
  const level = entry.returnedAt ? silverLossLevel(entry.silverLossPercent) : null
  const done = Boolean(entry.returnedAt)
  return (
    <Stack direction="row" spacing={1.5}>
      <Stack sx={{ alignItems: 'center', pt: 0.5 }}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: done ? 'success.main' : 'primary.main',
            boxShadow: done ? 'none' : '0 0 0 3px rgba(107,69,19,.18)',
          }}
        />
        {lastRow ? null : <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', my: 0.5 }} />}
      </Stack>
      <Box sx={{ pb: lastRow ? 0 : 2, minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {STAGE_LABEL[entry.stage]}
          {entry.attempt > 1 ? ` (lần ${entry.attempt})` : ''} · {entry.craftsmanName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Giao {formatDateShort(entry.handedAt)} · {entry.handedQty ?? '—'} sp · {entry.silverIn ? formatQty(entry.silverIn) : '—'} g ·
          người giao {entry.handedByName}
        </Typography>
        {done ? (
          <Typography variant="body2" color="text.secondary">
            KCS {entry.returnedByName ?? '—'} nhận lại {formatDateShort(entry.returnedAt)} · {entry.returnedQty ?? '—'} sp ·{' '}
            {entry.returnedSilverWeight ? formatQty(entry.returnedSilverWeight) : '—'} g
            {entry.silverLoss != null ? (
              <Box
                component="span"
                sx={
                  level
                    ? { ml: 0.5, px: 0.5, borderRadius: 0.5, bgcolor: SILVER_LOSS_TONE[level].bg, color: SILVER_LOSS_TONE[level].fg, fontWeight: 600 }
                    : { ml: 0.5 }
                }
              >
                hao hụt {formatQty(entry.silverLoss)} g
                {entry.silverLossPercent != null ? ` (${formatQty(entry.silverLossPercent)}%)` : ''}
              </Box>
            ) : null}
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
            Đang làm — chưa được KCS nhận lại
          </Typography>
        )}
      </Box>
    </Stack>
  )
}
