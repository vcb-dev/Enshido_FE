import { Fragment, type ReactNode } from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { ProductionOrderDetail, SubTicket } from '../api/productionOrders'
import { useIsMobile } from '../hooks/useBreakpoint'
import { SILVER_LOSS_TONE, STAGE_LABEL, STAGES } from './catalog'
import {
  outcomeLines,
  stageColumns,
  TICKET_HEADER_BG,
  TICKET_OUTCOME_LABEL,
  TICKET_OUTCOMES,
  TICKET_ROWS,
  TICKET_TONE_BG,
  type TicketOutcome,
} from './ticketRows'

const CELL_BORDER = '1px solid #cbbda9'

/** Nền hai cột kết cục: lỗi đỏ nhạt, hoàn thiện xanh nhạt — nhìn phát biết phiếu kết ở nhánh nào. */
const TICKET_OUTCOME_BG: Record<TicketOutcome, string> = {
  DEFECT: '#fdecea',
  FINISH: '#e9f7ef',
}

/**
 * Bảng "Quá trình sản xuất" giống hệt phiếu in: Nguội → Xi rồi kết ở cột Lỗi hoặc Hoàn thiện.
 * Có `subTicket` thì bảng là của riêng phiếu con đó; không thì là phiếu mẹ, cột khâu cộng từ
 * các phiếu con. Thao tác chỉ có ở phiếu con — phiếu mẹ chỉ để xem.
 */
