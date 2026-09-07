import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Button, Chip, Stack, Typography } from '@mui/material'
import { DataTable, type Column } from '../components/ui'
import { WAREHOUSES, warehousePath, type WarehouseDef } from '../warehouses/catalog'

export function WarehousesPage() {
  // Danh sách kho là hằng số trong mã nguồn (2 kho) nên không cần lọc / phân trang.
  const columns: Column<WarehouseDef>[] = useMemo(
    () => [
      { key: 'name', header: 'Kho', cellSx: { fontWeight: 600 } },
      { key: 'description', header: 'Mô tả' },
      {
        key: 'bins',
        header: 'Kho con',
        render: (warehouse) =>
          warehouse.bins?.length ? (
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {warehouse.bins.map((bin) => (
                <Chip
                  key={bin.code}
                  size="small"
                  variant="outlined"
                  label={bin.name}
                  component={RouterLink}
                  to={warehousePath(warehouse, bin.code)}
                  clickable
                />
              ))}
            </Stack>
          ) : (
            '—'
          ),
      },
      {
        key: 'actions',
        header: '',
        width: 120,
        render: (warehouse) => (
          <Button component={RouterLink} to={warehousePath(warehouse)} size="small">
            Mở kho
          </Button>
        ),
      },
    ],
    [],
  )

  return (
    <Stack spacing={2}>
      <Stack>
        <Typography variant="h5">Kho</Typography>
        <Typography variant="body2" color="text.secondary">
          2 kho: Kho NVL chính (bạc gồm tồn / nhập / xuất / BTP chờ vào đá; đá gồm tồn / nhập /
          xuất) và Kho NVL tiêu hao. Đơn giá tồn cấu hình ở mục Cấu hình giá sản phẩm.
        </Typography>
      </Stack>

      <DataTable
        columns={columns}
        rows={WAREHOUSES}
        rowKey={(warehouse) => warehouse.code}
        stickyHeader={false}
      />
    </Stack>
  )
}
