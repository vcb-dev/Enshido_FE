import { Link as RouterLink } from 'react-router-dom'
import {
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { WAREHOUSES, warehousePath } from '../warehouses/catalog'

export function WarehousesPage() {
  return (
    <Stack spacing={2}>
      <Stack>
        <Typography variant="h5">Kho</Typography>
        <Typography variant="body2" color="text.secondary">
          2 kho: Kho NVL chính (bạc gồm tồn / nhập / xuất / BTP chờ vào đá; đá gồm tồn / nhập / xuất) và Kho NVL tiêu hao. Đơn giá tồn cấu hình ở mục Cấu hình giá sản phẩm.
        </Typography>
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kho</TableCell>
              <TableCell>Mô tả</TableCell>
              <TableCell>Kho con</TableCell>
              <TableCell width={120} />
            </TableRow>
          </TableHead>
          <TableBody>
            {WAREHOUSES.map((w) => (
              <TableRow key={w.code} hover>
                <TableCell sx={{ fontWeight: 600 }}>{w.name}</TableCell>
                <TableCell>{w.description}</TableCell>
                <TableCell>
                  {w.bins?.length ? (
                    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      {w.bins.map((b) => (
                        <Chip
                          key={b.code}
                          size="small"
                          variant="outlined"
                          label={b.name}
                          component={RouterLink}
                          to={warehousePath(w, b.code)}
                          clickable
                        />
                      ))}
                    </Stack>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  <Button component={RouterLink} to={warehousePath(w)} size="small">
                    Mở kho
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}
