import { Fragment, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { can, Permission } from '../auth/permissions'
import { formatQty } from '../api/inventory'
import {
  deleteScrapReturnApi,
  getWeeklyLossApi,
  lossInHeader,
  LOSS_METAL_LABEL,
  LOSS_STAGE_LABEL,
  type LossItem,
  type LossMetal,
  type LossStage,
  type LossSums,
  type LossWorkerRow,
  type WeeklyLossReport,
} from '../api/lossReports'
import { confirmDialog, DateField, SelectInput, TableSkeleton, TrashIcon } from '../components/ui'
import { SearchSelect } from '../warehouses/SearchSelect'
import { LossLimitsDialog } from './LossLimitsDialog'
import {
  addDays,
  buildLossSheets,
  filterLossReport,
  isOver,
  lossWorkers,
  todayKey,
  weekLabel,
  weekShort,
  weekStart,
} from './lossReport'
import { OVERVIEW_COLOR } from './overviewShared'
import { ScrapReturnDialog } from './ScrapReturnDialog'
import { downloadXlsx } from './xlsx'

type Mode = 'week' | 'compare'

const COMPARE_WEEKS = 8
const SCRAP_PAGE_SIZE = 10
const STAGE_OPTIONS = (Object.keys(LOSS_STAGE_LABEL) as LossStage[]).map((stage) => ({
  value: stage,
  label: LOSS_STAGE_LABEL[stage],
}))
const OK_COLOR = '#1a8f63'

const g = (value: string | null) => (value == null ? '—' : formatQty(String(Number(Number(value).toFixed(2)))))
const pct = (value: string | null) =>
  value == null
    ? '—'
    : `${Number(value).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

const TABLE_SX = {
  borderCollapse: 'separate',
  borderSpacing: 0,
  '& td, & th': { px: 1, py: 0.75, fontSize: '0.84rem', borderColor: '#e9e0d4' },
  '& th': { fontWeight: 700, bgcolor: '#f8f3eb', whiteSpace: 'nowrap', verticalAlign: 'bottom' },
  '& td.num, & th.num': { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  // Tên cột theo tài liệu khá dài: cho xuống dòng, giữ cột số gọn.
  '& th.num': { whiteSpace: 'normal', lineHeight: 1.25, minWidth: 96, maxWidth: 150 },
} as const

/** Màu % thực tế: đỏ khi vượt mức, xanh khi trong mức, mặc định khi khâu chưa đặt mức. */
function lossColor(row: { lossPercent: string | null; limitPercent: string | null }) {
  if (row.lossPercent == null || row.limitPercent == null) return undefined
  return isOver(row) ? OVERVIEW_COLOR.danger : OK_COLOR
}

/**
 * Tab Hao hụt: báo cáo hao hụt theo tuần của từng thợ ở từng khâu (tab BÁO CÁO trong mô tả luồng).
 * Bạc và vàng xem riêng, không cộng lẫn gram. Xem một tuần như bảng Excel, hoặc so sánh nhiều tuần
 * liền nhau; xuất Excel cả hai.
 */
export function LossReportPanel() {
  const { user } = useAuth()
  const isKeeper = can(user, Permission.WAREHOUSE_KEEPER)
  const today = todayKey()
  const thisWeek = weekStart(today)
  const [metal, setMetal] = useState<LossMetal>('SILVER')
  const [mode, setMode] = useState<Mode>('week')
  // Ô ngày giữ đúng ngày đã chọn, tuần suy ra từ đó (ép ô về Thứ Hai thì không chọn được ngày khác trong tuần).
  const [day, setDay] = useState(today)
  const week = weekStart(day)
  const [compareFrom, setCompareFrom] = useState(addDays(thisWeek, -7 * (COMPARE_WEEKS - 1)))
  const [compareTo, setCompareTo] = useState(thisWeek)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [scrapOpen, setScrapOpen] = useState(false)
  const [stage, setStage] = useState<LossStage | ''>('')
  // Giữ cả tên để thợ đã chọn vẫn hiện trong ô khi đổi sang tuần thợ không có số.
  const [worker, setWorker] = useState<{ key: string; name: string } | null>(null)

  const range =
    mode === 'week'
      ? { from: week, to: week }
      : { from: weekStart(compareFrom || thisWeek), to: weekStart(compareTo || thisWeek) }
  const validRange = range.from <= range.to
  const report = useQuery({
    queryKey: ['loss-reports', 'weekly', metal, range.from, range.to],
    queryFn: () => getWeeklyLossApi({ ...range, metal }),
    enabled: validRange,
    placeholderData: keepPreviousData,
  })
  const raw = report.data
  const data = useMemo(
    () => (raw ? filterLossReport(raw, { stage, workerKey: worker?.key ?? '' }) : undefined),
    [raw, stage, worker],
  )
  const workerOptions = useMemo(() => {
    const list = raw ? lossWorkers(raw) : []
    if (worker && !list.some((item) => item.key === worker.key)) list.unshift(worker)
    return list.map((item) => ({ id: item.key, name: item.name }))
  }, [raw, worker])
  const filtered = Boolean(stage || worker)

  const exportExcel = () => {
    if (!data) return
    const prefix = data.metal === 'GOLD' ? 'hao-hut-vang' : 'hao-hut-bac'
    const period =
      data.weeks.length === 1
        ? `tuan-${data.weeks[0].start}`
        : `${data.weeks[0].start}-den-${data.weeks[data.weeks.length - 1].start}`
    const suffix = [stage ? slug(LOSS_STAGE_LABEL[stage]) : '', worker ? slug(worker.name) : '']
      .filter(Boolean)
      .map((part) => `-${part}`)
      .join('')
    downloadXlsx(`${prefix}-${period}${suffix}`, buildLossSheets(data, stage))
  }

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: { md: 'flex-start' } }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Hao hụt {LOSS_METAL_LABEL[metal].toLowerCase()} theo tuần
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, justifyContent: { md: 'flex-end' } }}>
          {isKeeper ? (
            <Button variant="contained" size="small" onClick={() => setScrapOpen(true)}>
              Nhận mạt vụn
            </Button>
          ) : null}
          <Button variant="outlined" size="small" onClick={() => setLimitsOpen(true)}>
            Cấu hình hao hụt
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadOutlinedIcon />}
            disabled={!data || report.isPlaceholderData}
            onClick={exportExcel}
          >
            Xuất Excel
          </Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5, alignItems: { sm: 'center' } }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={metal}
          onChange={(_, value: LossMetal | null) => value && setMetal(value)}
        >
          <ToggleButton value="SILVER">{LOSS_METAL_LABEL.SILVER}</ToggleButton>
          <ToggleButton value="GOLD">{LOSS_METAL_LABEL.GOLD}</ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, value: Mode | null) => value && setMode(value)}
        >
          <ToggleButton value="week">Theo tuần</ToggleButton>
          <ToggleButton value="compare">So sánh nhiều tuần</ToggleButton>
        </ToggleButtonGroup>
        {mode === 'week' ? (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <IconButton size="small" aria-label="Tuần trước" onClick={() => setDay(addDays(week, -7))}>
              <ChevronLeftIcon />
            </IconButton>
            <DateField
              size="small"
              label="Tuần có ngày"
              value={day}
              onChange={(next) => next && setDay(next)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
            />
            <IconButton
              size="small"
              aria-label="Tuần sau"
              disabled={week >= thisWeek}
              onClick={() => setDay(addDays(week, 7))}
            >
              <ChevronRightIcon />
            </IconButton>
            <Typography variant="body2" sx={{ fontWeight: 600, pl: 1, whiteSpace: 'nowrap' }}>
              {weekLabel(week)}
            </Typography>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <DateField
              size="small"
              label="Từ tuần có ngày"
              value={compareFrom}
              onChange={setCompareFrom}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: compareTo || today } }}
            />
            <DateField
              size="small"
              label="Đến tuần có ngày"
              value={compareTo}
              onChange={setCompareTo}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: compareFrom || undefined, max: today } }}
            />
          </Stack>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5, alignItems: { sm: 'center' } }}>
        <SelectInput
          size="small"
          label="Khâu"
          placeholder="Tất cả khâu"
          clearable
          options={STAGE_OPTIONS}
          value={stage}
          onChange={setStage}
          sx={{ width: { xs: '100%', sm: 200 } }}
        />
        <SearchSelect
          size="small"
          label="Thợ"
          placeholder="Tất cả thợ"
          allowClear
          options={workerOptions}
          valueId={worker?.key ?? ''}
          onChange={(id) => {
            const next = workerOptions.find((item) => item.id === id)
            setWorker(next ? { key: next.id, name: next.name } : null)
          }}
          noOptionsText="Không có thợ nào trong kỳ này"
          sx={{ width: { xs: '100%', sm: 260 } }}
        />
        {filtered ? (
          <Button
            size="small"
            onClick={() => {
              setStage('')
              setWorker(null)
            }}
          >
            Bỏ lọc
          </Button>
        ) : null}
      </Stack>

      {data && data.pendingCount > 0 ? (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {data.pendingCount} lượt khâu QC đã nhận lại nhưng thủ kho chưa xác nhận — chưa tính vào báo cáo.
        </Alert>
      ) : null}

      {!validRange ? (
        <Alert severity="warning">Chọn tuần bắt đầu không sau tuần kết thúc.</Alert>
      ) : report.isError ? (
        <Alert severity="error">Không tải được báo cáo hao hụt: {report.error.message}</Alert>
      ) : !data ? (
        <TableSkeleton />
      ) : (
        <Box sx={{ opacity: report.isPlaceholderData ? 0.6 : 1 }}>
          {stage ? (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Đang xem riêng khâu {LOSS_STAGE_LABEL[stage]}. Mạt vụn thợ nộp chung cả tuần, không chia theo khâu nên các
              cột mạt để trống; mức hao thực tế là của khâu này, chưa trừ mạt.
            </Alert>
          ) : null}
          {mode === 'week' ? (
            <WeekTable data={data} canDelete={isKeeper} stage={stage} filtered={filtered} />
          ) : (
            <CompareTable data={data} filtered={filtered} />
          )}
        </Box>
      )}

      <LossLimitsDialog open={limitsOpen} onClose={() => setLimitsOpen(false)} canEdit={isKeeper} />
      {isKeeper ? (
        <ScrapReturnDialog
          open={scrapOpen}
          onClose={() => setScrapOpen(false)}
          defaultWeek={week}
          defaultMetal={metal}
        />
      ) : null}
    </Paper>
  )
}

/** Tên thợ → đoạn tên file không dấu: "Bùi Văn Lân" → "bui-van-lan". */
function slug(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Chênh lệch mạt có dấu: "+1,2" trả dư, "−10" thiếu (hao vượt mức). */
function signedGram(value: string | null) {
  if (value == null) return '—'
  const n = Number(Number(value).toFixed(2))
  if (n === 0) return '0'
  return `${n > 0 ? '+' : '−'}${g(String(Math.abs(n)))}`
}

type ScrapDue = { dueGram: string | null; balanceGram: string | null }

function SumsCells({ row, scrapGram, due }: { row: LossSums; scrapGram: string | null; due: ScrapDue | null }) {
  const balance = due?.balanceGram == null ? null : Number(due.balanceGram)
  return (
    <>
      <TableCell className="num">{row.qty.toLocaleString('vi-VN')}</TableCell>
      <TableCell className="num">{g(row.inGram)}</TableCell>
      <TableCell className="num" sx={{ fontWeight: 700 }}>
        {g(row.returnedGram)}
      </TableCell>
      <TableCell className="num">{g(row.productGram)}</TableCell>
      <TableCell className="num">{g(row.btpGram)}</TableCell>
      <TableCell className="num">{g(row.nvlGram)}</TableCell>
      <TableCell className="num">{scrapGram == null ? '' : g(scrapGram)}</TableCell>
      <TableCell className="num">{g(row.lossGram)}</TableCell>
      <TableCell className="num">{g(row.allowedGram)}</TableCell>
      {/* Dòng khâu không có phần mạt (mạt nộp theo thợ, cả tuần) — để trống. */}
      <TableCell className="num" sx={{ fontWeight: 700 }}>
        {due ? g(due.dueGram) : ''}
      </TableCell>
      <TableCell
        className="num"
        sx={{
          fontWeight: 700,
          color: balance == null || balance === 0 ? undefined : balance < 0 ? OVERVIEW_COLOR.danger : OK_COLOR,
        }}
      >
        {due ? (
          <Tooltip
            title={
              balance == null
                ? 'Có khâu chưa đặt mức cho phép'
                : balance < 0
                  ? 'Trả thiếu mạt — thợ hao vượt mức cho phép'
                  : 'Trả đủ / dư mạt — thợ hao trong mức'
            }
          >
            <span>{signedGram(due.balanceGram)}</span>
          </Tooltip>
        ) : (
          ''
        )}
      </TableCell>
      <TableCell className="num">{pct(row.limitPercent)}</TableCell>
      <TableCell className="num" sx={{ color: lossColor(row), fontWeight: 700 }}>
        {pct(row.lossPercent)}
      </TableCell>
    </>
  )
}

const weekHeaders = (metal: LossMetal) => [
  'Số lượng sản phẩm trong tuần',
  lossInHeader(metal),
  'Tổng trọng lượng trả lại',
  'Trọng lượng hàng trả (sản phẩm)',
  'Trọng lượng bán thành phẩm thu hồi (lưu kho để sử dụng sau)',
  'Trọng lượng NVL thu hồi',
  'Trọng lượng mạt vụn thu hồi (sau khi cô lại)',
  'Hao hụt',
  'Thợ được hao',
  'Phải trả mạt vụn',
  'Chênh lệch mạt (đã trả − phải trả)',
  'Mức hao hụt cho phép',
  'Mức hao hụt thực tế (trên hàng đạt)',
]

/** Một tuần: dòng tổng mỗi thợ (giống bảng Excel), bấm mở xem từng khâu và từng phiếu. */
function WeekTable({
  data,
  canDelete,
  stage,
  filtered,
}: {
  data: WeeklyLossReport
  canDelete: boolean
  /** Đang lọc một khâu: dòng thợ đã là số của khâu, mở ra thấy thẳng từng phiếu. */
  stage: LossStage | ''
  filtered: boolean
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: deleteScrapReturnApi,
    onSuccess: () => {
      toast.success('Đã xoá phiếu mạt và gỡ phiếu nhập kho')
      void queryClient.invalidateQueries({ queryKey: ['loss-reports'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const itemsOf = (row: LossWorkerRow) =>
    data.items.filter((item) => item.workerKey === row.workerKey && item.week === row.week)
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const scraps = data.scrapReturns
  const [scrapPage, setScrapPage] = useState(0)
  // Đổi tuần / bộ lọc làm danh sách ngắn lại thì kéo về trang cuối còn dữ liệu.
  const currentScrapPage = Math.min(scrapPage, Math.max(0, Math.ceil(scraps.length / SCRAP_PAGE_SIZE) - 1))
  const scrapRows = scraps.slice(currentScrapPage * SCRAP_PAGE_SIZE, (currentScrapPage + 1) * SCRAP_PAGE_SIZE)
  const headers = weekHeaders(data.metal)
  const metalLabel = LOSS_METAL_LABEL[data.metal].toLowerCase()

  return (
    <Stack spacing={2}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ ...TABLE_SX, minWidth: 1360 }}>
          <TableHead>
            <TableRow>
              <TableCell>Thợ</TableCell>
              {headers.map((title) => (
                <TableCell key={title} className="num">
                  {title}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.workers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length + 1}>
                  <Typography variant="body2" color="text.secondary">
                    {filtered
                      ? 'Không có số liệu khớp bộ lọc trong tuần này.'
                      : 'Tuần này chưa có lượt khâu nào được chốt số.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              data.workers.map((row) => {
                const expanded = open.has(row.workerKey)
                const items = expanded ? itemsOf(row) : []
                return (
                  <Fragment key={row.workerKey}>
                    <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => toggle(row.workerKey)}>
                      <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {expanded ? (
                          <KeyboardArrowDownIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                        ) : (
                          <KeyboardArrowRightIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                        )}
                        {row.workerName}
                        {stage ? (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {row.tickets.toLocaleString('vi-VN')} phiếu
                          </Typography>
                        ) : null}
                      </TableCell>
                      <SumsCells row={row} scrapGram={row.scrapGram} due={stage ? null : row} />
                    </TableRow>
                    {expanded && stage
                      ? items.map((item) => <ItemRow key={`${item.ticketCode}-${item.stage}-${item.attempt}`} item={item} />)
                      : null}
                    {expanded && !stage
                      ? row.stages.map((sums) => (
                          <Fragment key={sums.stage}>
                            <TableRow sx={{ bgcolor: '#fcfaf6' }}>
                              <TableCell sx={{ pl: 5, whiteSpace: 'nowrap' }}>
                                <b>{LOSS_STAGE_LABEL[sums.stage]}</b>
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                  {sums.tickets.toLocaleString('vi-VN')} phiếu
                                </Typography>
                              </TableCell>
                              <SumsCells row={sums} scrapGram={null} due={null} />
                            </TableRow>
                            {items
                              .filter((item) => item.stage === sums.stage)
                              .map((item) => (
                                <ItemRow key={`${item.ticketCode}-${item.stage}-${item.attempt}`} item={item} />
                              ))}
                          </Fragment>
                        ))
                      : null}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
        <b>TL thợ giữ</b> = TL giao − TL trả (hàng đạt + BTP + NVL thu hồi). <b>Thợ được hao</b> = TL hàng
        trả đạt × mức cho phép của khâu (cộng các khâu). <b>Phải trả mạt vụn</b> = TL thợ giữ − được hao.{' '}
        <b>Chênh lệch</b> = mạt đã trả − phải trả: <b>âm</b> là thợ hao vượt mức, <b>dương</b> là trả dư.{' '}
        <b>Mức hao thực tế</b> = (TL thợ giữ − mạt đã trả) ÷ TL hàng đạt. Khâu chưa đặt mức thì không tính được (—).
      </Typography>

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Mạt vụn {metalLabel} đã nhận tuần này
        </Typography>
        {scraps.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa ghi mạt vụn {metalLabel} nào cho tuần này.
          </Typography>
        ) : (
          <>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ ...TABLE_SX, minWidth: 560 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Thợ</TableCell>
                    <TableCell className="num">Trọng lượng mạt vụn thu hồi (sau khi cô lại)</TableCell>
                    <TableCell>Thủ kho nhận</TableCell>
                    <TableCell>Ghi chú</TableCell>
                    {canDelete ? <TableCell /> : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scrapRows.map((scrap) => (
                    <TableRow key={scrap.id}>
                      <TableCell>{scrap.workerName}</TableCell>
                      <TableCell className="num">{g(scrap.weightGram)} g</TableCell>
                      <TableCell>
                        {scrap.receivedByName}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {new Date(scrap.receivedAt).toLocaleString('vi-VN')}
                        </Typography>
                      </TableCell>
                      <TableCell>{scrap.note ?? ''}</TableCell>
                      {canDelete ? (
                        <TableCell padding="checkbox">
                          <Tooltip title="Xoá phiếu mạt (gỡ phiếu nhập kho NVL)">
                            <span>
                              <IconButton
                                size="small"
                                disabled={remove.isPending}
                                onClick={async () => {
                                  const ok = await confirmDialog({
                                    title: 'Xoá phiếu mạt vụn?',
                                    message: `${scrap.workerName} · ${g(scrap.weightGram)} g. Phiếu nhập kho NVL ${metalLabel} thu hồi đi kèm cũng bị gỡ.`,
                                    confirmLabel: 'Xoá',
                                    tone: 'error',
                                  })
                                  if (ok) remove.mutate(scrap.id)
                                }}
                              >
                                <TrashIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={scraps.length}
              page={currentScrapPage}
              onPageChange={(_, next) => setScrapPage(next)}
              rowsPerPage={SCRAP_PAGE_SIZE}
              rowsPerPageOptions={[]}
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count} phiếu mạt`}
              sx={{ borderTop: '1px solid #e9e0d4' }}
            />
          </>
        )}
      </Box>
    </Stack>
  )
}

