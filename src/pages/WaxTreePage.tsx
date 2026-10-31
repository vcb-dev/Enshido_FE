import { useMemo, useState } from 'react'
import { Button, Stack, Typography } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listIntakeOrdersApi,
  ORDER_METAL_TYPE_LABELS,
  submitIntakeCastingTreeBatchApi,
  type IntakeOrder,
} from '../api/intakeOrders'
import { formatCt } from '../api/inventory'
import { useAuth } from '../auth/AuthContext'
import { can, Permission } from '../auth/permissions'
import { ColumnHeaderSearch, DataTable, PageHeader, type Column } from '../components/ui'
import { LIVE_REFRESH_MS, liveRefresh } from '../hooks/liveRefresh'
import { useTableParams } from '../hooks/useTableParams'
import { formatIntakeGram } from '../intake/intakeDisplay'
import { intakeCastingTreeImages } from '../intake/intakeImages'
import { IntakeImageThumbs } from '../intake/IntakeImageThumbs'
import { IntakeOrderDetailDialog } from '../intake/IntakeOrderDetailDialog'
import { IntakeStatusChip } from '../intake/IntakeStatusChip'
import { afterIntakeBatchUpdated } from '../intake/intakeOrderCache'
import { WaxTreeBatchDialog } from '../intake/WaxTreeBatchDialog'
import { formatDate } from '../orders/catalog'
import { RequestTypeChip } from '../orders/OrderChips'
import type { OrderImage } from '../api/productionOrders'

const cellLeft = { textAlign: 'left', paddingLeft: '10px' } as const

function stoneLabel(row: IntakeOrder) {
  if (row.stoneCount3d === 0) return 'Không đá'
  const count = row.stoneCount3d != null ? `${row.stoneCount3d} viên` : null
  const weight =
    row.stoneWeight3dGram != null && row.stoneWeight3dGram !== '' ? formatCt(row.stoneWeight3dGram) : null
  if (!count && !weight) return '—'
  return [count, weight].filter(Boolean).join(' · ')
}

/**
 * Màn Cấy cây thông: đơn Chờ SX · Đã in sáp. Thợ sáp chọn nhiều đơn cùng một cây, cân cả cây.
 */
