import { useMemo, useState } from 'react'
import { Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatMoney, formatQty } from '../../api/inventory'
import {
  confirmAssetAccountingApi,
  confirmAssetAuditApi,
  deleteToolAssetApi,
  getToolAssetsApi,
  getToolGroupsApi,
  TOOL_DEPARTMENTS,
  type AssetStatus,
  type ToolAsset,
} from '../../api/tools'
import { useAuth } from '../../auth/AuthContext'
import { can, canAny, Permission } from '../../auth/permissions'
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
import { ToolAssetDialog } from './ToolAssetDialog'
import { invalidateToolQueries } from './toolQueries'

const STATUS_COLOR: Record<AssetStatus, 'success' | 'default' | 'warning' | 'error'> = {
  IN_USE: 'success',
  UNUSED: 'default',
  DAMAGED: 'error',
  NONE: 'default',
}

const STATUS_OPTIONS: Array<{ value: AssetStatus; label: string }> = [
  { value: 'IN_USE', label: 'Đang sử dụng' },
  { value: 'UNUSED', label: 'Chưa sử dụng' },
  { value: 'DAMAGED', label: 'Hỏng' },
  { value: 'NONE', label: 'Hết' },
]

const numCell = { fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const }

/** Ngày YYYY-MM-DD → dd/mm/yyyy. */
function fullDate(value: string | null) {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Mốc ISO → dd/mm/yyyy theo giờ Việt Nam. */
function vnDate(value: string | null) {
  if (!value) return ''
  return fullDate(new Date(new Date(value).getTime() + 7 * 3600_000).toISOString())
}

/**
 * Tab Tồn của kho dụng cụ = sổ tài sản xưởng: mỗi dòng một mã TS với nhóm, ngày mua, SL, đơn giá,
 * thành tiền, còn trong kho, người đang giữ, trạng thái (tự tính), phòng ban, đã dán mã, kiểm kê,
 * kế toán xác nhận, phân bổ. Thủ kho / QC thêm, sửa, xác nhận kiểm kê; kế toán xác nhận.
 */
export function ToolAssetsPanel() {
  const { user } = useAuth()
  const canWrite = canAny(user, Permission.WAREHOUSE_KEEPER, Permission.PRODUCTION_QC)
  const canAccount = can(user, Permission.ACCOUNTING_APPROVE)
  const queryClient = useQueryClient()
  const table = useTableParams({
    pageSize: 25,
    filters: { group: '', department: '', status: '', label: '' },
  })
  const { params } = table
  const [editing, setEditing] = useState<ToolAsset | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const assets = useQuery({ queryKey: ['tools', 'assets'], queryFn: getToolAssetsApi })
  const groups = useQuery({ queryKey: ['tools', 'groups'], queryFn: () => getToolGroupsApi() })

  const onDone = (message: string) => () => {
    toast.success(message)
    invalidateToolQueries(queryClient)
  }
  const audit = useMutation({
    mutationFn: (input: { row: ToolAsset; confirmed: boolean }) => confirmAssetAuditApi(input.row.id, input.confirmed),
    onSuccess: (_, input) => onDone(input.confirmed ? `Đã xác nhận kiểm kê ${input.row.code}` : 'Đã bỏ xác nhận kiểm kê')(),
    onError: (error: Error) => toast.error(error.message),
  })
  const accounting = useMutation({
    mutationFn: (input: { row: ToolAsset; confirmed: boolean }) =>
      confirmAssetAccountingApi(input.row.id, input.confirmed),
    onSuccess: (_, input) => onDone(input.confirmed ? `Kế toán đã xác nhận ${input.row.code}` : 'Đã bỏ kế toán xác nhận')(),
    onError: (error: Error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (row: ToolAsset) => deleteToolAssetApi(row.id),
    onSuccess: (_, row) => onDone(`Đã xoá tài sản ${row.code}`)(),
    onError: (error: Error) => toast.error(error.message),
  })

  const all = useMemo(() => assets.data ?? [], [assets.data])
  const rows = useMemo(() => {
    const needle = params.search.trim().toLowerCase()
    return all.filter((row) => {
      if (params.group && row.group?.id !== params.group) return false
      if (params.department && row.department !== params.department) return false
      if (params.status && row.status !== params.status) return false
      if (params.label === 'yes' && !row.labelStuck) return false
      if (params.label === 'no' && row.labelStuck) return false
      if (!needle) return true
      return [row.code, row.name, row.group?.name, row.note, row.companyAllocation, ...row.holders.map((h) => h.name)]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(needle))
    })
  }, [all, params])
  const pageRows = paginate(rows, params.page, params.pageSize)

  const columns = useMemo<Column<ToolAsset>[]>(() => {
    const askRemove = async (row: ToolAsset) => {
      const ok = await confirmDialog({
        title: `Xoá tài sản ${row.code}?`,
        message: `${row.name}. Chỉ xoá được tài sản thêm nhầm, chưa có phiếu nào.`,
        confirmLabel: 'Xoá',
        cancelLabel: 'Giữ lại',
        tone: 'warning',
      })
      if (ok) remove.mutate(row)
    }
    return [
      {
        key: 'code',
        header: 'Mã TS',
        width: 120,
        card: 'title',
        render: (row) => <Typography sx={{ fontWeight: 700, fontSize: 'inherit' }}>{row.code ?? '—'}</Typography>,
      },
      {
        key: 'group',
        header: 'Nhóm',
        width: 150,
        ellipsis: true,
        render: (row) => row.group?.name ?? '—',
      },
      { key: 'name', header: 'Tên thiết bị + hãng + cấu hình', ellipsis: true, render: (row) => row.name },
      { key: 'purchasedAt', header: 'Ngày mua', width: 100, render: (row) => fullDate(row.purchasedAt) },
      {
        key: 'purchasedQty',
        header: 'SL',
        width: 80,
        numeric: true,
        cellSx: numCell,
        render: (row) => `${formatQty(row.purchasedQty)} ${row.unit.name}`,
      },
      { key: 'unitPrice', header: 'Đơn giá', width: 110, numeric: true, cellSx: numCell, render: (row) => formatMoney(row.unitPrice) },
      {
        key: 'purchaseAmount',
        header: 'Thành tiền',
        width: 120,
        numeric: true,
        cellSx: numCell,
        render: (row) => formatMoney(row.purchaseAmount),
      },
      {
        key: 'inStock',
        header: 'Trong kho',
        width: 90,
        numeric: true,
        cellSx: numCell,
        render: (row) => (Number(row.inStock) ? formatQty(row.inStock) : '—'),
      },
      {
        key: 'holders',
        header: 'Người đang giữ',
        width: 190,
        render: (row) =>
          row.holders.length ? (
            <Stack spacing={0.25}>
              {row.holders.map((holder) => (
                <Typography key={holder.id} variant="body2">
                  {holder.name}
                  {row.holders.length > 1 || Number(holder.qty) !== 1 ? ` (${formatQty(holder.qty)})` : ''}
                </Typography>
              ))}
            </Stack>
          ) : (
            '—'
          ),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        width: 130,
        render: (row) => (
          <>
            <Chip size="small" variant="outlined" color={STATUS_COLOR[row.status]} label={row.statusLabel} />
            {Number(row.damaged) && row.status !== 'DAMAGED' ? (
              <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                Hỏng {formatQty(row.damaged)}
              </Typography>
            ) : null}
          </>
        ),
      },
      { key: 'department', header: 'Phòng ban', width: 130, render: (row) => row.departmentLabel ?? '—' },
      {
        key: 'labelStuck',
        header: 'Dán mã',
        width: 96,
        render: (row) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.labelStuck ? 'success' : 'warning'}
            label={row.labelStuck ? 'Đã dán' : 'Chưa dán'}
          />
        ),
      },
      {
        key: 'audit',
        header: 'Kiểm kê',
        width: 150,
        render: (row) =>
          row.auditCheckedAt ? (
            <Tooltip title={canWrite ? 'Bấm để bỏ xác nhận (bấm nhầm)' : ''}>
              <Box
                onClick={canWrite ? () => audit.mutate({ row, confirmed: false }) : undefined}
                sx={{ cursor: canWrite ? 'pointer' : 'default' }}
              >
                <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                  ✓ {row.auditCheckedByName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {vnDate(row.auditCheckedAt)}
                </Typography>
              </Box>
            </Tooltip>
          ) : canWrite ? (
            <Button size="small" onClick={() => audit.mutate({ row, confirmed: true })} disabled={audit.isPending}>
              Xác nhận
            </Button>
          ) : (
            <Typography variant="body2" color="text.disabled">
              Chưa
            </Typography>
          ),
      },
      {
        key: 'accounting',
        header: 'KT xác nhận',
        width: 150,
        render: (row) =>
          row.accountingCheckedAt ? (
            <Tooltip title={canAccount ? 'Bấm để bỏ xác nhận (bấm nhầm)' : ''}>
              <Box
                onClick={canAccount ? () => accounting.mutate({ row, confirmed: false }) : undefined}
                sx={{ cursor: canAccount ? 'pointer' : 'default' }}
              >
                <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                  ✓ {row.accountingCheckedByName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {vnDate(row.accountingCheckedAt)}
                </Typography>
              </Box>
            </Tooltip>
          ) : canAccount ? (
            <Button
              size="small"
              onClick={() => accounting.mutate({ row, confirmed: true })}
              disabled={accounting.isPending}
            >
              Xác nhận
            </Button>
          ) : (
            <Typography variant="body2" color="text.disabled">
              Chưa
            </Typography>
          ),
      },
      { key: 'companyAllocation', header: 'Phân bổ Cty', width: 120, ellipsis: true, render: (row) => row.companyAllocation ?? '' },
      { key: 'note', header: 'Ghi chú', width: 160, ellipsis: true, render: (row) => row.note ?? '' },
      ...(canWrite
        ? [
            {
              key: 'actions',
              header: '',
              width: 90,
              card: 'actions' as const,
              render: (row: ToolAsset) => (
                <RowActions
                  onEdit={() => {
                    setEditing(row)
                    setDialogOpen(true)
                  }}
                  onDelete={row.locked ? undefined : () => void askRemove(row)}
                />
              ),
            },
          ]
        : []),
    ]
  }, [canWrite, canAccount, audit, accounting, remove])

  const sum = (pick: (row: ToolAsset) => number) => rows.reduce((total, row) => total + pick(row), 0)
  const filtering = Boolean(params.search || params.group || params.department || params.status || params.label)

  return (
    <Stack spacing={1} sx={{ flex: { md: 1 }, minHeight: { md: 0 } }}>
      <PanelSummaryCard
        title={filtering ? 'Sổ tài sản (theo bộ lọc)' : 'Sổ tài sản'}
        stats={[
          { label: 'Số mã tài sản', value: String(rows.length), tone: 'neutral' },
          { label: 'Tổng thành tiền', value: formatMoney(String(sum((row) => Number(row.purchaseAmount)))), tone: 'stock' },
          { label: 'Đang sử dụng', value: String(rows.filter((row) => row.status === 'IN_USE').length), tone: 'in' },
          { label: 'Chưa sử dụng', value: String(rows.filter((row) => row.status === 'UNUSED').length), tone: 'open' },
          { label: 'Chưa dán mã', value: String(rows.filter((row) => !row.labelStuck).length), tone: 'out' },
        ]}
      />
      <DataTable
        columns={columns}
        rows={pageRows}
        rowKey={(row) => row.id}
        loading={assets.isLoading}
        errorText={assets.error instanceof Error ? assets.error.message : undefined}
        emptyText={filtering ? 'Không có tài sản khớp bộ lọc.' : 'Chưa có tài sản. Bấm Thêm tài sản để nhập.'}
        variant="grid"
        minWidth={2050}
        page={params.page}
        pageSize={params.pageSize}
        total={rows.length}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sx={{ flex: { md: 1 } }}
        toolbar={
          <>
            <SearchInput value={params.search} onChange={table.setSearch} placeholder="Tìm mã, tên, người giữ…" />
            <SelectInput
              size="small"
              label="Nhóm"
              value={params.group}
              onChange={(value) => table.setFilter({ group: String(value) })}
              options={(groups.data ?? []).map((group) => ({ value: group.id, label: `${group.code} — ${group.name}` }))}
              clearable
              sx={FILTER_FIELD_SX}
            />
            <SelectInput
              size="small"
              label="Phòng ban"
              value={params.department}
              onChange={(value) => table.setFilter({ department: String(value) })}
              options={TOOL_DEPARTMENTS}
              clearable
              sx={FILTER_FIELD_SX}
            />
            <SelectInput
              size="small"
              label="Trạng thái"
              value={params.status}
              onChange={(value) => table.setFilter({ status: String(value) })}
              options={STATUS_OPTIONS}
              clearable
              sx={FILTER_FIELD_SX}
            />
            <SelectInput
              size="small"
              label="Dán mã"
              value={params.label}
              onChange={(value) => table.setFilter({ label: String(value) })}
              options={[
                { value: 'yes', label: 'Đã dán' },
                { value: 'no', label: 'Chưa dán' },
              ]}
              clearable
              sx={FILTER_FIELD_SX}
            />
            {filtering ? (
              <Button size="small" onClick={table.reset}>
                Xóa lọc
              </Button>
            ) : null}
            {canWrite ? (
              <>
                <Box sx={{ flex: 1, minWidth: 8 }} />
                <Button
                  variant="contained"
                  onClick={() => {
                    setEditing(null)
                    setDialogOpen(true)
                  }}
                >
                  Thêm tài sản
                </Button>
              </>
            ) : null}
          </>
        }
      />
      {canWrite ? <ToolAssetDialog open={dialogOpen} asset={editing} onClose={() => setDialogOpen(false)} /> : null}
    </Stack>
  )
}
