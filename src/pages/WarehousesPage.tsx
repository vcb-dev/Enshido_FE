import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Button, Chip, Stack } from '@mui/material'
import { DataTable, PageHeader, type Column } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { visibleWarehouses } from '../auth/screens'
import {
  WAREHOUSE_SECTIONS,
  warehousePath,
  type WarehouseDef,
} from '../warehouses/catalog'

export function WarehousesPage() {
  const { user } = useAuth()
  const rows = visibleWarehouses(user)
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
      <PageHeader
        title="Kho"
        subtitle="Kho NVL chính, Kho BTP, Kho NVL tiêu hao và Kho thành phẩm (tồn / nhập / xuất)."
      />

      <DataTable
        columns={columns}
        rows={rows}
        emptyText="Không có kho nào được phép xem."
        rowKey={(warehouse) => warehouse.code}
        stickyHeader={false}
      />
    </Stack>
  )
}
