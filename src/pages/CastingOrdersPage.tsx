import { useMemo } from 'react'
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  listCastingSlipsApi,
  type CastingSlip,
} from '../api/castingSlips'
import { formatQty } from '../api/inventory'
import {
  ColumnHeaderDate,
  ColumnHeaderSearch,
  DataTable,
  PageHeader,
  RowActions,
  type Column,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { useTableParams } from '../hooks/useTableParams'
import { IntakeImageThumbs } from '../intake/IntakeImageThumbs'

const cellLeft = { textAlign: 'left', paddingLeft: '10px' } as const

const SLIP_FILTERS = {
  slipDate: '',
  intakeCode: '',
  batchOrderCodes: '',
  waxWeight: '',
  issueTotal: '',
}

function formatGram(value: string | null) {
  if (value == null || value === '') return '—'
  return formatQty(value)
}

export function CastingOrdersPage() {
  const dialog = useCrudDialog<CastingSlip>()
  const table = useTableParams({ pageSize: 25, filters: SLIP_FILTERS })
  const { params } = table

  const list = useQuery({
    queryKey: [
      'casting-slips',
      params.page,
      params.pageSize,
      params.slipDate,
      params.intakeCode,
      params.batchOrderCodes,
      params.waxWeight,
      params.issueTotal,
    ],
    queryFn: () =>
      listCastingSlipsApi({
        slipDate: params.slipDate,
        intakeCode: params.intakeCode,
        batchOrderCodes: params.batchOrderCodes,
        waxWeight: params.waxWeight,
        issueTotal: params.issueTotal,
        page: params.page,
        pageSize: params.pageSize,
      }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })

  const columns = useMemo<Column<CastingSlip>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã phiếu',
        width: 100,
        align: 'left',
        headSx: cellLeft,
        cellSx: { ...cellLeft, fontWeight: 700 },
      },
      {
        key: 'slipDate',
        header: 'Ngày',
        width: 110,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        filter: (
          <ColumnHeaderDate
            value={params.slipDate}
            onChange={(slipDate) => table.setFilter({ slipDate })}
          />
        ),
      },
      {
        key: 'intakeCode',
        header: 'Đơn tạo',
        width: 100,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        filter: (
          <ColumnHeaderSearch
            value={params.intakeCode}
            onChange={(intakeCode) => table.setFilter({ intakeCode })}
            placeholder="Đơn tạo…"
          />
        ),
      },
      {
        key: 'batchOrderCodes',
        header: 'Mã đơn lô đúc',
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        filter: (
          <ColumnHeaderSearch
            value={params.batchOrderCodes}
            onChange={(batchOrderCodes) => table.setFilter({ batchOrderCodes })}
            placeholder="Mã lô…"
          />
        ),
      },
      {
        key: 'waxWeightGram',
        header: 'Sáp (g)',
        width: 90,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => formatGram(row.waxWeightGram),
        filter: (
          <ColumnHeaderSearch
            value={params.waxWeight}
            onChange={(waxWeight) => table.setFilter({ waxWeight })}
            placeholder="Sáp…"
          />
        ),
      },
      {
        key: 'issueTotalGram',
        header: 'Tổng giao (g)',
        width: 110,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => formatGram(row.issueTotalGram),
        filter: (
          <ColumnHeaderSearch
            value={params.issueTotal}
            onChange={(issueTotal) => table.setFilter({ issueTotal })}
            placeholder="Tổng giao…"
          />
        ),
      },
      {
        key: 'actions',
        header: 'Hành động',
        width: 100,
        align: 'center',
        render: (row) => (
          <RowActions titles={{ view: 'Xem phiếu đúc' }} onView={() => dialog.openView(row)} />
        ),
      },
    ],
    [
      dialog.openView,
      params.batchOrderCodes,
      params.intakeCode,
      params.issueTotal,
      params.slipDate,
      params.waxWeight,
      table.setFilter,
    ],
  )

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: { md: 1 }, minHeight: { md: 0 }, height: { md: '100%' }, overflow: { xs: 'visible', md: 'hidden' } }}
    >
      <PageHeader
        title="Lệnh đúc"
        subtitle="Phiếu đúc lên từ Lệnh sản xuất (Lên lệnh đúc)."
        compactSubtitle
      />
      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={list.isLoading && !list.data}
        errorText={list.error instanceof Error ? list.error.message : undefined}
        emptyText={table.hasFilters ? 'Không có phiếu đúc khớp bộ lọc.' : 'Chưa có phiếu đúc.'}
        variant="grid"
        fixedLayout
        minWidth={720}
        page={params.page}
        pageSize={params.pageSize}
        total={list.data?.total ?? 0}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        rowsLabel="phiếu"
        sx={{ flex: { md: 1 } }}
      />
      <CastingSlipViewDialog
        open={dialog.open && dialog.kind === 'view'}
        slip={dialog.row}
        onClose={dialog.close}
      />
    </Stack>
  )
}

