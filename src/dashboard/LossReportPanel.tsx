import { Fragment, useState } from 'react'
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
  TableRow,
  TextField,
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
  LOSS_STAGE_LABEL,
  type LossItem,
  type LossSums,
  type LossWorkerRow,
  type WeeklyLossReport,
} from '../api/lossReports'
import { confirmDialog, TableSkeleton, TrashIcon } from '../components/ui'
import { LossLimitsDialog } from './LossLimitsDialog'
import { addDays, buildLossSheets, isOver, todayKey, weekLabel, weekShort, weekStart } from './lossReport'
import { OVERVIEW_COLOR } from './overviewShared'
import { ScrapReturnDialog } from './ScrapReturnDialog'
import { downloadXlsx } from './xlsx'

type Mode = 'week' | 'compare'

const COMPARE_WEEKS = 8
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
 * Tab Hao hụt: báo cáo hao hụt bạc theo tuần của từng thợ ở từng khâu (tab BÁO CÁO trong mô tả luồng).
 * Xem một tuần như bảng Excel, hoặc so sánh nhiều tuần liền nhau; xuất Excel cả hai.
 */
export function LossReportPanel() {
  const { user } = useAuth()
  const isKeeper = can(user, Permission.WAREHOUSE_KEEPER)
  const today = todayKey()
  const thisWeek = weekStart(today)
  const [mode, setMode] = useState<Mode>('week')
  const [week, setWeek] = useState(thisWeek)
  const [compareFrom, setCompareFrom] = useState(addDays(thisWeek, -7 * (COMPARE_WEEKS - 1)))
  const [compareTo, setCompareTo] = useState(thisWeek)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [scrapOpen, setScrapOpen] = useState(false)

  const range =
    mode === 'week'
      ? { from: week, to: week }
      : { from: weekStart(compareFrom || thisWeek), to: weekStart(compareTo || thisWeek) }
  const validRange = range.from <= range.to
  const report = useQuery({
    queryKey: ['loss-reports', 'weekly', range.from, range.to],
    queryFn: () => getWeeklyLossApi(range),
    enabled: validRange,
    placeholderData: keepPreviousData,
  })
  const data = report.data

  const exportExcel = () => {
    if (!data) return
    const name =
      data.weeks.length === 1
        ? `hao-hut-tuan-${data.weeks[0].start}`
        : `hao-hut-${data.weeks[0].start}-den-${data.weeks[data.weeks.length - 1].start}`
    downloadXlsx(name, buildLossSheets(data))
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
            Hao hụt bạc theo tuần
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
          value={mode}
          onChange={(_, value: Mode | null) => value && setMode(value)}
        >
          <ToggleButton value="week">Theo tuần</ToggleButton>
          <ToggleButton value="compare">So sánh nhiều tuần</ToggleButton>
        </ToggleButtonGroup>
        {mode === 'week' ? (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <IconButton size="small" aria-label="Tuần trước" onClick={() => setWeek(addDays(week, -7))}>
              <ChevronLeftIcon />
            </IconButton>
            <TextField
              size="small"
              type="date"
              label="Tuần có ngày"
              value={week}
              onChange={(event) => event.target.value && setWeek(weekStart(event.target.value))}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
            />
            <IconButton
              size="small"
              aria-label="Tuần sau"
              disabled={week >= thisWeek}
              onClick={() => setWeek(addDays(week, 7))}
            >
              <ChevronRightIcon />
            </IconButton>
            <Typography variant="body2" sx={{ fontWeight: 600, pl: 1, whiteSpace: 'nowrap' }}>
              {weekLabel(week)}
            </Typography>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              size="small"
              type="date"
              label="Từ tuần có ngày"
              value={compareFrom}
              onChange={(event) => setCompareFrom(event.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: compareTo || today } }}
            />
            <TextField
              size="small"
              type="date"
              label="Đến tuần có ngày"
              value={compareTo}
              onChange={(event) => setCompareTo(event.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: compareFrom || undefined, max: today } }}
            />
          </Stack>
        )}
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
          {mode === 'week' ? <WeekTable data={data} canDelete={isKeeper} /> : <CompareTable data={data} />}
        </Box>
      )}

      <LossLimitsDialog open={limitsOpen} onClose={() => setLimitsOpen(false)} canEdit={isKeeper} />
      {isKeeper ? (
        <ScrapReturnDialog open={scrapOpen} onClose={() => setScrapOpen(false)} defaultWeek={week} />
      ) : null}
    </Paper>
  )
}

