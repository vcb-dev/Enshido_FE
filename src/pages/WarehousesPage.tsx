import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Button, Chip, Stack, Typography } from '@mui/material'
import { DataTable, type Column } from '../components/ui'
import {
  WAREHOUSES,
  WAREHOUSE_SECTIONS,
  warehousePath,
  type WarehouseDef,
} from '../warehouses/catalog'

export function WarehousesPage() {
  // Danh sách kho là hằng số trong mã nguồn nên không cần lọc / phân trang.
  const columns: Column<WarehouseDef>[] = useMemo(
    () => [
      { key: 'name', header: 'Kho', cellSx: { fontWeight: 600 } },
      { key: 'description', header: 'Mô tả' },
      {
        key: 'sections',
        header: 'Mục',
        render: (warehouse) =>
          warehouse.sections ? (
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {WAREHOUSE_SECTIONS.map((section) => (
                <Chip
                  key={section.code}
                  size="small"
                  variant="outlined"
                  label={section.name}
                  component={RouterLink}
                  to={warehousePath(warehouse, section.code)}
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
          Kho NVL chính (tồn / nhập / xuất), sổ Kho BTP chờ vào đá, và Kho NVL tiêu hao.
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
