import { useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Link,
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
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import { formatMoney, formatQty, formatStockedDate } from '../api/inventory'
import { getOrderCostingApi } from '../api/productionOrders'
import { StatRowSkeleton, SummaryStat, TableRowsSkeleton } from '../components/ui'

const NUM = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as const

/**
 * Chi phí sản xuất của đơn: NVL xuất gắn đơn − bạc/BTP thu hồi.
 * Hao hụt bạc chỉ hiển thị để theo dõi — đã nằm trong bạc xuất.
 */
export function OrderCostingCard({ code }: { code: string }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 0)
    return () => window.clearTimeout(id)
  }, [code])

  const costing = useQuery({
    queryKey: ['production-order-costing', code],
    queryFn: () => getOrderCostingApi(code),
    staleTime: 60_000,
    enabled: ready,
  })

  const data = costing.data

  return (
    <Paper sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.25, gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Chi phí sản xuất
        </Typography>
      </Stack>

      {costing.error instanceof Error ? <Alert severity="error">{costing.error.message}</Alert> : null}
      {!data ? (
        costing.error ? null : (
          <Stack spacing={1.5}>
            <StatRowSkeleton />
            <TableRowsSkeleton rows={3} columns={5} />
            <TableRowsSkeleton rows={2} columns={5} />
          </Stack>
        )
      ) : (
        <Stack spacing={1.5}>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
            <SummaryStat label="NVL xuất cho đơn" value={formatMoney(data.materialTotal)} tone="out" />
            <SummaryStat label="Tổng chi phí" value={formatMoney(data.total)} tone="stock" />
            <SummaryStat label={`Giá vốn / sản phẩm (SL ${data.qty})`} value={formatMoney(data.unitCost)} tone="stock" />
          </Box>

          {data.warnings.map((warning) => (
            <Alert key={warning} severity="warning" sx={{ py: 0 }}>
              {warning}
            </Alert>
          ))}

          <Block title="NVL xuất cho đơn">
            {data.materials.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có phiếu xuất NVL gắn đơn này. Gắn ở{' '}
                <Link component={RouterLink} to="/warehouses/nvl-chinh/outbound">
                  Kho → Xuất
                </Link>{' '}
                bằng ô "Mã đơn SX".
              </Typography>
            ) : (
              <SimpleTable
                head={['Ngày', 'Kho', 'NVL', 'SL', 'Đơn giá', 'Thành tiền']}
                numericFrom={3}
                rows={data.materials.map((item) => [
                  formatStockedDate(item.issuedAt),
                  item.warehouseName,
                  `${item.name}${item.isSilver ? ' (bạc)' : ''}`,
                  `${formatQty(item.qty)} ${item.unit}`,
                  formatMoney(item.unitPrice),
                  formatMoney(item.amount),
                ])}
                footer={['Cộng NVL', formatMoney(data.materialTotal)]}
              />
            )}
          </Block>

          <Block title="Bạc">
            <Stack spacing={0.5}>
              <Line
                label={`Bạc xuất: ${formatQty(data.silver.grams)} g`}
                value={
                  data.silver.unitPrice ? `giá bình quân ${formatMoney(data.silver.unitPrice)} đ/g` : 'chưa có giá bạc'
                }
              />
              <Line
                label={`Trừ bạc + BTP thu hồi: ${formatQty(data.recovered.grams)} g`}
                value={Number(data.recovered.amount) > 0 ? `− ${formatMoney(data.recovered.amount)}` : '0'}
                strong
              />
              <Line
                label={`Hao hụt bạc (theo dõi, đã nằm trong bạc xuất): ${formatQty(data.silverLoss.grams)} g`}
                value={data.silverLoss.amount != null ? `≈ ${formatMoney(data.silverLoss.amount)}` : '—'}
                muted
              />
            </Stack>
          </Block>

          <Box sx={{ p: 1.25, bgcolor: '#f8f3eb', borderRadius: 1 }}>
            <Typography variant="body2">
              Tổng chi phí = NVL {formatMoney(data.materialTotal)} − thu hồi {formatMoney(data.recovered.amount)} ={' '}
              <b>{formatMoney(data.total)}</b>
            </Typography>
          </Box>
        </Stack>
      )}

    </Paper>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="body2" color={muted ? 'text.secondary' : 'text.primary'}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        color={muted ? 'text.secondary' : 'text.primary'}
        sx={{ fontWeight: strong ? 700 : 400, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Stack>
  )
}

function SimpleTable({
  head,
  rows,
  footer,
  numericFrom,
}: {
  head: string[]
  rows: string[][]
  footer: [string, string]
  numericFrom: number
}) {
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ '& td, & th': { px: 1 } }}>
        <TableHead>
          <TableRow>
            {head.map((label, index) => (
              <TableCell key={label} sx={index >= numericFrom ? NUM : undefined}>
                {label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((cells, rowIndex) => (
            <TableRow key={rowIndex}>
              {cells.map((cell, index) => (
                <TableCell key={index} sx={index >= numericFrom ? NUM : undefined}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={head.length - 1} sx={{ fontWeight: 700 }}>
              {footer[0]}
            </TableCell>
            <TableCell sx={{ ...NUM, fontWeight: 700 }}>{footer[1]}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  )
}
