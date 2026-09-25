import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useQuery } from '@tanstack/react-query'
import {
  listOrderActivityApi,
  type ProductionOrderDetail,
  type StageCode,
  type SubTicket,
} from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { ACTION_LABEL, describeChanges } from './activityFormat'
import { STAGE_LABEL, formatDateTime } from './catalog'

/**
 * Các thao tác đã dựng được từ dữ liệu khâu / phiếu con nên bỏ bản trong nhật ký cho khỏi
 * lặp dòng. Nhật ký chỉ bù phần dữ liệu khâu không giữ: mở / huỷ khâu, nhận / bỏ nhận, sửa, gỡ.
 */
const DERIVED_ACTIONS = new Set([
  'STAGE_HANDOVER',
  'STAGE_SUBMIT',
  'STAGE_RETURN',
  'TICKET_TOP_UP',
  'MATERIAL_REQUEST',
  'MATERIAL_ISSUE',
  'MATERIAL_REJECT',
  'MATERIAL_CANCEL',
  'TICKET_OUTCOME',
])

type HistoryEvent = {
  key: string
  at: string
  stage: StageCode | null
  action: string
  actor: string
  details: string[]
}

const g = (value: string | null | undefined) => (value != null ? `${formatQty(value)} g` : '—')

/**
 * Lịch sử thao tác của phiếu mẹ / cả đơn (`ticket` null) hoặc một phiếu con, thả xuống khi
 * bấm. Gồm mọi khâu đã qua (giao, báo xong, KCS nhận lại, xin / xuất NVL, kết cục — dựng từ dữ liệu
 * khâu nên đơn cũ cũng có) và các thao tác chỉ nằm trong nhật ký (chỉ có từ khi bật nhật ký).
 */
export function WorkHistory({
  order,
  ticket,
}: {
  order: ProductionOrderDetail
  ticket: SubTicket | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <Box>
      <Button
        size="small"
        color="inherit"
        onClick={() => setOpen((v) => !v)}
        endIcon={
          <ExpandMoreIcon
            sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          />
        }
      >
        Lịch sử thao tác
      </Button>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <WorkHistoryTable order={order} ticket={ticket} />
      </Collapse>
    </Box>
  )
}

