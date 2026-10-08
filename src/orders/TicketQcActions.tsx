import { useState } from 'react'
import { Button, Stack } from '@mui/material'
import { ReworkChildren } from './ReworkChildren'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { can, Permission } from '../auth/permissions'
import { confirmStageApi, createReworkApi, type ProductionOrderDetail, type StageEntry } from '../api/productionOrders'
import { isReceiptStage, STAGE_LABEL } from './catalog'
import { invalidateBtpStock } from './btpStock'
import { invalidateNvlStock } from './nvlStock'
import { KeeperConfirmDialog } from './KeeperConfirmDialog'
import { scheduleMyTicketsRefresh } from './myTicketsRefresh'
import { useOrderMutation } from './useOrderMutation'

/** Xác nhận kho và tạo phiếu bù cho đúng phiếu mẹ / con đang xem. */
export function TicketQcActions({ order, ticketNo = null, busy = false }: {
  order: ProductionOrderDetail
  ticketNo?: number | null
  busy?: boolean
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = user?.roleCode === 'ADMIN' || Boolean(user?.extraRoles?.includes('ADMIN'))
  const canKeeper = isAdmin || can(user, Permission.WAREHOUSE_KEEPER)
  const [target, setTarget] = useState<StageEntry | null>(null)
  const allReworks = order.reworks ?? []
  const entries = order.stages.filter((entry) => entry.subTicketNo === ticketNo)
  const pending = entries.find((entry) => isReceiptStage(entry.stage) && entry.returnedAt && !entry.confirmedAt)
  const reworks = allReworks.filter((item) => item.ticketNo === ticketNo)
  const reworkable = entries.filter((entry) =>
    isReceiptStage(entry.stage) && entry.confirmedAt && (entry.defectQty ?? 0) > 0 &&
    !allReworks.some((item) => item.entryId === entry.id),
  )
  const active = order.status !== 'DELIVERED' && !order.finishedGoods
  const confirm = useOrderMutation(
    order.code,
    (entry: StageEntry) => confirmStageApi(order.code, entry.id),
    'Đã xác nhận — hàng đạt nhập kho BTP, hàng lỗi và nguyên liệu thừa nhập kho NVL',
  )
  const rework = useOrderMutation(
    order.code,
    (entry: StageEntry) => createReworkApi(order.code, entry.id),
    'Đã tạo phiếu bù — đi lại từ bước sáp',
  )
  const refreshStock = () => {
    invalidateBtpStock(queryClient)
    invalidateNvlStock(queryClient)
    scheduleMyTicketsRefresh(queryClient)
  }
  const ticketCode = ticketNo == null ? order.code : order.subTickets.find((ticket) => ticket.no === ticketNo)?.code ?? order.code

  return (
    <Stack spacing={1}>
      <ReworkChildren reworks={reworks} ticketCode={ticketCode} />
      {canKeeper && active ? (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {pending ? (
            <Button variant="contained" disabled={busy || confirm.isPending} onClick={() => setTarget(pending)}>
              {(pending.defectQty ?? 0) > 0 ? 'Thủ kho xác nhận lỗi' : 'Thủ kho xác nhận'}
            </Button>
          ) : null}
          {reworkable.map((entry) => (
            <Button key={entry.id} variant="contained" color="warning" disabled={busy || rework.isPending}
              onClick={() => rework.mutate(entry, { onSuccess: refreshStock })}>
              Tạo phiếu bù · {entry.defectQty} sp lỗi {STAGE_LABEL[entry.stage]}
            </Button>
          ))}
        </Stack>
      ) : null}
      <KeeperConfirmDialog entry={target} ticketCode={ticketCode} saving={confirm.isPending}
        onClose={() => setTarget(null)}
        onConfirm={(entry) => confirm.mutate(entry, {
          onSuccess: () => {
            setTarget(null)
            refreshStock()
          },
        })} />
    </Stack>
  )
}
