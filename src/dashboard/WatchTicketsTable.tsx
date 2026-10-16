import { useState } from 'react'
import {
  Chip,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { SelectInput } from '../components/ui'
import type { OverviewTicket, ProductionOverview } from '../api/productionOrders'
import { dayLabel, fmt, OverviewCard } from './overviewShared'

type Filter = 'all' | 'overdue' | 'dueToday'

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tất cả phiếu' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'dueToday', label: 'Đến hạn hôm nay' },
]

function ticketHref(ticket: OverviewTicket) {
  return ticket.subTicketNo == null ? `/orders/${ticket.code}` : `/tickets/${ticket.code}`
}

function statusChip(ticket: OverviewTicket, today: string) {
  const work = ticket.working ? 'Đang xử lý' : 'Chờ xử lý'
  if (ticket.overdue) return { label: `Quá hạn · ${work}`, color: 'error' as const }
  if (ticket.dueDate === today) return { label: `Đến hạn · ${work}`, color: 'warning' as const }
  return { label: work, color: ticket.working ? ('success' as const) : ('default' as const) }
}

/** Phiếu đang trong xưởng, quá hạn lên đầu rồi tới hạn gần nhất. */
export function WatchTicketsTable({ data }: { data: ProductionOverview }) {
  const [filter, setFilter] = useState<Filter>('all')
  const rows = data.tickets.filter((ticket) =>
    filter === 'overdue' ? ticket.overdue : filter === 'dueToday' ? ticket.dueDate === data.today : true,
  )
  const stageLabel = new Map(data.stages.map((stage) => [stage.key, stage.label]))

  return (
    <OverviewCard
      title="Phiếu cần theo dõi"
      subtitle="Tất cả công đoạn · Ưu tiên quá hạn · Hạn theo hạn giao đơn"
      action={
        <SelectInput
          size="small"
          label="Hiển thị"
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(value) => setFilter(value || 'all')}
          sx={{ minWidth: 180 }}
        />
      }
    >
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          {filter === 'all' ? 'Không có phiếu nào đang trong xưởng.' : 'Không có phiếu nào.'}
        </Typography>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table
            size="small"
            sx={{
              minWidth: 860,
              '& td, & th': { px: 1, py: 0.75, fontSize: '0.84rem', borderColor: '#e9e0d4' },
              '& th': { fontWeight: 700, bgcolor: '#f8f3eb', whiteSpace: 'nowrap' },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Phiếu / đơn gốc</TableCell>
                <TableCell>Sản phẩm</TableCell>
                <TableCell>Công đoạn</TableCell>
                <TableCell align="right">Số lượng</TableCell>
                <TableCell>Phụ trách</TableCell>
                <TableCell>Hạn giao</TableCell>
                <TableCell>Tình trạng</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((ticket) => {
                const chip = statusChip(ticket, data.today)
                return (
                  <TableRow key={`${ticket.orderId}-${ticket.subTicketNo ?? 0}`} hover>
                    <TableCell>
                      <Link component={RouterLink} to={ticketHref(ticket)} sx={{ fontWeight: 700 }}>
                        {ticket.code}
                      </Link>
                      {ticket.orderCode ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Đơn {ticket.orderCode}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 260 }}>{ticket.productName}</TableCell>
                    <TableCell>{stageLabel.get(ticket.stage) ?? ticket.stage}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(ticket.qty)} sp
                    </TableCell>
                    <TableCell>{ticket.assignee ?? '—'}</TableCell>
                    <TableCell sx={{ color: ticket.overdue ? 'error.main' : undefined, whiteSpace: 'nowrap' }}>
                      {ticket.dueDate ? dayLabel(ticket.dueDate) : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" color={chip.color} label={chip.label} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </OverviewCard>
  )
}