/** Bảng lịch sử (không kèm nút thả) — dùng khi nơi gọi tự lo đóng / mở, vd dòng phiếu con. */
export function WorkHistoryTable({
  order,
  ticket,
}: {
  order: ProductionOrderDetail
  ticket: SubTicket | null
}) {
  const activity = useQuery({
    queryKey: ['production-order-activity', order.code],
    queryFn: () => listOrderActivityApi(order.code),
    staleTime: 0,
  })

  const events = useMemo(() => {
    const list: HistoryEvent[] = []
    const subTicketId = ticket?.id ?? null
    for (const entry of order.stages.filter((item) => item.subTicketId === subTicketId)) {
      const lan = entry.attempt > 1 ? ` (lần ${entry.attempt})` : ''
      list.push({
        key: `${entry.id}-hand`,
        at: entry.handedAt,
        stage: entry.stage,
        action: `Giao khâu${lan}`,
        actor: entry.handedByName,
        details: [
          `Thợ ${entry.craftsmanName} · SL ${entry.handedQty ?? '—'} · TL ${g(entry.handedSilverWeight)}`,
          entry.handedStoneCount != null || entry.handedStoneWeight != null
            ? `Đá giao ${entry.handedStoneCount ?? '—'} viên · ${g(entry.handedStoneWeight)}`
            : '',
        ].filter(Boolean),
      })
      if (entry.submittedAt) {
        list.push({
          key: `${entry.id}-submit`,
          at: entry.submittedAt,
          stage: entry.stage,
          action: `Thợ báo làm xong${lan}`,
          actor: entry.submittedByName ?? entry.craftsmanName,
          details: [],
        })
      }
      if (entry.returnedAt) {
        const recovered = [
          entry.btpRecoveredWeight ? `BTP thu hồi ${g(entry.btpRecoveredWeight)}` : '',
          entry.silverRecoveredWeight ? `bạc thu hồi ${g(entry.silverRecoveredWeight)}` : '',
        ]
          .filter(Boolean)
          .join(' · ')
        list.push({
          key: `${entry.id}-return`,
          at: entry.returnedAt,
          stage: entry.stage,
          action: `KCS nhận lại${lan}`,
          actor: entry.returnedByName ?? '—',
          details: [
            `SL ${entry.returnedQty ?? '—'} · TL ${g(entry.returnedSilverWeight)}`,
            entry.silverLoss != null
              ? `Hao hụt ${g(entry.silverLoss)}${entry.silverLossPercent != null ? ` (${entry.silverLossPercent}%)` : ''}`
              : '',
            recovered,
            entry.laborCost ? `Tiền công ${formatQty(entry.laborCost)}` : '',
            entry.note ? `Ghi chú: ${entry.note}` : '',
          ].filter(Boolean),
        })
      }
    }
    const ticketNo = ticket?.no ?? null
    for (const request of order.materialRequests.filter((item) => item.subTicketNo === ticketNo)) {
      const material = `${request.material.sku || request.material.name} (${request.material.warehouseName})`
      if (request.atHandover) {
        list.push({
          key: `request-${request.id}`,
          at: request.requestedAt,
          stage: request.stage,
          action: 'Xuất NVL lúc giao khâu',
          actor: request.handledByName ?? request.requestedByName,
          details: [
            [
              material,
              `${formatQty(request.issuedQty ?? '0')} ${request.material.unit}`,
              request.issuedWeight ? g(request.issuedWeight) : '',
              request.issuedStoneCount ? `${request.issuedStoneCount} viên` : '',
            ]
              .filter(Boolean)
              .join(' · '),
          ],
        })
        continue
      }
      list.push({
        key: `request-${request.id}`,
        at: request.requestedAt,
        stage: request.stage,
        action: 'Thợ xin xuất NVL',
        actor: request.requestedByName,
        details: [
          `${material} · ${formatQty(request.requestedQty)} ${request.material.unit}`,
          request.note ? `Ghi chú: ${request.note}` : '',
        ].filter(Boolean),
      })
      if (request.handledAt && request.status !== 'PENDING') {
        list.push({
          key: `request-${request.id}-done`,
          at: request.handledAt,
          stage: request.stage,
          action:
            request.status === 'ISSUED'
              ? 'Xuất NVL cho thợ'
              : request.status === 'REJECTED'
                ? 'Không xuất NVL'
                : 'Thợ huỷ yêu cầu xuất',
          actor: request.handledByName ?? '—',
          details:
            request.status === 'ISSUED'
              ? [
                  [
                    material,
                    `${formatQty(request.issuedQty ?? '0')} ${request.material.unit}`,
                    request.issuedWeight ? g(request.issuedWeight) : '',
                    request.issuedStoneCount ? `${request.issuedStoneCount} viên` : '',
                  ]
                    .filter(Boolean)
                    .join(' · '),
                ]
              : request.rejectReason
                ? [`Lý do: ${request.rejectReason}`]
                : [],
        })
      }
    }
    if (ticket?.outcome && ticket.outcomeAt) {
      list.push({
        key: 'outcome',
        at: ticket.outcomeAt,
        stage: ticket.outcomeStage,
        action: ticket.outcome === 'FINISH' ? 'Chốt hoàn thiện' : 'Chốt lỗi',
        actor: ticket.outcomeByName ?? '—',
        details: [
          ticket.outcomeQty != null ? `SL ${ticket.outcomeQty}` : '',
          ticket.outcomeNote ? `Ghi chú: ${ticket.outcomeNote}` : '',
        ].filter(Boolean),
      })
    }
    for (const row of activity.data ?? []) {
      // Phiếu mẹ (`ticket` null) nhận cả thao tác cấp đơn: sửa đơn, chi phí, in phiếu, đổi
      // trạng thái, báo Đúc, chia / huỷ chia phiếu con.
      if (row.subTicketNo !== ticketNo || DERIVED_ACTIONS.has(row.action)) continue
      list.push({
        key: row.id,
        at: row.createdAt,
        stage: row.stage,
        action: ACTION_LABEL[row.action] ?? row.action,
        actor: row.actorName,
        details: [...describeChanges(row.before, row.after), row.note ? `Ghi chú: ${row.note}` : ''].filter(
          Boolean,
        ),
      })
    }
    return list.sort((a, b) => a.at.localeCompare(b.at))
  }, [order.stages, ticket, activity.data])

  if (!events.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 0.5 }}>
        Chưa có thao tác nào.
      </Typography>
    )
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table
        size="small"
        sx={{
          minWidth: 560,
          '& td, & th': { px: 0.75, py: 0.5, fontSize: '0.78rem', borderColor: '#e9e0d4', verticalAlign: 'top' },
          '& th': { fontWeight: 700, color: 'text.secondary' },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Thời gian</TableCell>
            <TableCell>Khâu</TableCell>
            <TableCell>Thao tác</TableCell>
            <TableCell>Người thực hiện</TableCell>
            <TableCell>Chi tiết</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.key}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(event.at)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{event.stage ? STAGE_LABEL[event.stage] : '—'}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{event.action}</TableCell>
              <TableCell>{event.actor}</TableCell>
              <TableCell>
                {event.details.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {activity.isError ? (
        <Typography variant="caption" color="error">
          Không tải được nhật ký thao tác — chỉ hiện các khâu đã ghi trên phiếu.
        </Typography>
      ) : null}
    </Box>
  )
}