export function TicketMatrix({
  order,
  subTicket,
  outcomeActions,
}: {
  order: ProductionOrderDetail
  subTicket?: SubTicket
  /** Nút đặt dưới hai cột kết cục. Bỏ trống thì bảng không có hàng Thao tác. */
  outcomeActions?: Partial<Record<TicketOutcome, ReactNode>>
}) {
  const columns = stageColumns(order.stages, subTicket?.id)
  const actions = outcomeActions
    ? TICKET_OUTCOMES.map((outcome) => outcomeActions[outcome]).filter(Boolean)
    : []
  // Bảng rộng 1280px không đọc nổi trên điện thoại của thợ — đổ dọc theo khâu.
  const mobile = useIsMobile()

  if (mobile) {
    return (
      <StageCards
        order={order}
        subTicket={subTicket}
        columns={columns}
        outcomeActions={outcomeActions}
      />
    )
  }

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table
        size="small"
        sx={{
          minWidth: 1280,
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          '& td, & th': { border: CELL_BORDER, px: 1, py: 0.6, fontSize: '0.84rem' },
        }}
      >
        <TableHead>
          <TableRow sx={{ '& th': { bgcolor: TICKET_HEADER_BG, fontWeight: 700, textAlign: 'center' } }}>
            <TableCell sx={{ width: 220, color: '#6b4513' }}>Quá trình sản xuất</TableCell>
            {STAGES.map((stage) => {
              const column = columns[stage]
              return (
                <TableCell key={stage}>
                  {STAGE_LABEL[stage]}
                  {column.entry && column.entry.attempt > 1 ? ` (lần ${column.entry.attempt})` : ''}
                  {column.tickets ? (
                    <Typography component="span" variant="caption" sx={{ display: 'block', fontWeight: 400 }}>
                      KCS nhận {column.tickets.done}/{column.tickets.total} phiếu
                    </Typography>
                  ) : null}
                </TableCell>
              )
            })}
            {TICKET_OUTCOMES.map((outcome) => (
              <TableCell key={outcome}>{TICKET_OUTCOME_LABEL[outcome]}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {TICKET_ROWS.map((row, index) => (
            <TableRow key={row.key} sx={row.tone ? { bgcolor: TICKET_TONE_BG[row.tone] } : undefined}>
              <TableCell sx={{ fontWeight: row.tone ? 700 : 400, verticalAlign: 'top' }}>
                {row.label}
                {row.hint ? (
                  <Typography component="span" variant="caption" sx={{ fontStyle: 'italic', display: 'block' }}>
                    {row.hint}
                  </Typography>
                ) : null}
              </TableCell>
              {STAGES.map((stage) => {
                const entry = columns[stage].entry
                const level = entry && row.warnLevel ? row.warnLevel(entry) : null
                return (
                  <TableCell
                    key={stage}
                    sx={{
                      textAlign: row.numeric ? 'right' : 'left',
                      ...(level
                        ? {
                            bgcolor: SILVER_LOSS_TONE[level].bg,
                            color: SILVER_LOSS_TONE[level].fg,
                            fontWeight: 700,
                          }
                        : null),
                    }}
                  >
                    {entry ? row.value(entry) : ''}
                  </TableCell>
                )
              })}
              {index === 0
                ? TICKET_OUTCOMES.map((outcome) => (
                    <TableCell
                      key={outcome}
                      rowSpan={TICKET_ROWS.length}
                      sx={{
                        verticalAlign: 'top',
                        bgcolor: TICKET_OUTCOME_BG[outcome],
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {outcomeLines(order, outcome, subTicket).join('\n')}
                    </TableCell>
                  ))
                : null}
            </TableRow>
          ))}
          {actions.length ? (
            <TableRow sx={{ '& td': { bgcolor: '#f8f3eb', textAlign: 'center' } }}>
              <TableCell sx={{ textAlign: 'left !important', color: 'text.secondary' }}>Thao tác</TableCell>
              <TableCell colSpan={STAGES.length} />
              {TICKET_OUTCOMES.map((outcome) => (
                <TableCell key={outcome}>
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {outcomeActions?.[outcome]}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/** Bản cho điện thoại: mỗi khâu một thẻ, chỉ hiện dòng có số liệu. */
function StageCards({
  order,
  subTicket,
  columns,
  outcomeActions,
}: {
  order: ProductionOrderDetail
  subTicket?: SubTicket
  columns: ReturnType<typeof stageColumns>
  outcomeActions?: Partial<Record<TicketOutcome, ReactNode>>
}) {
  const done = STAGES.filter((stage) => columns[stage].entry)

  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {done.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa giao khâu nào.
        </Typography>
      ) : null}

      {done.map((stage) => {
        const column = columns[stage]
        const entry = column.entry!
        const rows = TICKET_ROWS.map((row) => ({ row, value: row.value(entry) })).filter(
          (item) => item.value !== '',
        )
        return (
          <Box
            key={stage}
            sx={{ border: CELL_BORDER, borderRadius: 1, overflow: 'hidden' }}
          >
            <Box sx={{ bgcolor: TICKET_HEADER_BG, px: 1, py: 0.6, fontWeight: 700, fontSize: '0.86rem' }}>
              {STAGE_LABEL[stage]}
              {entry.attempt > 1 ? ` (lần ${entry.attempt})` : ''}
              {column.tickets ? ` · KCS nhận ${column.tickets.done}/${column.tickets.total} phiếu` : ''}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 0.25, px: 1, py: 0.75 }}>
              {rows.map(({ row, value }) => {
                const level = row.warnLevel ? row.warnLevel(entry) : null
                return (
                  <Fragment key={row.key}>
                    <Typography variant="body2" color="text.secondary">
                      {row.label}
                      {row.hint ? ` ${row.hint}` : ''}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        textAlign: 'right',
                        fontWeight: row.tone || level ? 700 : 400,
                        ...(level
                          ? {
                              px: 0.5,
                              borderRadius: 0.5,
                              bgcolor: SILVER_LOSS_TONE[level].bg,
                              color: SILVER_LOSS_TONE[level].fg,
                            }
                          : null),
                      }}
                    >
                      {value}
                    </Typography>
                  </Fragment>
                )
              })}
            </Box>
          </Box>
        )
      })}

      {TICKET_OUTCOMES.map((outcome) => {
        const lines = outcomeLines(order, outcome, subTicket)
        const action = outcomeActions?.[outcome]
        if (lines.length === 0 && !action) return null
        return (
          <Box
            key={outcome}
            sx={{
              border: CELL_BORDER,
              borderRadius: 1,
              bgcolor: TICKET_OUTCOME_BG[outcome],
              px: 1,
              py: 0.75,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {TICKET_OUTCOME_LABEL[outcome]}
            </Typography>
            {lines.length ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {lines.join('\n')}
              </Typography>
            ) : null}
            {action ? <Box sx={{ mt: 0.75 }}>{action}</Box> : null}
          </Box>
        )
      })}
    </Box>
  )
}
