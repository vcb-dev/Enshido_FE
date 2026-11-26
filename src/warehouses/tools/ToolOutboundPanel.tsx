import { useMemo, useState } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { formatMoney, formatQty } from '../../api/inventory'
import {
  getToolHoldingsApi,
  getToolSummaryApi,
  type ToolFigure,
  type ToolHolding,
  type ToolSummaryRow,
} from '../../api/tools'
import { useAuth } from '../../auth/AuthContext'
import { canAny, Permission } from '../../auth/permissions'
import { DataTable, PanelSummaryCard, SearchInput, type Column } from '../../components/ui'
import { useWarehousePeriod } from '../warehousePeriod'
import { ToolHistoryDialog } from './ToolHistoryDialog'
import { ToolMoveDialog, type ToolMoveDraft } from './ToolMoveDialog'

const numCell = { fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const }

/** Ô giá trị + SL nhỏ bên dưới; không có gì thì gạch. */
function FigureCell({ figure, tone }: { figure: ToolFigure; tone?: 'error' | 'warning' }) {
  if (Number(figure.qty) === 0 && Number(figure.amount) === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        —
      </Typography>
    )
  }
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600 }} color={tone ? `${tone}.main` : undefined}>
        {formatMoney(figure.amount)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        SL {formatQty(figure.qty)}
      </Typography>
    </>
  )
}

const sumAmount = (rows: ToolSummaryRow[], pick: (row: ToolSummaryRow) => ToolFigure) =>
  rows.reduce((total, row) => total + Number(pick(row).amount), 0)

/**
 * Tab Xuất của kho dụng cụ — luồng xuất duy nhất: dụng cụ ra khỏi kho là xuất cho một thợ, nên tab
 * này theo dõi luôn từng thợ. Mỗi thợ một dòng: đang giữ (hiện tại) và xuất / chuyển / hỏng trong
 * kỳ. Xổ dòng thợ để xem từng dụng cụ đang giữ và ghi chuyển / hỏng cho món đó; nút
 * Lịch sử mở các phiếu của thợ trong kỳ (huỷ phiếu ghi nhầm ở đó).
 */