function SumsCells({ row, scrapGram }: { row: LossSums; scrapGram: string | null }) {
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
      <TableCell className="num">{pct(row.limitPercent)}</TableCell>
      <TableCell className="num" sx={{ color: lossColor(row), fontWeight: 700 }}>
        {pct(row.lossPercent)}
      </TableCell>
    </>
  )
}

const WEEK_HEADERS = [
  'Số lượng sản phẩm trong tuần',
  'Tổng trọng lượng nguyên liệu Bạc/Vàng được giao',
  'Tổng trọng lượng trả lại',
  'Trọng lượng hàng trả (sản phẩm)',
  'Trọng lượng bán thành phẩm thu hồi (lưu kho để sử dụng sau)',
  'Trọng lượng NVL thu hồi',
  'Trọng lượng mạt vụn thu hồi (sau khi cô lại)',
  'Hao hụt',
  'Mức hao hụt cho phép',
  'Mức hao hụt thực tế',
]

/** Một tuần: dòng tổng mỗi thợ (giống bảng Excel), bấm mở xem từng khâu và từng phiếu. */
function WeekTable({ data, canDelete }: { data: WeeklyLossReport; canDelete: boolean }) {
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

  return (
    <Stack spacing={2}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ ...TABLE_SX, minWidth: 1080 }}>
          <TableHead>
            <TableRow>
              <TableCell>Thợ</TableCell>
              {WEEK_HEADERS.map((title) => (
                <TableCell key={title} className="num">
                  {title}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.workers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={WEEK_HEADERS.length + 1}>
                  <Typography variant="body2" color="text.secondary">
                    Tuần này chưa có lượt khâu nào được chốt số.
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
                      </TableCell>
                      <SumsCells row={row} scrapGram={row.scrapGram} />
                    </TableRow>
                    {expanded
                      ? row.stages.map((stage) => (
                          <Fragment key={stage.stage}>
                            <TableRow sx={{ bgcolor: '#fcfaf6' }}>
                              <TableCell sx={{ pl: 5, whiteSpace: 'nowrap' }}>
                                <b>{LOSS_STAGE_LABEL[stage.stage]}</b>
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                  {stage.tickets.toLocaleString('vi-VN')} phiếu
                                </Typography>
                              </TableCell>
                              <SumsCells row={stage} scrapGram={null} />
                            </TableRow>
                            {items
                              .filter((item) => item.stage === stage.stage)
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

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Mạt vụn đã nhận tuần này
        </Typography>
        {scraps.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa ghi mạt vụn nào cho tuần này.
          </Typography>
        ) : (
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
                {scraps.map((scrap) => (
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
                                  message: `${scrap.workerName} · ${g(scrap.weightGram)} g. Phiếu nhập kho NVL bạc thu hồi đi kèm cũng bị gỡ.`,
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
      <TableCell />
      <TableCell className="num">{pct(item.lossPercent)}</TableCell>
    </TableRow>
  )
}

/** Gộp cả kỳ của một thợ: cộng các vế rồi tính lại %, mức cho phép bình quân theo TL giao. */
function periodOf(rows: LossWorkerRow[]) {
  let inGram = 0
  let returned = 0
  let limitWeighted = 0
  let limitKnown = true
  for (const row of rows) {
    inGram += Number(row.inGram)
    returned += Number(row.returnedGram)
    if (row.limitPercent != null) limitWeighted += Number(row.inGram) * Number(row.limitPercent)
    // Tuần chỉ có mạt (không giao gì) không ảnh hưởng mức; tuần có khâu chưa đặt mức thì cả kỳ không có mức.
    else if (row.stages.length > 0) limitKnown = false
  }
  const loss = inGram - returned
  return {
    lossGram: String(loss),
    lossPercent: inGram > 0 ? ((loss / inGram) * 100).toFixed(2) : null,
    limitPercent: limitKnown && inGram > 0 ? (limitWeighted / inGram).toFixed(2) : null,
  }
}

/** So sánh nhiều tuần: mỗi thợ một dòng, mỗi tuần một cột % hao thực tế (kèm gram). */
function CompareTable({ data }: { data: WeeklyLossReport }) {
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
                  Khoảng tuần này chưa có lượt khâu nào được chốt số.
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
