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
 * Tab Theo thợ của kho dụng cụ: mỗi thợ một dòng — đang giữ (hiện tại) và cấp / trả / hao mòn /
 * hỏng / mất trong kỳ đang chọn. Xổ dòng thợ để xem từng dụng cụ đang giữ và ghi phiếu cho món đó.
 */
export function ToolHoldersPanel() {
  const { user } = useAuth()
  // Thủ kho và QC cùng quản lý kho dụng cụ; kế toán chỉ xem.
  const canWrite = canAny(user, Permission.WAREHOUSE_KEEPER, Permission.PRODUCTION_QC)
  const period = useWarehousePeriod()
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<ToolMoveDraft>({ kind: 'ISSUE' })
  const [dialogOpen, setDialogOpen] = useState(false)
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
        header: 'Cấp trong kỳ',
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
        key: 'returned',
        header: 'Trả về kho',
        width: 130,
        numeric: true,
        cellSx: numCell,
        render: (row) => <FigureCell figure={row.returned} />,
      },
      {
        key: 'worn',
        header: 'Hao mòn',
        width: 130,
        numeric: true,
        cellSx: numCell,
        render: (row) => <FigureCell figure={row.worn} />,
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
        key: 'lost',
        header: 'Mất',
        width: 130,
        numeric: true,
        cellSx: numCell,
        render: (row) => <FigureCell figure={row.lost} tone="error" />,
      },
      ...(canWrite
        ? [
            {
              key: 'actions',
              header: '',
              width: 120,
              card: 'actions' as const,
              render: (row: ToolSummaryRow) => (
                <Button size="small" onClick={() => openDraft({ kind: 'ISSUE', toWorkerId: row.workerId })}>
                  Cấp thêm
                </Button>
              ),
              renderSub: (item: ToolHolding) => (
                <Button
                  size="small"
                  onClick={() => openDraft({ kind: 'RETURN', fromWorkerId: item.workerId, materialId: item.materialId })}
                >
                  Trả / báo
                </Button>
              ),
            },
          ]
        : []),
    ],
    [canWrite],
  )

  const all = summary.data ?? []
  return (
    <Stack spacing={1} sx={{ flex: { md: 1 }, minHeight: { md: 0 } }}>
      <PanelSummaryCard
        title="Tổng hợp dụng cụ theo thợ"
        stats={[
          { label: 'Thợ đang giữ (giá trị)', value: formatMoney(String(sumAmount(all, (row) => row.holding))), tone: 'stock' },
          { label: 'Cấp trong kỳ', value: formatMoney(String(sumAmount(all, (row) => row.issued))), tone: 'out' },
          { label: 'Hao mòn trong kỳ', value: formatMoney(String(sumAmount(all, (row) => row.worn))), tone: 'neutral' },
          { label: 'Hỏng trong kỳ', value: formatMoney(String(sumAmount(all, (row) => row.damaged))), tone: 'neutral' },
          { label: 'Mất trong kỳ', value: formatMoney(String(sumAmount(all, (row) => row.lost))), tone: 'neutral' },
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
        minWidth={1300}
        sx={{ flex: { md: 1 } }}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm thợ hoặc dụng cụ…" />
            {canWrite ? (
              <>
                <Box sx={{ flex: 1, minWidth: 8 }} />
                <Button variant="contained" onClick={() => openDraft({ kind: 'ISSUE' })}>
                  Cấp dụng cụ
                </Button>
              </>
            ) : null}
          </>
        }
      />
      {canWrite ? <ToolMoveDialog open={dialogOpen} onClose={() => setDialogOpen(false)} draft={draft} /> : null}
    </Stack>
  )
}