function ItemRow({ item }: { item: LossItem }) {
  return (
    <TableRow sx={{ '& td': { color: 'text.secondary', fontSize: '0.78rem' } }}>
      <TableCell sx={{ pl: 7, whiteSpace: 'nowrap' }}>
        {item.ticketCode}
        {item.attempt > 1 ? ` · lần ${item.attempt}` : ''}
        <Typography component="span" variant="caption" sx={{ ml: 1 }}>
          {new Date(item.confirmedAt).toLocaleDateString('vi-VN')}
        </Typography>
      </TableCell>
      <TableCell className="num">{item.qty.toLocaleString('vi-VN')}</TableCell>
      <TableCell className="num">{g(item.inGram)}</TableCell>
      <TableCell />
      <TableCell className="num">{g(item.productGram)}</TableCell>
      <TableCell className="num">{g(item.btpGram)}</TableCell>
      <TableCell className="num">{g(item.nvlGram)}</TableCell>
      <TableCell />
      <TableCell className="num">{g(item.lossGram)}</TableCell>
      <TableCell className="num">{g(item.allowedGram)}</TableCell>
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell className="num">{pct(item.lossPercent)}</TableCell>
    </TableRow>
  )
}

/** Gộp cả kỳ của một thợ: cộng các vế rồi tính lại %, mức cho phép bình quân theo TL hàng đạt. */
function periodOf(rows: LossWorkerRow[]) {
  let inGram = 0
  let productGram = 0
  let returned = 0
  let allowed = 0
  let limitKnown = true
  for (const row of rows) {
    inGram += Number(row.inGram)
    productGram += Number(row.productGram)
    returned += Number(row.returnedGram)
    if (row.allowedGram != null) allowed += Number(row.allowedGram)
    // Tuần chỉ có mạt (không giao gì) không ảnh hưởng mức; tuần có khâu chưa đặt mức thì cả kỳ không có mức.
    else if (row.stages.length > 0) limitKnown = false
  }
  const loss = inGram - returned
  // % trên TL hàng đạt, mức cho phép = được hao / hàng đạt — giống dòng tuần.
  return {
    lossGram: String(loss),
    lossPercent: productGram > 0 ? ((loss / productGram) * 100).toFixed(2) : null,
    limitPercent: limitKnown && productGram > 0 ? ((allowed / productGram) * 100).toFixed(2) : null,
  }
}

