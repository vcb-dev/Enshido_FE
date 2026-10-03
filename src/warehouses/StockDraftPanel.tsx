import { useMemo, useState } from 'react'
import { Box, Chip, Link, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import {
  formatQty,
  getWarehouseOutboundDraftsApi,
  type OutboundDraftRow,
  type OutboundDraftStatus,
} from '../api/inventory'
import { DataTable, type Column } from '../components/ui'
import { formatDateShort } from '../orders/catalog'
import { LIVE_REFRESH_MS, liveRefresh } from '../hooks/liveRefresh'

const STATUS_META: Record<OutboundDraftStatus, { label: string; color: 'warning' | 'success' | 'default' }> = {
  DRAFT: { label: 'Đang giữ', color: 'warning' },
  POSTED: { label: 'Đã xuất', color: 'success' },
  VOID: { label: 'Huỷ', color: 'default' },
}

type Filter = OutboundDraftStatus | 'ALL'

/**
 * Phiếu xuất nháp của kho NVL chính — đá cấp cho khâu Vào đá (lúc chỉ định thợ hoặc thợ xin
 * thêm). Chưa trừ tồn, chỉ trừ vào khả dụng. Hệ thống tự lập / thu nhỏ / đóng theo luồng sản
 * xuất nên màn này chỉ để xem: thủ kho xác nhận sau KCS thì phiếu thành phiếu xuất thật.
 */
export function StockDraftPanel({ warehouseCode }: { warehouseCode: string }) {
  const [filter, setFilter] = useState<Filter>('DRAFT')
  const drafts = useQuery({
    queryKey: ['warehouse-outbound-drafts', warehouseCode],
    queryFn: () => getWarehouseOutboundDraftsApi(warehouseCode),
    // Phiếu nháp sinh / đóng theo thao tác ở đơn sản xuất (chỉ định thợ, xin thêm, xác nhận).
    ...liveRefresh(LIVE_REFRESH_MS.list),
  })
  const all = useMemo(() => drafts.data ?? [], [drafts.data])
  const rows = filter === 'ALL' ? all : all.filter((row) => row.status === filter)
  const openCount = all.filter((row) => row.status === 'DRAFT').length

  const columns = useMemo<Column<OutboundDraftRow>[]>(
    () => [
      { key: 'stt', header: 'STT', width: 60, numeric: true, render: (row) => row.stt },
      { key: 'issuedAt', header: 'Ngày cấp', width: 110, render: (row) => formatDateShort(row.issuedAt) },
      {
        key: 'ticketCode',
        header: 'Phiếu SX',
        width: 110,
        render: (row) => (
          <Link component={RouterLink} to={`/tickets/${row.ticketCode}`} sx={{ fontWeight: 700 }}>
            {row.ticketCode}
          </Link>
        ),
      },
      {
        key: 'name',
        header: 'Mã hàng',
        render: (row) => (
          <>
            {row.sku ? `${row.sku} — ` : ''}
            {row.name}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {row.fromRequest ? 'Thợ xin thêm' : 'Cấp lúc chỉ định thợ'}
            </Typography>
          </>
        ),
      },
      {
        key: 'qty',
        header: 'SL đang giữ',
        width: 120,
        numeric: true,
        render: (row) => (
          <>
            {formatQty(row.qty)} {row.unit}
            {row.stoneCount != null && row.unit.trim().toLowerCase() !== 'viên' ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {row.stoneCount} viên
              </Typography>
            ) : null}
          </>
        ),
      },
      {
        key: 'gramQty',
        header: 'Số gram',
        width: 100,
        numeric: true,
        render: (row) => (row.gramQty != null ? formatQty(row.gramQty) : '—'),
      },
      {
        key: 'earlyReturnedWeight',
        header: 'Trả giữa khâu (g)',
        width: 120,
        numeric: true,
        render: (row) => (row.earlyReturnedWeight ? formatQty(row.earlyReturnedWeight) : '—'),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        width: 160,
        render: (row) => (
          <>
            <Chip size="small" variant="outlined" color={STATUS_META[row.status].color} label={STATUS_META[row.status].label} />
            {row.posted ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Phiếu xuất STT {row.posted.stt}: {formatQty(row.posted.qty)} {row.unit}
                {row.posted.gramQty ? ` · ${formatQty(row.posted.gramQty)} g` : ''}
              </Typography>
            ) : null}
            {row.closedByName ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {row.closedByName} · {formatDateShort(row.closedAt)}
              </Typography>
            ) : null}
          </>
        ),
      },
      { key: 'createdByName', header: 'Người lập', width: 130 },
      { key: 'note', header: 'Ghi chú', ellipsis: true, render: (row) => row.note ?? '' },
    ],
    [],
  )

  return (
    <Stack spacing={1} sx={{ flex: { md: 1 }, minHeight: { md: 0 } }}>
      <Typography variant="body2" color="text.secondary">
        Đá cấp cho khâu Vào đá: chưa trừ tồn, chỉ trừ vào khả dụng. Thợ trả túi giữa khâu thì phiếu giảm; thủ kho xác
        nhận sau KCS thì phiếu thành phiếu xuất thật với phần đã dùng. Hệ thống tự lập phiếu — không sửa tay.
      </Typography>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={drafts.isLoading}
        errorText={drafts.error instanceof Error ? drafts.error.message : undefined}
        emptyText={filter === 'DRAFT' ? 'Không có phiếu xuất nháp đang giữ.' : 'Chưa có phiếu xuất nháp.'}
        variant="grid"
        minWidth={1200}
        sx={{ flex: { md: 1 } }}
        toolbar={
          <Box>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filter}
              onChange={(_, value: Filter | null) => value && setFilter(value)}
            >
              <ToggleButton value="DRAFT">Đang giữ ({openCount})</ToggleButton>
              <ToggleButton value="POSTED">Đã xuất</ToggleButton>
              <ToggleButton value="VOID">Huỷ</ToggleButton>
              <ToggleButton value="ALL">Tất cả</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        }
      />
    </Stack>
  )
}
