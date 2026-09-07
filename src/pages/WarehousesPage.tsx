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
import { WAREHOUSES, WAREHOUSE_SECTIONS, warehousePath } from '../warehouses/catalog'

export function WarehousesPage() {
  return (
    <Stack spacing={2}>
      <Stack>
        <Typography variant="h5">Kho</Typography>
        <Typography variant="body2" color="text.secondary">
          Kho NVL chính (tồn / nhập / xuất), sổ Kho BTP chờ vào đá, và Kho NVL tiêu hao.
        </Typography>
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kho</TableCell>
              <TableCell>Mô tả</TableCell>
              <TableCell>Mục</TableCell>
              <TableCell width={120} />
            </TableRow>
          </TableHead>
          <TableBody>
            {WAREHOUSES.map((w) => (
              <TableRow key={w.code} hover>
                <TableCell sx={{ fontWeight: 600 }}>{w.name}</TableCell>
                <TableCell>{w.description}</TableCell>
                <TableCell>
                  {w.sections ? (
                    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      {WAREHOUSE_SECTIONS.map((s) => (
                        <Chip
                          key={s.code}
                          size="small"
                          variant="outlined"
                          label={s.name}
                          component={RouterLink}
                          to={warehousePath(w, s.code)}
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