export function WaxTreePage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canWax = can(user, Permission.PRODUCTION_WAX)
  const [selecting, setSelecting] = useState(false)
  const [viewTarget, setViewTarget] = useState<IntakeOrder | null>(null)
  const table = useTableParams({ pageSize: 25 })
  const { params } = table

  const list = useQuery({
    queryKey: ['intake-orders', 'wax-tree', params.page, params.pageSize, params.search],
    queryFn: () =>
      listIntakeOrdersApi({
        status: 'WAX_PRINTED',
        includeChildren: true,
        search: params.search,
        page: params.page,
        pageSize: params.pageSize,
      }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    ...liveRefresh(LIVE_REFRESH_MS.list),
  })

  const save = useMutation({
    mutationFn: (payload: {
      orderIds: string[]
      lines?: Array<{ orderId: string; produceQty?: number }>
      castingTreeWeightGram: number
      images: OrderImage[]
    }) => submitIntakeCastingTreeBatchApi(payload),
    onSuccess: (result) => {
      setSelecting(false)
      afterIntakeBatchUpdated(queryClient, result.items)
      void queryClient.invalidateQueries({ queryKey: ['intake-orders', 'wax-tree'] })
      void queryClient.invalidateQueries({ queryKey: ['intake-orders', 'wax-tree-candidates'] })
      toast.success(`Đã cấy ${result.items.length} đơn — lên lệnh đúc ở màn Lệnh đúc`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo<Column<IntakeOrder>[]>(
    () => [
      {
        key: 'sxCode',
        header: 'Mã SX',
        width: 104,
        align: 'left',
        headSx: cellLeft,
        cellSx: { ...cellLeft, fontWeight: 700 },
        render: (row) => row.sxCode || '—',
        filter: (
          <ColumnHeaderSearch
            value={params.search}
            onChange={(search) => table.setSearch(search)}
            placeholder="Tìm mã SX, mã đơn…"
          />
        ),
      },
      {
        key: 'code',
        header: 'Mã đơn hàng',
        width: 110,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        ellipsis: true,
        render: (row) => row.code,
      },
      {
        key: 'createdDate',
        header: 'Ngày tạo',
        width: 120,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => formatDate(row.createdDate ?? row.createdAt),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        width: 170,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => <IntakeStatusChip status={row.status} />,
      },
      {
        key: 'productName',
        header: 'Tên sản phẩm',
        width: 180,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        ellipsis: true,
        render: (row) => row.productName?.trim() || '—',
      },
      {
        key: 'requestType',
        header: 'Loại đơn hàng',
        width: 140,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => <RequestTypeChip type={row.requestType} />,
      },
      {
        key: 'metalType',
        header: 'Loại vàng/bạc',
        width: 120,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => (row.metalType ? ORDER_METAL_TYPE_LABELS[row.metalType] : '—'),
      },
      {
        key: 'qty',
        header: 'SL lên đơn',
        width: 100,
        align: 'right',
        numeric: true,
        render: (row) => (
          <Stack spacing={0} sx={{ alignItems: 'flex-end', lineHeight: 1.25 }}>
            <span>{row.qty}</span>
            {(row.waxReleasedQty ?? 0) > 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Đang đúc {row.waxReleasedQty} đơn
              </Typography>
            ) : null}
          </Stack>
        ),
      },
      {
        key: 'productWeightGram',
        header: 'TL sáp (g)',
        width: 110,
        align: 'right',
        numeric: true,
        render: (row) => formatIntakeGram(row.productWeightGram) ?? '—',
      },
      {
        key: 'stone',
        header: 'Đá 3D',
        width: 130,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        ellipsis: true,
        render: (row) => stoneLabel(row),
      },
      {
        key: 'dueDate',
        header: 'Thời gian trả hàng',
        width: 140,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => formatDate(row.dueDate),
      },
      {
        key: 'trackingCode',
        header: 'Mã sản phẩm',
        width: 120,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        ellipsis: true,
        render: (row) => row.trackingCode?.trim() || '—',
      },
      {
        key: 'customerCode',
        header: 'Mã của khách',
        width: 120,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        ellipsis: true,
        render: (row) => row.customerCode?.trim() || '—',
      },
      {
        key: 'customerName',
        header: 'Khách hàng',
        width: 110,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        ellipsis: true,
        render: (row) => row.customerName?.trim() || '—',
      },
      {
        key: 'placedBy',
        header: 'Người đặt đơn',
        width: 120,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        ellipsis: true,
        render: (row) => row.placedBy || '—',
      },
      {
        key: 'description',
        header: 'Yêu cầu khác',
        width: 220,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        ellipsis: true,
        render: (row) => row.description || '—',
      },
      {
        key: 'castingTreeWeightGram',
        header: 'TL cây thông (g)',
        width: 130,
        align: 'right',
        numeric: true,
        render: (row) => formatIntakeGram(row.castingTreeWeightGram) ?? '—',
      },
      {
        key: 'castingTreeImages',
        header: 'Ảnh cây thông',
        width: 120,
        render: (row) => (
          <IntakeImageThumbs label="Ảnh cây thông" images={intakeCastingTreeImages(row.images)} />
        ),
      },
    ],
    [params.search, table],
  )

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}
    >
      <PageHeader
        title="Cấy cây thông"
        subtitle="Đơn Chờ SX · Đã in sáp. Bấm Cấy cây thông để chọn nhiều đơn cùng một cây."
        compactSubtitle
        actions={
          canWax ? (
            <Button variant="contained" disabled={save.isPending} onClick={() => setSelecting(true)}>
              Cấy cây thông
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={list.isLoading && !list.data}
        errorText={list.error instanceof Error ? list.error.message : undefined}
        emptyText="Chưa có đơn Chờ SX · Đã in sáp."
        variant="grid"
        fixedLayout
        minWidth={1730}
        page={params.page}
        pageSize={params.pageSize}
        total={list.data?.total ?? 0}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        onRowClick={(row) => setViewTarget(row)}
        rowsLabel="đơn"
        sx={{ flex: { md: 1 } }}
      />
      <WaxTreeBatchDialog
        open={selecting}
        saving={save.isPending}
        onClose={() => setSelecting(false)}
        onSave={(payload) => save.mutate(payload)}
      />
      <IntakeOrderDetailDialog order={viewTarget} onClose={() => setViewTarget(null)} />
    </Stack>
  )
}