/** So sánh nhiều tuần: mỗi thợ một dòng, mỗi tuần một cột % hao thực tế (kèm gram). */
function CompareTable({ data, filtered }: { data: WeeklyLossReport; filtered: boolean }) {
  const byWorker = new Map<string, { name: string; weeks: Map<string, LossWorkerRow> }>()
  for (const row of data.workers) {
    const entry = byWorker.get(row.workerKey) ?? { name: row.workerName, weeks: new Map() }
    entry.weeks.set(row.week, row)
    byWorker.set(row.workerKey, entry)
  }
  const workers = [...byWorker.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'vi'))

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ ...TABLE_SX, minWidth: 220 + (data.weeks.length + 1) * 96 }}>
        <TableHead>
          <TableRow>
            <TableCell>Thợ</TableCell>
            {data.weeks.map((week) => (
              <TableCell key={week.start} className="num">
                <Tooltip title={weekLabel(week.start)}>
                  <span>{weekShort(week.start)}</span>
                </Tooltip>
              </TableCell>
            ))}
            <TableCell className="num">Cả kỳ</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {workers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={data.weeks.length + 2}>
                <Typography variant="body2" color="text.secondary">
                  {filtered
                    ? 'Không có số liệu khớp bộ lọc trong khoảng tuần này.'
                    : 'Khoảng tuần này chưa có lượt khâu nào được chốt số.'}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            workers.map(([key, worker]) => {
              const period = periodOf([...worker.weeks.values()])
              return (
                <TableRow key={key} hover>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{worker.name}</TableCell>
                  {data.weeks.map((week) => {
                    const row = worker.weeks.get(week.start)
                    return (
                      <TableCell key={week.start} className="num">
                        {row ? <CompareCell row={row} /> : <Box sx={{ color: 'text.disabled' }}>—</Box>}
                      </TableCell>
                    )
                  })}
                  <TableCell className="num" sx={{ bgcolor: '#fcfaf6' }}>
                    <CompareCell row={period} />
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function CompareCell({ row }: { row: { lossGram: string; lossPercent: string | null; limitPercent: string | null } }) {
  return (
    <Tooltip title={row.limitPercent != null ? `Mức cho phép ${pct(row.limitPercent)}` : 'Chưa đặt mức cho phép'}>
      <Box>
        <Box sx={{ fontWeight: 700, color: lossColor(row) }}>{pct(row.lossPercent)}</Box>
        <Typography variant="caption" color="text.secondary">
          {g(row.lossGram)} g
        </Typography>
      </Box>
    </Tooltip>
  )
}
