import { useState } from 'react'
import {
  Alert,
  Box,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  getWorkerPerformanceApi,
  type PerformanceCell,
  type PerformanceStageKey,
  type PerformanceStatus,
} from '../api/productionOrders'
import { AutocompleteInput, ChartLegend, SelectInput, TableSkeleton } from '../components/ui'
import { LIVE_REFRESH_MS, liveRefresh } from '../hooks/liveRefresh'
import { fmt } from './overviewShared'

type Measure = 'orders' | 'qty'

const MEASURE_OPTIONS: { value: Measure; label: string }[] = [
  { value: 'orders', label: 'Đơn hàng' },
  { value: 'qty', label: 'Sản phẩm' },
]

/** Trạng thái việc của thợ: nhãn cột ngắn, nhãn chú thích và màu (đã kiểm mù màu). */
const STATUS_META: { key: PerformanceStatus; short: string; label: string; color: string }[] = [
  { key: 'PENDING', short: 'Chưa làm', label: 'Chưa làm — đã nhận / được giao', color: '#8a8478' },
  { key: 'WORKING', short: 'Đang làm', label: 'Đang làm — chưa được nhận lại', color: '#2a78d6' },
  { key: 'DONE', short: 'Hoàn thiện', label: 'Hoàn thiện — nhận đạt', color: '#1a8f63' },
  { key: 'DEFECT', short: 'Lỗi', label: 'Lỗi — QC ghi lỗi / đúc hỏng', color: '#b52c1d' },
]

const LEGEND = STATUS_META.map((s) => ({ key: s.key, label: s.label, color: s.color }))

/** Cột tên thợ ghim trái khi cuộn ngang. */
const STICKY_START_SX = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  bgcolor: 'background.paper',
  borderRight: '1px solid #e9e0d4',
} as const

const WORKER_STAGES: PerformanceStageKey[] = ['FILING', 'STONE_SETTING', 'ENGRAVING', 'POLISHING', 'PLATING']

/** Khâu tài khoản được làm; đủ 5 khâu thợ thì gộp thành "Nguội → Xi". */
function stagesCaption(keys: PerformanceStageKey[], label: Map<PerformanceStageKey, string>) {
  const allWorker = WORKER_STAGES.every((key) => keys.includes(key))
  const parts = keys
    .filter((key) => !(allWorker && WORKER_STAGES.includes(key)))
    .map((key) => label.get(key) ?? key)
  if (allWorker) parts.push('Nguội → Xi')
  return parts.join(' · ')
}

/** Ngày hôm nay theo giờ máy, YYYY-MM-DD. */
function todayKey() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Tab Hiệu suất thợ: danh sách mọi thợ, mỗi khâu chia Chưa làm / Đang làm / Hoàn thiện / Lỗi, đếm theo
 * đơn hoặc sản phẩm. Hoàn thiện / lỗi theo lúc QC nhận lại trong khoảng ngày; chưa làm / đang làm là
 * việc đang ở thợ lúc xem.
 */
