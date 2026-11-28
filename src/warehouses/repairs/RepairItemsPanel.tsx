import { useCallback, useMemo, useState } from 'react'
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  deleteRepairItemApi,
  getRepairItemsApi,
  REPAIR_SOURCE_OPTIONS,
  REPAIR_STAGE_LABEL,
  REPAIR_STAGE_OPTIONS,
  REPAIR_STATUS_OPTIONS,
  type RepairItem,
  type RepairSource,
  type RepairStage,
  type RepairStatus,
} from '../../api/repairs'
import { useAuth } from '../../auth/AuthContext'
import { can, isCustomerOnly, Permission } from '../../auth/permissions'
import {
  confirmDialog,
  DataTable,
  FILTER_FIELD_SX,
  PanelSummaryCard,
  RowActions,
  SearchInput,
  SelectInput,
  type Column,
} from '../../components/ui'
import { paginate, useTableParams } from '../../hooks/useTableParams'
import { RepairConfirmDialog, type RepairConfirmMode } from './RepairConfirmDialog'
import { RepairItemDialog } from './RepairItemDialog'

const numCell = { fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const }

const STATUS_LABEL = Object.fromEntries(REPAIR_STATUS_OPTIONS.map((o) => [o.value, o.label])) as Record<
  RepairStatus,
  string
>
const STATUS_COLOR: Record<RepairStatus, 'warning' | 'info' | 'success'> = {
  WAITING: 'warning',
  REPAIRING: 'info',
  RETURNED: 'success',
}

