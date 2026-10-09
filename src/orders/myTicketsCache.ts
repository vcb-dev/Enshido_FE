import type { QueryClient } from '@tanstack/react-query'
import type {
  MyTicketItem,
  MyTickets,
  ProductionOrderDetail,
  SubTicketState,
} from '../api/productionOrders'
import { usesReceiptFlow } from './catalog'
import type { SubTicketAction, SubTicketVars } from './subTicketQueue'

function pickTicketState(
  order: ProductionOrderDetail,
  no: number | null,
): { state: SubTicketState | null; stage: MyTicketItem['stage'] } {
  if (no != null) {
    const ticket = order.subTickets.find((row) => row.no === no)
    if (ticket) {
      return {
        state: ticket.state,
        stage: ticket.activeStage ?? ticket.pendingStage,
      }
    }
  }
  const work = order.workTicket
  if (work) {
    return { state: work.state, stage: work.activeStage ?? work.pendingStage }
  }
  return { state: null, stage: null }
}

export function isWaitingForWorkerReceipt(item: MyTicketItem) {
  return item.state === 'CLAIMED' && usesReceiptFlow(item.stage, item.no, item.receiptPrepared)
}

function shouldBeAvailable(state: SubTicketState | null, pendingStage: MyTicketItem['stage']) {
  return state === 'WAITING' && pendingStage != null
}

function shouldBeMine(state: SubTicketState | null) {
  return state === 'CLAIMED' || state === 'WORKING' || state === 'SUBMITTED'
}

function patchItem(item: MyTicketItem, order: ProductionOrderDetail, no: number | null): MyTicketItem {
  const { state, stage } = pickTicketState(order, no)
  const ticket = no != null ? order.subTickets.find((row) => row.no === no) : null
  return {
    ...item,
    orderStatus: order.status,
    state: state ?? item.state,
    stage: stage ?? item.stage,
    receiptPrepared: no == null ? order.workTicket?.receiptPrepared : item.receiptPrepared,
    claimedAt: ticket?.claimedAt ?? item.claimedAt,
    pendingAt: ticket?.pendingAt ?? item.pendingAt,
  }
}

const NEXT_STATE: Record<SubTicketAction, SubTicketState> = {
  claim: 'CLAIMED',
  unclaim: 'WAITING',
  accept: 'WORKING',
  submit: 'SUBMITTED',
  unsubmit: 'WORKING',
}

/** Vá danh sách phiếu ngay lúc bấm nút — không đợi máy chủ. */
export function optimisticMyTicketsAction(
  queryClient: QueryClient,
  vars: SubTicketVars,
  action: SubTicketAction,
) {
  const state = NEXT_STATE[action]
  queryClient.setQueryData<ProductionOrderDetail>(['production-order', vars.orderCode], (order) => {
    if (!order) return order
    if (vars.no == null) {
      if (!order.workTicket) return order
      return { ...order, workTicket: { ...order.workTicket, state } }
    }
    return {
      ...order,
      subTickets: order.subTickets.map((ticket) =>
        ticket.no === vars.no ? { ...ticket, state } : ticket,
      ),
    }
  })
  queryClient.setQueryData<MyTickets>(['my-tickets'], (prev) => {
    if (!prev) return prev
    const code = vars.ticketCode
    const hit =
      prev.available.find((row) => row.ticketCode === code) ??
      prev.mine.find((row) => row.ticketCode === code)
    if (!hit) return prev
    const nextItem: MyTicketItem = { ...hit, state }
    const without = (rows: MyTicketItem[]) => rows.filter((row) => row.ticketCode !== code)
    let available = without(prev.available)
    let mine = without(prev.mine)
    if (shouldBeAvailable(state, nextItem.stage) || isWaitingForWorkerReceipt(nextItem)) {
      available = [...available, nextItem]
    } else if (shouldBeMine(state)) {
      mine = [...mine, nextItem]
    } else {
      mine = [...mine, nextItem]
    }
    return { ...prev, available, mine }
  })
}

/** Cập nhật Phiếu của tôi ngay sau claim / giao / nộp — không chờ refetch. */
export function patchMyTicketsAfterSubTicketAction(
  queryClient: QueryClient,
  order: ProductionOrderDetail,
  vars: SubTicketVars,
  _action: SubTicketAction,
) {
  queryClient.setQueryData<MyTickets>(['my-tickets'], (prev) => {
    if (!prev) return prev
    const code = vars.ticketCode
    const hit =
      prev.available.find((row) => row.ticketCode === code) ??
      prev.mine.find((row) => row.ticketCode === code) ??
      prev.recent.find((row) => row.ticketCode === code)
    if (!hit) return prev

    const nextItem = patchItem(hit, order, vars.no)
    const { state, stage } = pickTicketState(order, vars.no)

    const without = (rows: MyTicketItem[]) => rows.filter((row) => row.ticketCode !== code)
    let available = without(prev.available)
    let mine = without(prev.mine)
    let recent = without(prev.recent)

    if (shouldBeAvailable(state, stage) || isWaitingForWorkerReceipt(nextItem)) {
      available = [...available, nextItem]
    } else if (shouldBeMine(state)) {
      mine = [...mine, nextItem]
    } else if (state === 'IDLE' || state === 'FINISH' || state === 'DEFECT') {
      recent = [nextItem, ...without(prev.recent)].slice(0, 20)
    } else {
      mine = [...mine, nextItem]
    }

    return { ...prev, available, mine, recent }
  })
}