export function WorkerPerformancePanel() {
  const today = todayKey()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [measure, setMeasure] = useState<Measure>('qty')
  const [stageFilter, setStageFilter] = useState<PerformanceStageKey | 'all'>('all')
  const [workerFilter, setWorkerFilter] = useState<string>('all')
  const validRange = Boolean(from && to && from <= to)

  const performance = useQuery({
    queryKey: ['production-orders', 'worker-performance', from, to],
    queryFn: () => getWorkerPerformanceApi({ from, to }),
    enabled: validRange,
    placeholderData: keepPreviousData,
    ...liveRefresh(LIVE_REFRESH_MS.background),
  })
  const data = performance.data
  const stages = (data?.stages ?? []).filter((stage) => stageFilter === 'all' || stage.key === stageFilter)
  // Lọc khâu: chỉ còn thợ được làm khâu đó hoặc có việc ở khâu đó — ô Thợ cũng chỉ liệt kê họ.
  const stageRows = (data?.rows ?? []).filter(
    (row) =>
      stageFilter === 'all' ||
      row.workerStages.includes(stageFilter) ||
      Object.values(row.cells[stageFilter] ?? {}).some((count) => count.orders > 0),
  )
  const rows = stageRows.filter((row) => workerFilter === 'all' || row.workerKey === workerFilter)
  // Xem một thợ thì số đầu cột là của thợ đó; còn lại là tổng mọi thợ (đơn không đếm trùng).
  const selectedRow = workerFilter === 'all' ? null : rows[0]
  const totalOf = (key: PerformanceStageKey) =>
    selectedRow ? selectedRow.cells[key] : data?.totals[key]
  const stageLabel = new Map(data?.stages.map((stage) => [stage.key, stage.label]))
  const valueOf = (cell: PerformanceCell | undefined, status: PerformanceStatus) =>
    cell ? cell[status][measure] : 0
  const statusesOf = (stage: { statuses: PerformanceStatus[] }) =>
    STATUS_META.filter((status) => stage.statuses.includes(status.key))
  const columnCount = stages.reduce((sum, stage) => sum + stage.statuses.length, 0)

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: { md: 'flex-start' } }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Hiệu suất thợ theo khâu
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Hoàn thiện / Lỗi: QC hoặc thủ kho nhận lại trong khoảng ngày · Chưa làm / Đang làm: việc đang ở thợ lúc xem · 3D / Sáp chỉ ghi Hoàn thiện
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(140px, 1fr))', lg: 'repeat(5, minmax(140px, 1fr))' },
          }}
        >
          <TextField
            size="small"
            type="date"
            label="Từ ngày"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: to || undefined } }}
          />
          <TextField
            size="small"
            type="date"
            label="Đến ngày"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from || undefined } }}
          />
          <SelectInput
            size="small"
            label="Tính theo"
            options={MEASURE_OPTIONS}
            value={measure}
            onChange={(value) => setMeasure(value || 'qty')}
          />
          <SelectInput<PerformanceStageKey | 'all'>
            size="small"
            label="Khâu"
            options={[
              { value: 'all', label: 'Tất cả khâu' },
              ...(data?.stages ?? []).map((stage) => ({ value: stage.key, label: stage.label })),
            ]}
            value={stageFilter}
            onChange={(value) => {
              const stage = value || 'all'
              setStageFilter(stage)
              // Thợ đang chọn không làm khâu mới thì bỏ lọc thợ.
              const row = data?.rows.find((r) => r.workerKey === workerFilter)
              if (
                stage !== 'all' &&
                row &&
                !row.workerStages.includes(stage) &&
                !Object.values(row.cells[stage] ?? {}).some((count) => count.orders > 0)
              ) {
                setWorkerFilter('all')
              }
            }}
          />
          <AutocompleteInput
            label="Thợ"
            placeholder="Tất cả thợ"
            options={stageRows}
            value={stageRows.find((row) => row.workerKey === workerFilter) ?? null}
            onChange={(row) => setWorkerFilter(row?.workerKey ?? 'all')}
            getOptionLabel={(row) => row.workerName}
            isOptionEqualToValue={(option, value) => option.workerKey === value.workerKey}
            noOptionsText="Không có thợ nào"
          />
        </Box>
      </Stack>
      <Box sx={{ mb: 1.5, overflowX: 'auto' }}>
        <ChartLegend series={LEGEND} />
      </Box>

      {!validRange ? (
        <Alert severity="warning">Chọn ngày bắt đầu không sau ngày kết thúc.</Alert>
      ) : performance.isError ? (
        <Alert severity="error">Không tải được hiệu suất thợ: {performance.error.message}</Alert>
      ) : !data ? (
        <TableSkeleton />
      ) : (
        <TableContainer sx={{ overflowX: 'auto', opacity: performance.isPlaceholderData ? 0.6 : 1 }}>
          <Table
            size="small"
            sx={{
              minWidth: 200 + columnCount * 84,
              borderCollapse: 'separate',
              borderSpacing: 0,
              '& td, & th': { px: 1, py: 0.75, fontSize: '0.84rem', borderColor: '#e9e0d4' },
              '& th': { fontWeight: 700, bgcolor: '#f8f3eb', whiteSpace: 'nowrap' },
              '& .stage-start': { borderLeft: '1px solid #e9e0d4' },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell rowSpan={2} sx={{ ...STICKY_START_SX, bgcolor: '#f8f3eb', verticalAlign: 'bottom' }}>
                  Thợ
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {fmt(rows.length)} người · {measure === 'orders' ? 'đơn' : 'sp'}
                  </Typography>
                </TableCell>
                {stages.map((stage) => (
                  <TableCell key={stage.key} colSpan={stage.statuses.length} align="center" className="stage-start">
                    {stage.label}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                {stages.flatMap((stage) =>
                  statusesOf(stage).map((status, i) => (
                    <TableCell
                      key={`${stage.key}-${status.key}`}
                      align="center"
                      className={i === 0 ? 'stage-start' : undefined}
                      sx={{ fontWeight: 600 }}
                    >
                      <Typography variant="caption" sx={{ display: 'block', color: status.color, fontWeight: 700 }}>
                        {status.short}
                      </Typography>
                      <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(valueOf(totalOf(stage.key), status.key))}
                      </Box>
                    </TableCell>
                  )),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount + 1}>
                    <Typography variant="body2" color="text.secondary">
                      {data.rows.length ? 'Không có thợ nào khớp bộ lọc.' : 'Chưa có tài khoản thợ nào.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.workerKey} hover>
                    <TableCell sx={{ ...STICKY_START_SX, whiteSpace: 'nowrap' }}>
                      {row.workerName}
                      {row.workerStages.length ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {stagesCaption(row.workerStages, stageLabel)}
                        </Typography>
                      ) : null}
                    </TableCell>
                    {stages.flatMap((stage) =>
                      statusesOf(stage).map((status, i) => {
                        const value = valueOf(row.cells[stage.key], status.key)
                        return (
                          <TableCell
                            key={`${stage.key}-${status.key}`}
                            align="center"
                            className={i === 0 ? 'stage-start' : undefined}
                            sx={{
                              fontVariantNumeric: 'tabular-nums',
                              color: value ? status.color : 'text.disabled',
                              fontWeight: value ? 700 : 400,
                            }}
                          >
                            {fmt(value)}
                          </TableCell>
                        )
                      }),
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  )
}
