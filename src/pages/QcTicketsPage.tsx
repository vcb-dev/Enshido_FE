import { useMemo, useState, type ReactNode } from 'react'
import { Alert, Box, Button, Chip, IconButton, Paper, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EventIcon from '@mui/icons-material/Event'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined'
import RefreshIcon from '@mui/icons-material/Refresh'
import ScaleIcon from '@mui/icons-material/Scale'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { canReportProductionDefect } from '../auth/permissions'
import {
  finishOrderApi,
  finishSubTicketApi,
  getProductionOrderApi,
  getQcTicketsApi,
  reportStageDefectApi,
  returnStageApi,
  reviseReturnApi,
  type ProductionOrderDetail,
  type QcFinishItem,
  type QcTicketItem,
  type ReturnPayload,
  type StageCode,
  type StageEntry,
} from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { CardGroupSkeleton } from '../components/ui'
import { formatDateShort, STAGE_LABEL, STAGES } from '../orders/catalog'
import { applyProductionOrderDetail } from '../orders/orderCache'
import { invalidateBtpStock } from '../orders/btpStock'
import { invalidateNvlStock } from '../orders/nvlStock'
import { scheduleMyTicketsRefresh } from '../orders/myTicketsRefresh'
import { scheduleProductionStatusCountsRefresh } from '../orders/productionStatusCountsRefresh'
import { DefectDialog, FinishDialog } from '../orders/OutcomeDialogs'
import { KcsReturnDialog } from '../orders/StageDialogs'
import { dueInfo, EmptyState, FilterPill, MetaItem, TabLabel, TicketThumb } from '../worker/WorkerUi'

type TabKey = 'working' | 'pending' | 'confirming' | 'finishable' | 'recent'
type StageFilter = 'all' | StageCode

const TABS: { value: TabKey; label: string }[] = [
  { value: 'working', label: 'Đang làm' },
  { value: 'pending', label: 'Chờ QC' },
  { value: 'confirming', label: 'Chờ thủ kho xác nhận' },
  { value: 'finishable', label: 'Chờ hoàn thiện' },
  { value: 'recent', label: 'Gần đây' },
]

const EMPTY: Record<TabKey, { title: string; description: string }> = {
  working: { title: 'Không có phiếu nào đang làm', description: 'Phiếu thợ đang làm hiện ở đây — thấy hàng hỏng thì bấm Báo lỗi.' },
  pending: { title: 'Chưa có phiếu nào chờ QC', description: 'Thợ bấm "Đã làm xong" hoặc báo lỗi thì phiếu hiện ở đây.' },
  confirming: {
    title: 'Không có phiếu nào chờ thủ kho',
    description: 'Nguội / Vào đá luôn chờ thủ kho xác nhận sau QC, kể cả không có hàng lỗi. Trong lúc chờ QC còn sửa lại được.',
  },
  finishable: { title: 'Chưa có phiếu nào chờ hoàn thiện', description: 'Phiếu xong khâu Xi thì hiện ở đây để QC chốt hoàn thiện.' },
  recent: { title: 'Chưa có lần QC nào', description: 'Các lần bạn cân lại gần nhất hiện ở đây.' },
}

/** QC sửa lại kết quả tối đa 3 lần trước khi thủ kho xác nhận — khớp BE. */
const MAX_REVISIONS = 3

/**
 * Màn của QC: mọi việc QC làm ở đây (cân lại, sửa lại, hoàn thiện), lọc theo từng khâu.
 * Chi tiết lệnh sản xuất không còn nút thao tác của QC.
 */
export function QcTicketsPage() {
  const { user } = useAuth()
  const canReportDefect = canReportProductionDefect(user)
  const queryClient = useQueryClient()
  const tickets = useQuery({
    queryKey: ['qc-tickets'],
    queryFn: getQcTicketsApi,
    staleTime: 30_000,
    // Thợ báo xong trên điện thoại của họ — màn QC tự làm mới để thấy phiếu mới tới.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const [tab, setTab] = useState<TabKey>('pending')
  const [stage, setStage] = useState<StageFilter>('all')

  /** Phiếu đang mở hộp thoại QC: cần cả chi tiết đơn để tính mốc cân. */
  const [qc, setQc] = useState<{ order: ProductionOrderDetail; entry: StageEntry } | null>(null)
  const [loadingEntry, setLoadingEntry] = useState<string | null>(null)
  const [finishing, setFinishing] = useState<QcFinishItem | null>(null)
  const [reporting, setReporting] = useState<QcTicketItem | null>(null)

  const onOrderSaved = (order: ProductionOrderDetail, message: string) => {
    applyProductionOrderDetail(queryClient, order)
    invalidateBtpStock(queryClient)
    invalidateNvlStock(queryClient)
    scheduleMyTicketsRefresh(queryClient)
    scheduleProductionStatusCountsRefresh(queryClient)
    toast.success(message)
  }

  const saveReturn = useMutation({
    mutationFn: ({ order, entry, payload }: { order: ProductionOrderDetail; entry: StageEntry; payload: ReturnPayload }) =>
      entry.returnedAt ? reviseReturnApi(order.code, entry.id, payload) : returnStageApi(order.code, entry.id, payload),
    onSuccess: (order, vars) => {
      onOrderSaved(order, vars.entry.returnedAt ? 'Đã lưu bản sửa QC' : 'Đã lưu kết quả QC')
      setQc(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const finish = useMutation({
    mutationFn: ({ item, note }: { item: QcFinishItem; note?: string }) =>
      item.scope === 'ORDER' || item.no == null
        ? finishOrderApi(item.orderCode, { note })
        : finishSubTicketApi(item.orderCode, item.no, note),
    onSuccess: (order) => {
      onOrderSaved(order, 'Đã hoàn thiện — chờ kho thành phẩm nhập')
      setFinishing(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Báo lỗi khâu thợ đang làm: phiếu sang "Chờ QC" để QC cân hàng lỗi.
  const reportDefect = useMutation({
    mutationFn: ({ item, note }: { item: QcTicketItem; note: string }) =>
      reportStageDefectApi(item.orderCode, item.no, note),
    onSuccess: (order) => {
      onOrderSaved(order, 'Đã báo lỗi khâu — phiếu chuyển sang Chờ QC')
      setReporting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  /** Tải đơn mới nhất rồi mở hộp thoại QC cho đúng lần giao khâu. */
  async function openQc(item: QcTicketItem) {
    setLoadingEntry(item.entryId)
    try {
      const order = await queryClient.fetchQuery({
        queryKey: ['production-order', item.orderCode],
        queryFn: () => getProductionOrderApi(item.orderCode),
        staleTime: 0,
      })
      const entry = order.stages.find((candidate) => candidate.id === item.entryId)
      if (!entry) {
        toast.error('Phiếu đã thay đổi — làm mới danh sách rồi thử lại')
        void tickets.refetch()
        return
      }
      setQc({ order, entry })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được đơn')
    } finally {
      setLoadingEntry(null)
    }
  }

  const data = tickets.data
  const lists = useMemo(
    () => ({
      working: data?.working ?? [],
      pending: data?.pending ?? [],
      confirming: data?.confirming ?? [],
      finishable: data?.finishable ?? [],
      recent: data?.recent ?? [],
    }),
    [data],
  )
  const current: Array<QcTicketItem | QcFinishItem> = lists[tab]
  const stageCount = (code: StageFilter) =>
    code === 'all' ? current.length : current.filter((item) => item.stage === code).length
  const filtered = stage === 'all' ? current : current.filter((item) => item.stage === stage)

  const actionFor = (item: QcTicketItem | QcFinishItem): ReactNode => {
    if (tab === 'finishable') {
      return (
        <Button variant="contained" color="success" onClick={() => setFinishing(item as QcFinishItem)} sx={{ minWidth: 132 }}>
          Xác nhận hoàn thiện
        </Button>
      )
    }
    const entry = item as QcTicketItem
    const loading = loadingEntry === entry.entryId
    if (tab === 'working') {
      return canReportDefect ? (
        <Button variant="outlined" color="error" onClick={() => setReporting(entry)}>
          Báo lỗi
        </Button>
      ) : null
    }
    if (tab === 'pending') {
      return (
        <Button
          variant="contained"
          color={entry.defectReportedAt ? 'error' : 'primary'}
          disabled={entry.pendingRequests > 0 || loadingEntry != null}
          loading={loading}
          onClick={() => void openQc(entry)}
          sx={{ minWidth: 132 }}
        >
          {entry.defectReportedAt ? 'QC cân hàng lỗi' : 'QC cân lại'}
        </Button>
      )
    }
    if (tab === 'confirming') {
      return (
        <Button
          variant="outlined"
          color="inherit"
          disabled={entry.kcsRevisionCount >= MAX_REVISIONS || loadingEntry != null}
          loading={loading}
          onClick={() => void openQc(entry)}
        >
          QC sửa lại ({entry.kcsRevisionCount}/{MAX_REVISIONS})
        </Button>
      )
    }
    return null
  }

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.35rem', md: '1.6rem' } }}>
            Phiếu QC
          </Typography>
          {tickets.dataUpdatedAt ? (
            <Typography variant="caption" color="text.secondary">
              Cập nhật lúc {formatDateShort(new Date(tickets.dataUpdatedAt).toISOString())}
            </Typography>
          ) : null}
        </Box>
        <Tooltip title="Làm mới">
          <IconButton
            aria-label="Làm mới"
            onClick={() => void tickets.refetch()}
            loading={tickets.isFetching}
            sx={{ border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {tickets.isLoading ? (
        <CardGroupSkeleton count={3} media />
      ) : !data ? (
        <Alert severity="error">{tickets.error instanceof Error ? tickets.error.message : 'Không tải được phiếu'}</Alert>
      ) : (
        <>
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              bgcolor: 'background.default',
              mx: { xs: -2, md: 0 },
              px: { xs: 2, md: 0 },
              pt: { xs: 0.5, md: 0 },
            }}
          >
            <Tabs
              value={tab}
              onChange={(_, value: TabKey) => setTab(value)}
              variant="scrollable"
              scrollButtons={false}
              sx={{
                minHeight: 44,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '& .MuiTab-root': { minHeight: 44, minWidth: 0, px: 0, mr: 3, fontWeight: 600, textTransform: 'none' },
              }}
            >
              {TABS.map((item) => (
                <Tab
                  key={item.value}
                  value={item.value}
                  label={<TabLabel text={item.label} count={lists[item.value].length} active={tab === item.value} />}
                />
              ))}
            </Tabs>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', justifyContent: 'space-between', py: 1.25, minHeight: 52 }}
            >
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', minWidth: 0 }}>
                {(['all', ...STAGES] as StageFilter[]).map((code) => (
                  <FilterPill
                    key={code}
                    label={code === 'all' ? 'Tất cả' : STAGE_LABEL[code]}
                    count={stageCount(code)}
                    selected={stage === code}
                    onClick={() => setStage(code)}
                  />
                ))}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                {filtered.length} phiếu
              </Typography>
            </Stack>
          </Box>

          {filtered.length === 0 ? (
            <EmptyState
              icon={tab === 'recent' ? <HistoryOutlinedIcon /> : <AssignmentTurnedInIcon />}
              title={stage === 'all' ? EMPTY[tab].title : `Không có phiếu khâu ${STAGE_LABEL[stage]}`}
              description={stage === 'all' ? EMPTY[tab].description : 'Chọn Tất cả để xem mọi khâu.'}
            />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: { xs: 1.25, md: 1.5 },
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
              }}
            >
              {filtered.map((item) => (
                <QcCard
                  key={'entryId' in item ? item.entryId : `finish-${item.ticketCode}`}
                  item={item}
                  tab={tab}
                  action={actionFor(item)}
                />
              ))}
            </Box>
          )}
        </>
      )}

      {qc ? (
        <KcsReturnDialog
          order={qc.order}
          entry={qc.entry}
          saving={saveReturn.isPending}
          onClose={() => setQc(null)}
          onSave={(payload) => saveReturn.mutate({ ...qc, payload })}
        />
      ) : null}
      <DefectDialog
        open={reporting != null && canReportDefect}
        ticketCode={reporting ? `${reporting.ticketCode} · ${STAGE_LABEL[reporting.stage as StageCode]}` : ''}
        saving={reportDefect.isPending}
        onClose={() => setReporting(null)}
        onSave={(note) => reporting && reportDefect.mutate({ item: reporting, note })}
      />
      <FinishDialog
        open={finishing != null}
        ticketCode={finishing?.ticketCode ?? ''}
        qty={finishing?.qty ?? 0}
        scope={finishing?.scope === 'ORDER' ? 'order' : 'ticket'}
        saving={finish.isPending}
        onClose={() => setFinishing(null)}
        onSave={(note) => finishing && finish.mutate({ item: finishing, note })}
      />
    </Stack>
  )
}

/** Dòng trạng thái dưới thẻ: thợ báo xong / báo lỗi lúc nào, QC cân lúc nào. */
function statusLine(item: QcTicketItem | QcFinishItem, tab: TabKey) {
  if (!('entryId' in item)) return `Xong khâu ${STAGE_LABEL[item.stage]} ${formatDateShort(item.doneAt)}`
  if (tab === 'working') return `Thợ ${item.craftsmanName} nhận ${formatDateShort(item.handedAt)} · đang làm`
  if (tab === 'pending') {
    if (item.pendingRequests > 0) return `Còn ${item.pendingRequests} yêu cầu xuất NVL chờ kho — xử lý xong mới cân`
    return item.submittedAt ? `Thợ báo xong ${formatDateShort(item.submittedAt)}` : `Giao lúc ${formatDateShort(item.handedAt)}`
  }
  const loss =
    item.silverLoss != null
      ? ` · hao hụt ${formatQty(item.silverLoss)} g${item.silverLossPercent != null ? ` (${formatQty(item.silverLossPercent)}%)` : ''}`
      : ''
  return `QC ${item.returnedByName ?? '—'} cân ${formatDateShort(item.returnedAt)}${loss}`
}

function QcCard({ item, tab, action }: { item: QcTicketItem | QcFinishItem; tab: TabKey; action: ReactNode }) {
  const due = dueInfo(item.dueDate)
  const entry = 'entryId' in item ? item : null
  const weight = entry ? (entry.returnedSilverWeight ?? entry.silverWeight) : null
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        borderColor: entry?.defectReportedAt && tab === 'pending' ? 'error.light' : due?.tone === 'error' ? 'error.light' : 'divider',
        transition: 'box-shadow .15s',
        '&:hover': { boxShadow: '0 4px 16px rgba(62,42,14,.08)' },
      }}
    >
      <Box
        component={RouterLink}
        to={`/tickets/${item.ticketCode}`}
        sx={{
          display: 'flex',
          gap: 1.5,
          p: 1.5,
          color: 'inherit',
          textDecoration: 'none',
          flex: 1,
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <TicketThumb url={item.imageUrl} size={64} />
        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 800, letterSpacing: '.01em' }}>{item.ticketCode}</Typography>
            <Chip
              size="small"
              label={`${STAGE_LABEL[item.stage as StageCode]}${entry && entry.attempt > 1 ? ` · lần ${entry.attempt}` : ''}`}
              sx={{ height: 22, borderRadius: 1, bgcolor: 'action.selected', color: 'primary.dark', fontWeight: 600 }}
            />
            {entry?.defectReportedAt && tab === 'pending' ? (
              <Chip size="small" color="error" label="Báo lỗi" sx={{ height: 22, borderRadius: 1, fontWeight: 600 }} />
            ) : null}
            {entry?.defectQty ? (
              <Chip size="small" color="error" variant="outlined" label={`${entry.defectQty} sp lỗi`} sx={{ height: 22, borderRadius: 1 }} />
            ) : null}
          </Stack>
          <Typography
            variant="body2"
            sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {item.description}
          </Typography>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', pt: 0.25 }}>
            <MetaItem icon={<Inventory2OutlinedIcon />}>
              {entry?.returnedQty != null ? `${entry.returnedQty}/${entry.qty} sp đạt` : `${item.qty} sp`}
            </MetaItem>
            {weight != null ? <MetaItem icon={<ScaleIcon />}>{formatQty(weight)} g</MetaItem> : null}
            {entry ? <MetaItem icon={<PersonOutlineIcon />}>{entry.craftsmanName}</MetaItem> : null}
            {due ? (
              <MetaItem icon={<EventIcon />} tone={due.tone}>
                {due.label}
              </MetaItem>
            ) : null}
          </Stack>
          {entry?.defectReportedAt && tab === 'pending' ? (
            <Typography variant="caption" color="error.main" sx={{ display: 'block', fontWeight: 600 }}>
              {entry.defectReportedByName ?? '—'} báo lỗi: {entry.defectNote}
            </Typography>
          ) : null}
        </Stack>
        <ChevronRightIcon sx={{ color: 'text.disabled', alignSelf: 'center', display: { xs: 'none', sm: 'block' } }} />
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          px: 1.5,
          py: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
          minHeight: 52,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
          {statusLine(item, tab)}
        </Typography>
        {action}
      </Stack>
    </Paper>
  )
}
