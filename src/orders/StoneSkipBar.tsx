import { Alert, Button } from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import { can, Permission } from '../auth/permissions'
import { skipStoneApi, type ProductionOrderDetail } from '../api/productionOrders'
import { confirmDialog } from '../components/ui/ConfirmDialog'
import { formatDateTime, STAGES } from './catalog'
import { useOrderMutation } from './useOrderMutation'

/**
 * Thủ kho đánh dấu đơn không có đá (mô tả luồng bước 17): phiếu nguội xong sang thẳng O Chờ khắc,
 * bỏ khâu Vào đá. Đơn 0 viên đá trên 3D đã tự bỏ nên không hiện.
 */
export function StoneSkipBar({ order, locked }: { order: ProductionOrderDetail; locked: boolean }) {
  const { user } = useAuth()
  const isAdmin = user?.roleCode === 'ADMIN' || Boolean(user?.extraRoles?.includes('ADMIN'))
  const canKeeper = can(user, Permission.WAREHOUSE_KEEPER) || isAdmin
  const mutation = useOrderMutation(
    order.code,
    (skip: boolean) => skipStoneApi(order.code, skip),
    order.stoneSkipped ? 'Đã bỏ đánh dấu — đơn đi lại khâu Vào đá' : 'Đã đánh dấu không có đá — đơn sang Chờ khắc',
  )
  if (order.stoneCount === 0) return null

  const stoneIndex = STAGES.indexOf('STONE_SETTING')
  const active = canKeeper && !locked

  if (order.stoneSkipped) {
    // Bỏ đánh dấu chỉ khi chưa phiếu nào giao khâu sau Vào đá (khớp chặn phía BE).
    const passed =
      order.stages.some((entry) => STAGES.indexOf(entry.stage) > stoneIndex) ||
      order.subTickets.some((ticket) => ticket.pendingStage && STAGES.indexOf(ticket.pendingStage) > stoneIndex)
    return (
      <Alert
        severity="info"
        sx={{ py: 0.25 }}
        action={
          active && !passed ? (
            <Button color="inherit" size="small" disabled={mutation.isPending} onClick={() => mutation.mutate(false)}>
              {mutation.isPending ? 'Đang lưu…' : 'Bỏ đánh dấu'}
            </Button>
          ) : undefined
        }
      >
        Đơn không có đá — bỏ khâu Vào đá
        {order.stoneSkippedByName ? ` · ${order.stoneSkippedByName}` : ''}
        {order.stoneSkippedAt ? ` · ${formatDateTime(order.stoneSkippedAt)}` : ''}
      </Alert>
    )
  }

  // Chỉ hiện khi có phiếu đã nguội xong chờ vào đá và đơn chưa giao / mở khâu Vào đá nào.
  const waiting = order.subTickets.some((ticket) => ticket.status === 'WAIT_STONE' && ticket.state === 'IDLE')
  const started =
    order.stages.some((entry) => entry.stage === 'STONE_SETTING') ||
    order.subTickets.some((ticket) => ticket.pendingStage === 'STONE_SETTING')
  if (!active || !waiting || started) return null

  const skip = async () => {
    const ok = await confirmDialog({
      title: 'Đơn không có đá?',
      message: 'Các phiếu đã nguội xong chuyển thẳng sang Chờ khắc, bỏ khâu Vào đá. Bỏ đánh dấu được khi chưa giao khâu Khắc.',
      confirmLabel: 'Chuyển Chờ khắc',
      tone: 'info',
    })
    if (ok) mutation.mutate(true)
  }

  return (
    <Button
      size="small"
      variant="outlined"
      sx={{ alignSelf: 'flex-start' }}
      disabled={mutation.isPending}
      onClick={() => void skip()}
    >
      {mutation.isPending ? 'Đang lưu…' : 'Đơn không có đá — chuyển Chờ khắc'}
    </Button>
  )
}
