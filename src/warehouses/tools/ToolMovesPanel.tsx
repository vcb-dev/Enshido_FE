import { useMemo, useState } from 'react'
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatMoney, formatQty } from '../../api/inventory'
import {
  deleteToolMoveApi,
  getToolMovesApi,
  TOOL_MOVE_KINDS,
  TOOL_MOVE_LABEL,
  type ToolMoveKind,
  type ToolMoveRow,
} from '../../api/tools'
import { useAuth } from '../../auth/AuthContext'
import { can, Permission } from '../../auth/permissions'
import {
  confirmDialog,
  DataTable,
  FILTER_FIELD_SX,
  SearchInput,
  SelectInput,
  TrashIcon,
  type Column,
} from '../../components/ui'
import { formatDateShort } from '../../orders/catalog'
import { useWarehousePeriod } from '../warehousePeriod'
import { ToolMoveDialog, type ToolMoveDraft } from './ToolMoveDialog'
import { invalidateToolQueries } from './toolQueries'

const KIND_COLOR: Record<ToolMoveKind, 'primary' | 'success' | 'info' | 'default' | 'warning' | 'error'> = {
  ISSUE: 'primary',
  RETURN: 'success',
  TRANSFER: 'info',
  WORN: 'default',
  DAMAGED: 'warning',
  LOST: 'error',
}

type KindFilter = ToolMoveKind | 'ALL'

/**
 * Tab Phiếu dụng cụ: mọi phiếu cấp / trả / chuyển / hao mòn / hỏng / mất trong kỳ đang chọn. Thủ kho
 * ghi phiếu mới và huỷ phiếu ghi nhầm (hệ thống đảo lại tồn thợ + phiếu kho đi kèm).
 */
export function ToolMovesPanel() {
  const { user } = useAuth()
  const canWrite = can(user, Permission.WAREHOUSE_KEEPER)
  const queryClient = useQueryClient()
  const period = useWarehousePeriod()
  const [kind, setKind] = useState<KindFilter>('ALL')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<ToolMoveDraft>({ kind: 'ISSUE' })
  const [dialogOpen, setDialogOpen] = useState(false)

  const moves = useQuery({
    queryKey: ['tools', 'moves', period.from, period.to],
    queryFn: () => getToolMovesApi(period),
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (row: ToolMoveRow) => deleteToolMoveApi(row.id),
    onSuccess: (_, row) => {
      toast.success(`Đã huỷ phiếu ${row.code}`)
      invalidateToolQueries(queryClient)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const askRemove = async (row: ToolMoveRow) => {
    const ok = await confirmDialog({
      title: `Huỷ phiếu ${row.code}?`,
      message: `${row.kindLabel} ${formatQty(row.qty)} ${row.material.unitName} ${row.material.name}.`,
      items: [
        'Tồn dụng cụ của thợ trở về như trước phiếu này.',
        ...(row.hasStockLine
          ? [row.kind === 'ISSUE' ? 'Xoá phiếu xuất kho đi kèm — hàng về lại kho.' : 'Xoá phiếu nhập kho đi kèm.']
          : []),
      ],
      confirmLabel: 'Huỷ phiếu',
      cancelLabel: 'Giữ lại',
      tone: 'warning',
    })
    if (ok) remove.mutate(row)
  }

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (moves.data ?? []).filter((row) => {
      if (kind !== 'ALL' && row.kind !== kind) return false
      if (!needle) return true
      return [row.code, row.material.name, row.material.sku, row.fromWorker?.name, row.toWorker?.name, row.note]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(needle))
    })
  }, [moves.data, kind, search])

  const columns = useMemo<Column<ToolMoveRow>[]>(
    () => [
      {
        key: 'code',
        header: 'Số phiếu',
        width: 100,
        card: 'title',
        render: (row) => <Typography sx={{ fontWeight: 700, fontSize: 'inherit' }}>{row.code}</Typography>,
      },
      { key: 'movedAt', header: 'Ngày', width: 100, render: (row) => formatDateShort(row.movedAt) },
      {
        key: 'kind',
        header: 'Loại',
        width: 120,
        render: (row) => <Chip size="small" variant="outlined" color={KIND_COLOR[row.kind]} label={row.kindLabel} />,
      },
      {
        key: 'material',
        header: 'Dụng cụ',
        render: (row) => `${row.material.sku ? `${row.material.sku} — ` : ''}${row.material.name}`,
      },
      { key: 'fromWorker', header: 'Thợ giao', width: 150, render: (row) => row.fromWorker?.name ?? '—' },
      { key: 'toWorker', header: 'Thợ nhận', width: 150, render: (row) => row.toWorker?.name ?? '—' },
      {
        key: 'qty',
        header: 'SL',
        width: 100,
        numeric: true,
        render: (row) => `${formatQty(row.qty)} ${row.material.unitName}`,
      },
      { key: 'amount', header: 'Giá trị', width: 120, numeric: true, render: (row) => formatMoney(row.amount) },
      { key: 'note', header: 'Ghi chú / lý do', ellipsis: true, render: (row) => row.note ?? '' },
      { key: 'createdByName', header: 'Người ghi', width: 130 },
      ...(canWrite
        ? [
            {
              key: 'actions',
              header: '',
              width: 56,
              card: 'actions' as const,
              render: (row: ToolMoveRow) => (
                <Tooltip title="Huỷ phiếu ghi nhầm">
                  <IconButton size="small" onClick={() => void askRemove(row)} disabled={remove.isPending}>
                    <TrashIcon />
                  </IconButton>
                </Tooltip>
              ),
            },
          ]
        : []),
    ],
    [canWrite, remove.isPending],
  )

  const filtering = kind !== 'ALL' || search.trim() !== ''
  return (
    <Stack spacing={1} sx={{ flex: { md: 1 }, minHeight: { md: 0 } }}>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={moves.isLoading}
        errorText={moves.error instanceof Error ? moves.error.message : undefined}
        emptyText={filtering ? 'Không có phiếu khớp bộ lọc.' : 'Không có phiếu dụng cụ trong kỳ đang chọn.'}
        variant="grid"
        minWidth={1400}
        sx={{ flex: { md: 1 } }}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm số phiếu, dụng cụ, thợ…" />
            <SelectInput
              size="small"
              label="Loại phiếu"
              value={kind}
              onChange={(value) => setKind(value as KindFilter)}
              options={[
                { value: 'ALL', label: 'Tất cả' },
                ...TOOL_MOVE_KINDS.map((value) => ({ value, label: TOOL_MOVE_LABEL[value] })),
              ]}
              sx={FILTER_FIELD_SX}
            />
            {canWrite ? (
              <>
                <Box sx={{ flex: 1, minWidth: 8 }} />
                <Button
                  variant="contained"
                  onClick={() => {
                    setDraft({ kind: 'ISSUE' })
                    setDialogOpen(true)
                  }}
                >
                  Ghi phiếu dụng cụ
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