export function ToolOutboundPanel() {
  const { user } = useAuth()
  // Thủ kho và QC cùng quản lý kho dụng cụ; kế toán chỉ xem.
  const canWrite = canAny(user, Permission.WAREHOUSE_KEEPER, Permission.PRODUCTION_QC)
  const period = useWarehousePeriod()
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<ToolMoveDraft>({ kind: 'ISSUE' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [historyOf, setHistoryOf] = useState<{ id: string; name: string } | null>(null)
  const openDraft = (next: ToolMoveDraft) => {
    setDraft(next)
    setDialogOpen(true)
  }

  const summary = useQuery({
    queryKey: ['tools', 'summary', period.from, period.to],
    queryFn: () => getToolSummaryApi(period),
    placeholderData: keepPreviousData,
  })
  const holdings = useQuery({
    queryKey: ['tools', 'holdings', ''],
    queryFn: () => getToolHoldingsApi(),
  })

  const holdingsByWorker = useMemo(() => {
    const map = new Map<string, ToolHolding[]>()
    for (const row of holdings.data ?? []) {
      const list = map.get(row.workerId) ?? []
      list.push(row)
      map.set(row.workerId, list)
    }
    return map
  }, [holdings.data])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const all = summary.data ?? []
    if (!needle) return all
    return all.filter(
      (row) =>
        row.workerName.toLowerCase().includes(needle) ||
        (holdingsByWorker.get(row.workerId) ?? []).some(
          (item) => item.name.toLowerCase().includes(needle) || item.sku?.toLowerCase().includes(needle),
        ),
    )
  }, [summary.data, search, holdingsByWorker])

  const columns = useMemo<Column<ToolSummaryRow, ToolHolding>[]>(
    () => [
      {
        key: 'workerName',
        header: 'Thợ / dụng cụ',
        width: 260,
        card: 'title',
        render: (row) => (
          <>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {row.workerName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.holdingItems ? `Đang giữ ${row.holdingItems} mã dụng cụ` : 'Không giữ dụng cụ nào'}
            </Typography>
          </>
        ),
        renderSub: (item) => (
          <Typography variant="body2">
            {item.sku ? `${item.sku} — ` : ''}
            {item.name}
          </Typography>
        ),
      },
      {
        key: 'holding',
        header: 'Đang giữ',
        width: 150,
        numeric: true,
        cellSx: numCell,
        render: (row) => <FigureCell figure={row.holding} />,
        renderSub: (item) => (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatQty(item.qty)} {item.unitName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatMoney(item.amount)}
            </Typography>
          </>
        ),
      },
      {
        key: 'issued',
        header: 'Xuất trong kỳ',
        width: 130,
        numeric: true,
        cellSx: numCell,
        render: (row) => <FigureCell figure={row.issued} />,
      },
      {
        key: 'transfer',
        header: 'Chuyển đến / đi',
        width: 140,
        numeric: true,
        cellSx: numCell,
        render: (row) =>
          Number(row.transferredIn.qty) || Number(row.transferredOut.qty) ? (
            <Typography variant="body2">
              +{formatQty(row.transferredIn.qty)} / −{formatQty(row.transferredOut.qty)}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          ),
      },
      {
        key: 'damaged',
        header: 'Hỏng',
        width: 130,
        numeric: true,
        cellSx: numCell,
        render: (row) => <FigureCell figure={row.damaged} tone="warning" />,
      },
      {
        key: 'actions',
        header: '',
        width: canWrite ? 190 : 100,
        card: 'actions',
        render: (row) => (
          <Stack direction="row" spacing={0.5}>
            <Button size="small" onClick={() => setHistoryOf({ id: row.workerId, name: row.workerName })}>
              Lịch sử
            </Button>
            {canWrite ? (
              <Button size="small" onClick={() => openDraft({ kind: 'ISSUE', toWorkerId: row.workerId })}>
                Xuất thêm
              </Button>
            ) : null}
          </Stack>
        ),
        renderSub: (item) =>
          canWrite ? (
            <Button
              size="small"
              onClick={() => openDraft({ kind: 'TRANSFER', fromWorkerId: item.workerId, materialId: item.materialId })}
            >
              Chuyển / hỏng
            </Button>
          ) : null,
      },
    ],
    [canWrite],
  )

  const all = summary.data ?? []
  return (
    <Stack spacing={1} sx={{ flex: { md: 1 }, minHeight: { md: 0 } }}>
      <PanelSummaryCard
        title="Dụng cụ xuất cho thợ"
        stats={[
          { label: 'Thợ đang giữ (giá trị)', value: formatMoney(String(sumAmount(all, (row) => row.holding))), tone: 'stock' },
          { label: 'Xuất trong kỳ', value: formatMoney(String(sumAmount(all, (row) => row.issued))), tone: 'out' },
          { label: 'Hỏng trong kỳ', value: formatMoney(String(sumAmount(all, (row) => row.damaged))), tone: 'neutral' },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.workerId}
        subRows={{
          get: (row) => holdingsByWorker.get(row.workerId) ?? [],
          key: (item) => `${item.workerId}:${item.materialId}`,
          label: (count) => `${count} dụng cụ`,
        }}
        loading={summary.isLoading || holdings.isLoading}
        errorText={summary.error instanceof Error ? summary.error.message : undefined}
        emptyText={
          search.trim()
            ? 'Không có thợ hoặc dụng cụ khớp tìm kiếm.'
            : 'Chưa thợ nào giữ dụng cụ và không có phiếu dụng cụ trong kỳ.'
        }
        variant="grid"
        minWidth={960}
        sx={{ flex: { md: 1 } }}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm thợ hoặc dụng cụ…" />
            {canWrite ? (
              <>
                <Box sx={{ flex: 1, minWidth: 8 }} />
                <Button variant="contained" onClick={() => openDraft({ kind: 'ISSUE' })}>
                  Xuất dụng cụ cho thợ
                </Button>
              </>
            ) : null}
          </>
        }
      />
      {canWrite ? <ToolMoveDialog open={dialogOpen} onClose={() => setDialogOpen(false)} draft={draft} /> : null}
      <ToolHistoryDialog worker={historyOf} period={period} canWrite={canWrite} onClose={() => setHistoryOf(null)} />
    </Stack>
  )
}
