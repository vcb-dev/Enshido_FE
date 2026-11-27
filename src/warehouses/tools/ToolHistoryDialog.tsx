import { useMemo, useState } from 'react'
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { confirmDialog, DataTable, FILTER_FIELD_SX, SelectInput, TrashIcon, type Column } from '../../components/ui'
import { useIsMobile } from '../../hooks/useBreakpoint'
import { formatDateShort } from '../../orders/catalog'
import type { WarehousePeriod } from '../warehousePeriod'
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
 * Lịch sử phiếu dụng cụ của một thợ trong kỳ đang xem (mở từ dòng thợ ở tab Xuất): xuất / chuyển /
 * hỏng. Thủ kho / QC huỷ phiếu ghi nhầm — hệ thống đảo lại tồn thợ và phiếu xuất kho đi kèm.
 */
export function ToolHistoryDialog({
  worker,
  period,
  canWrite,
  onClose,
}: {
  worker: { id: string; name: string } | null
  period: WarehousePeriod
  canWrite: boolean
  onClose: () => void
}) {
  const fullScreen = useIsMobile()
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<KindFilter>('ALL')

  const moves = useQuery({
    queryKey: ['tools', 'moves', worker?.id ?? '', period.from, period.to],
    queryFn: () => getToolMovesApi(period, worker?.id),
    enabled: Boolean(worker),
  })

  const remove = useMutation({
    mutationFn: (row: ToolMoveRow) => deleteToolMoveApi(row.id),
    onSuccess: (_, row) => {
      toast.success(`Đã huỷ phiếu ${row.code}`)
      invalidateToolQueries(queryClient)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const rows = useMemo(
    () => (moves.data ?? []).filter((row) => kind === 'ALL' || row.kind === kind),
    [moves.data, kind],
  )

  const columns = useMemo<Column<ToolMoveRow>[]>(() => {
    const askRemove = async (row: ToolMoveRow) => {
      const ok = await confirmDialog({
        title: `Huỷ phiếu ${row.code}?`,
        message: `${row.kindLabel} ${formatQty(row.qty)} ${row.material.unitName} ${row.material.name}.`,
        items: [
          'Dụng cụ người giữ trở về như trước phiếu này.',
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
    // Phiếu chuyển: ghi rõ chuyển đi cho ai / nhận từ ai so với thợ đang xem.
    const counterpart = (row: ToolMoveRow) => {
      if (row.kind !== 'TRANSFER') return ''
      return row.fromWorker?.id === worker?.id ? `→ ${row.toWorker?.name ?? ''}` : `← ${row.fromWorker?.name ?? ''}`
    }
    return [
      {
        key: 'code',
        header: 'Số phiếu',
        width: 96,
        card: 'title',
        render: (row) => <Typography sx={{ fontWeight: 700, fontSize: 'inherit' }}>{row.code}</Typography>,
      },
      { key: 'movedAt', header: 'Ngày', width: 80, render: (row) => formatDateShort(row.movedAt) },
      {
        key: 'kind',
        header: 'Loại',
        width: 150,
        render: (row) => (
          <>
            <Chip size="small" variant="outlined" color={KIND_COLOR[row.kind]} label={row.kindLabel} />
            {row.kind === 'TRANSFER' ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {counterpart(row)}
              </Typography>
            ) : null}
          </>
        ),
      },
      {
        key: 'material',
        header: 'Dụng cụ',
        render: (row) => `${row.material.sku ? `${row.material.sku} — ` : ''}${row.material.name}`,
      },
      {
        key: 'qty',
        header: 'SL',
        width: 90,
        numeric: true,
        render: (row) => `${formatQty(row.qty)} ${row.material.unitName}`,
      },
      { key: 'amount', header: 'Giá trị', width: 110, numeric: true, render: (row) => formatMoney(row.amount) },
      { key: 'note', header: 'Ghi chú / lý do', ellipsis: true, render: (row) => row.note ?? '' },
      { key: 'createdByName', header: 'Người ghi', width: 120 },
      ...(canWrite
        ? [
            {
              key: 'actions',
              header: '',
              width: 52,
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
    ]
  }, [canWrite, remove, worker?.id])

  return (
    <Dialog open={Boolean(worker)} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="lg">
      <DialogTitle>Lịch sử dụng cụ — {worker?.name}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Phiếu từ {formatDateShort(period.from)} đến {formatDateShort(period.to)} (đổi kỳ ở góc trên trang).
            {canWrite ? ' Phiếu ghi nhầm thì bấm thùng rác để huỷ.' : ''}
          </Typography>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            loading={moves.isLoading}
            errorText={moves.error instanceof Error ? moves.error.message : undefined}
            emptyText={kind === 'ALL' ? 'Người này không có phiếu dụng cụ trong kỳ.' : 'Không có phiếu loại này trong kỳ.'}
            variant="grid"
            minWidth={1000}
            toolbar={
              <SelectInput
                size="small"
                label="Loại phiếu"
                value={kind}
                onChange={(value) => setKind((value || 'ALL') as KindFilter)}
                options={[
                  { value: 'ALL', label: 'Tất cả' },
                  ...TOOL_MOVE_KINDS.map((value) => ({ value, label: TOOL_MOVE_LABEL[value] })),
                ]}
                sx={FILTER_FIELD_SX}
              />
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  )
}