function CastingSlipViewDialog({
  open,
  slip,
  onClose,
}: {
  open: boolean
  slip: CastingSlip | null
  onClose: () => void
}) {
  const thumbs = useMemo(
    () =>
      (slip?.images ?? []).map((image, index) => ({
        kind: 'PRODUCT' as const,
        url: image.url,
        publicId: image.publicId,
        width: image.width,
        height: image.height,
        sortOrder: index,
      })),
    [slip?.images],
  )

  const disabledCell = { bgcolor: 'action.hover', color: 'text.disabled' } as const

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', fontWeight: 800 }}>
        PHIẾU ĐÚC — {slip?.code ?? ''}
      </DialogTitle>
      <DialogContent>
        {slip ? (
          <Stack spacing={2}>
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}
            >
              <Typography variant="body2">
                <strong>Ngày:</strong> {slip.slipDate}
              </Typography>
              <Typography variant="body2">
                <strong>Đơn tạo:</strong> {slip.intakeCode}
                {slip.intakeProductName ? ` · ${slip.intakeProductName}` : null}
              </Typography>
            </Stack>
            <Typography variant="body2">
              <strong>Mã đơn lô đúc:</strong> {slip.batchOrderCodes}
            </Typography>
            <Typography variant="body2">
              <strong>Trọng lượng sáp (cây thông) gia:</strong> {formatGram(slip.waxWeightGram)} g
            </Typography>
            <Table
              size="small"
              sx={{
                border: '2px solid',
                borderColor: 'grey.600',
                borderCollapse: 'collapse',
                '& .MuiTableCell-root': {
                  border: '1px solid',
                  borderColor: 'grey.500',
                  py: 1.25,
                  px: 1.5,
                },
                '& .MuiTableHead-root .MuiTableCell-root': {
                  bgcolor: 'grey.200',
                  fontWeight: 700,
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    Giao
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    Trả
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>S999 (g)</TableCell>
                  <TableCell>{formatGram(slip.issueS999Gram)}</TableCell>
                  <TableCell align="center" sx={disabledCell}>
                    —
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Hội (g)</TableCell>
                  <TableCell>{formatGram(slip.issueMasterAlloyGram)}</TableCell>
                  <TableCell align="center" sx={disabledCell}>
                    —
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>S925 (g)</TableCell>
                  <TableCell>{formatGram(slip.issueS925Gram)}</TableCell>
                  <TableCell align="center" sx={disabledCell}>
                    —
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Tổng</TableCell>
                  <TableCell>{formatGram(slip.issueTotalGram)}</TableCell>
                  <TableCell align="center" sx={disabledCell}>
                    —
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {thumbs.length ? (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }} gutterBottom>
                  Ảnh
                </Typography>
                <IntakeImageThumbs label="Ảnh phiếu đúc" images={thumbs} />
              </Box>
            ) : null}
          </Stack>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