/** Ngày YYYY-MM-DD → dd/mm/yyyy. */
function fullDate(value: string | null) {
  if (!value) return ''
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/**
 * Kho sửa chữa: một bảng hàng gửi sửa. Khách VCB / VPC gửi hàng (ngày, mã / tên sản phẩm, số lượng,
 * chi tiết sửa, người gửi sửa) và chỉ thấy hàng của mình; thủ kho làm hai bước ở nút trên
 * dòng (RepairConfirmDialog, cả phiếu một lần): Nhận hàng lúc khách gửi, Trả hàng khi sửa xong. Lọc theo loại
 * hàng (trước khi nhập kho / trong kho), VPC / VCB và tình trạng. Không động tồn kho nào.
 */
export function RepairItemsPanel() {
  const { user } = useAuth()
  const customer = isCustomerOnly(user)
  const customerSource: RepairSource | null = customer
    ? can(user, Permission.CUSTOMER_VPC)
      ? 'VPC'
      : 'VCB'
    : null
  const queryClient = useQueryClient()
  const table = useTableParams({ pageSize: 25, filters: { stage: '', source: '', status: '' } })
  const { params } = table
  const [editing, setEditing] = useState<RepairItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  // Thủ kho xác nhận — tách khỏi hộp thoại khách gửi sửa.
  const [confirming, setConfirming] = useState<{ rows: RepairItem[]; mode: RepairConfirmMode } | null>(null)

  const items = useQuery({ queryKey: ['repairs'], queryFn: getRepairItemsApi })
  const remove = useMutation({
    mutationFn: (row: RepairItem) => deleteRepairItemApi(row.id),
    onSuccess: () => {
      toast.success('Đã xoá hàng sửa chữa')
      void queryClient.invalidateQueries({ queryKey: ['repairs'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const all = useMemo(() => items.data ?? [], [items.data])
  /** Cả phiếu sửa chứa dòng này: cùng số phiếu + cùng hàng VPC / VCB. Không số phiếu thì chỉ dòng đó. */
  const slipRowsOf = useCallback(
    (row: RepairItem) =>
      row.ticketCode
        ? all
            .filter((other) => other.ticketCode === row.ticketCode && other.source === row.source)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        : [row],
    [all],
  )
  const rows = useMemo(() => {
    const needle = params.search.trim().toLowerCase()
    return all.filter((row) => {
      if (params.stage && row.stage !== params.stage) return false
      if (params.source && row.source !== params.source) return false
      if (params.status && row.status !== params.status) return false
      if (!needle) return true
      return [
        row.ticketCode,
        row.productCode,
        row.productName,
        row.content,
        row.senderName,
        row.note,
        row.transferConfirmedBy,
        row.issuerName,
        row.repairedBy,
        row.returnedBy,
        row.receiverName,
      ]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(needle))
    })
  }, [all, params])
  const pageRows = paginate(rows, params.page, params.pageSize)

  const columns = useMemo<Column<RepairItem>[]>(() => {
    const askRemove = async (row: RepairItem) => {
      const ok = await confirmDialog({
        title: 'Xoá hàng sửa chữa?',
        message: `${row.productCode ?? row.productName ?? ''} — ${row.content}.`,
        confirmLabel: 'Xoá',
        cancelLabel: 'Giữ lại',
        tone: 'warning',
      })
      if (ok) remove.mutate(row)
    }
    const text = (key: keyof RepairItem, header: string, width: number): Column<RepairItem> => ({
      key,
      header,
      width,
      ellipsis: true,
      render: (row) => (row[key] as string | null) ?? '',
    })
    // Khách VCB / VPC: hết sửa / xoá khi thủ kho đã nhận hàng.
    const locked = (row: RepairItem) => customer && row.keeperTouched
    return [
      {
        key: 'receivedAt',
        header: 'Ngày',
        width: 100,
        cellSx: numCell,
        card: 'title',
        render: (row) => fullDate(row.receivedAt),
      },
      text('productCode', 'Mã sản phẩm', 150),
      text('ticketCode', 'Số phiếu sửa', 110),
      text('productName', 'Tên sản phẩm', 200),
      { key: 'qty', header: 'Số lượng', width: 80, numeric: true, cellSx: numCell, render: (row) => row.qty },
      text('content', 'Chi tiết sửa', 220),
      text('senderName', 'Người gửi sửa', 120),
      {
        key: 'status',
        header: 'Tình trạng',
        width: 140,
        render: (row) => (
          <Chip size="small" variant="outlined" color={STATUS_COLOR[row.status]} label={STATUS_LABEL[row.status]} />
        ),
      },
      {
        key: 'stage',
        header: 'Loại hàng',
        width: 150,
        render: (row) => REPAIR_STAGE_LABEL[row.stage],
      },
      ...(customer
        ? []
        : [{ key: 'source', header: 'Khách hàng', width: 100, render: (row: RepairItem) => row.source }]),
      {
        key: 'returnedQty',
        header: 'SL trả',
        width: 70,
        numeric: true,
        cellSx: numCell,
        render: (row) => row.returnedQty ?? '',
      },
      { key: 'returnedAt', header: 'Ngày trả', width: 100, cellSx: numCell, render: (row) => fullDate(row.returnedAt) },
      text('transferConfirmedBy', 'Người xác nhận chuyển hàng SC', 170),
      text('issuerName', 'Người lập phiếu', 130),
      text('repairedBy', 'Người sửa', 120),
      text('returnedBy', 'Người trả', 120),
      text('receiverName', 'Người nhận', 120),
      text('note', 'Note', 160),
      {
        key: 'actions',
        header: '',
        width: customer ? 90 : 250,
        card: 'actions',
        render: (row) => (
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            {customer ? null : (
              <KeeperButtons row={row} onOpen={(mode) => setConfirming({ rows: slipRowsOf(row), mode })} />
            )}
            <RowActions
              onEdit={() => {
                setEditing(row)
                setDialogOpen(true)
              }}
              editDisabled={locked(row)}
              onDelete={() => void askRemove(row)}
              deleteDisabled={locked(row)}
              titles={
                locked(row)
                  ? { edit: 'Thủ kho đã nhận hàng — báo thủ kho nếu cần đổi', delete: 'Thủ kho đã nhận hàng' }
                  : undefined
              }
            />
          </Stack>
        ),
      },
    ]
  }, [customer, remove, slipRowsOf])

  const sum = (pick: (row: RepairItem) => number) => rows.reduce((total, row) => total + pick(row), 0)
  const filtering = Boolean(params.search || params.stage || params.source || params.status)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: { md: 1 }, minHeight: { md: 0 } }}>
      <PanelSummaryCard
        title={filtering ? 'Hàng sửa chữa (theo bộ lọc)' : 'Hàng sửa chữa'}
        stats={[
          { label: 'Số dòng', value: String(rows.length), tone: 'neutral' },
          { label: 'Số lượng gửi', value: String(sum((row) => row.qty)), tone: 'in' },
          { label: 'SL đã trả', value: String(sum((row) => row.returnedQty ?? 0)), tone: 'out' },
          {
            label: 'Chờ thủ kho nhận',
            value: String(rows.filter((row) => row.status === 'WAITING').length),
            tone: 'stock',
          },
        ]}
      />
      <DataTable
        columns={columns}
        rows={pageRows}
        rowKey={(row) => row.id}
        loading={items.isLoading}
        errorText={items.error instanceof Error ? items.error.message : undefined}
        emptyText={
          filtering
            ? 'Không có hàng sửa chữa khớp bộ lọc.'
            : customer
              ? 'Chưa gửi hàng sửa chữa nào. Bấm Gửi hàng sửa chữa.'
              : 'Chưa có hàng sửa chữa.'
        }
        variant="grid"
        minWidth={customer ? 2150 : 2230}
        page={params.page}
        pageSize={params.pageSize}
        total={rows.length}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sx={{ flex: { md: 1 } }}
        toolbar={
          <>
            <SearchInput value={params.search} onChange={table.setSearch} placeholder="Tìm mã, tên, chi tiết sửa, người…" />
            <SelectInput
              size="small"
              label="Loại hàng"
              value={params.stage}
              onChange={(value) => table.setFilter({ stage: String(value) })}
              options={REPAIR_STAGE_OPTIONS}
              clearable
              sx={FILTER_FIELD_SX}
            />
            {customer ? null : (
              <SelectInput
                size="small"
                label="Khách hàng"
                value={params.source}
                onChange={(value) => table.setFilter({ source: String(value) })}
                options={REPAIR_SOURCE_OPTIONS}
                clearable
                sx={FILTER_FIELD_SX}
              />
            )}
            <SelectInput
              size="small"
              label="Tình trạng"
              value={params.status}
              onChange={(value) => table.setFilter({ status: String(value) })}
              options={REPAIR_STATUS_OPTIONS}
              clearable
              sx={FILTER_FIELD_SX}
            />
            {filtering ? (
              <Button size="small" onClick={table.reset}>
                Xóa lọc
              </Button>
            ) : null}
            <Box sx={{ flex: 1, minWidth: 8 }} />
            <Button
              variant="contained"
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              {customer ? 'Gửi hàng sửa chữa' : 'Thêm hàng sửa chữa'}
            </Button>
          </>
        }
      />
      <RepairItemDialog
        open={dialogOpen}
        item={editing}
        customerSource={customerSource}
        defaults={{ stage: params.stage as RepairStage | '', source: params.source as RepairSource | '' }}
        onClose={() => setDialogOpen(false)}
      />
      <RepairConfirmDialog
        rows={confirming?.rows ?? null}
        mode={confirming?.mode ?? 'receive'}
        onClose={() => setConfirming(null)}
      />
      {customer ? (
        <Typography variant="caption" color="text.secondary">
          Đang xem hàng {customerSource}. Thủ kho nhận hàng xong thì dòng bị khoá, không sửa / xoá được nữa.
        </Typography>
      ) : null}
    </Box>
  )
}

/**
 * Nút thủ kho theo tình trạng: chờ nhận → Nhận hàng; đang sửa → Trả hàng (sửa xong mới biết ngày
 * trả, người sửa, người lấy hàng); đã trả → sửa lại. Nhận hàng luôn sửa lại được.
 */
function KeeperButtons({ row, onOpen }: { row: RepairItem; onOpen: (mode: RepairConfirmMode) => void }) {
  const button = (mode: RepairConfirmMode, label: string, primary: boolean) => (
    <Button
      key={mode}
      size="small"
      variant={primary ? 'outlined' : 'text'}
      onClick={() => onOpen(mode)}
      sx={{ whiteSpace: 'nowrap', minWidth: 0, px: 1 }}
    >
      {label}
    </Button>
  )
  if (row.status === 'WAITING') return button('receive', 'Nhận hàng', true)
  return (
    <>
      {row.status === 'RETURNED' ? button('return', 'Sửa trả', false) : button('return', 'Trả hàng', true)}
      {button('receive', 'Sửa nhận', false)}
    </>
  )
}
