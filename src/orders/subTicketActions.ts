import {
  onlineManager,
  useMutation,
  useMutationState,
  type QueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { isNetworkError } from '../api/auth'
import {
  acceptSubTicketApi,
  claimOrderApi,
  submitOrderApi,
  submitSubTicketApi,
  unclaimOrderApi,
  unclaimSubTicketApi,
  unsubmitOrderApi,
  unsubmitSubTicketApi,
  type ProductionOrderDetail,
} from '../api/productionOrders'
import {
  queuedByTicket,
  SUB_TICKET_ACTION_KEY,
  subTicketMutationKey,
  waitingCount,
  type QueuedSubTicketAction,
  type SubTicketAction,
  type SubTicketVars,
} from './subTicketQueue'
import { patchMyTicketsAfterSubTicketAction } from './myTicketsCache'
import { applyProductionOrderDetail } from './orderCache'
import { scheduleMyTicketsRefresh } from './myTicketsRefresh'

type ActionDef = {
  run: (orderCode: string, no: number | null) => Promise<ProductionOrderDetail>
  queued: (ticketCode: string) => string
  done: (ticketCode: string) => string
}

const ACTIONS: Record<SubTicketAction, ActionDef> = {
  claim: {
    // Chỉ phiếu mẹ còn tự nhận; phiếu con do thủ kho chỉ định thợ rồi thợ bấm "Nhận hàng".
    run: (code, no) => {
      if (no != null) throw new Error('Phiếu con do thủ kho chỉ định thợ — không tự nhận được')
      return claimOrderApi(code)
    },
    queued: (code) =>
      `Đã xếp hàng nhận phiếu ${code} — gửi lên khi có mạng. Thợ khác nhận trước thì sẽ báo lại.`,
    done: (code) => `Đã nhận phiếu ${code} — chờ người giao cân bạc và xác nhận`,
  },
  unclaim: {
    run: (code, no) => (no == null ? unclaimOrderApi(code) : unclaimSubTicketApi(code, no)),
    queued: (code) => `Đã xếp hàng huỷ nhận phiếu ${code} — gửi lên khi có mạng`,
    done: (code) => `Đã huỷ nhận phiếu ${code}`,
  },
  accept: {
    run: (code, no) => {
      if (no == null) throw new Error('Phiếu mẹ không có bước nhận hàng theo chỉ định')
      return acceptSubTicketApi(code, no)
    },
    queued: (code) => `Đã xếp hàng nhận hàng phiếu ${code} — gửi lên khi có mạng`,
    done: (code) => `Đã nhận hàng phiếu ${code} — bắt đầu làm`,
  },
  submit: {
    run: (code, no) => (no == null ? submitOrderApi(code) : submitSubTicketApi(code, no)),
    queued: (code) => `Đã xếp hàng báo xong phiếu ${code} — gửi lên khi có mạng`,
    done: (code) => `Đã báo xong phiếu ${code} — mang hàng tới QC cân lại`,
  },
  unsubmit: {
    run: (code, no) => (no == null ? unsubmitOrderApi(code) : unsubmitSubTicketApi(code, no)),
    queued: (code) => `Đã xếp hàng bỏ báo xong phiếu ${code} — gửi lên khi có mạng`,
    done: (code) => `Đã bỏ báo xong phiếu ${code}`,
  },
}

/**
 * Đăng ký mặc định cho 4 thao tác thợ bấm trên phiếu con, gọi một lần lúc dựng QueryClient.
 *
 * Phải là mutation defaults chứ không phải tham số của useMutation: thao tác bấm lúc mất
 * mạng được lưu xuống máy, mở app lần sau react-query dựng lại nó từ đây (hàm không
 * serialize được). Vì vậy mọi xử lý cache và thông báo đều nằm ở đây, không ở component.
 */
export function registerSubTicketActions(queryClient: QueryClient) {
  for (const action of Object.keys(ACTIONS) as SubTicketAction[]) {
    const def = ACTIONS[action]
    queryClient.setMutationDefaults<ProductionOrderDetail, Error, SubTicketVars>(
      subTicketMutationKey(action),
      {
        mutationFn: (vars) => def.run(vars.orderCode, vars.no),
        // Một hàng đợi chung cho mọi phiếu: thao tác phải lên máy chủ đúng thứ tự thợ bấm,
        // không để "huỷ nhận" vượt lên trước "nhận" của cùng một phiếu.
        scope: { id: SUB_TICKET_ACTION_KEY },
        // Chỉ thử lại khi hỏng vì mạng. Lỗi nghiệp vụ (phiếu đã có thợ khác nhận) mà thử
        // lại thì chỉ tổ báo sai cho thợ chậm mất mấy giây. Giữa hai lần thử, mất mạng thì
        // react-query tự treo lại chứ không tính là hỏng.
        retry: (failureCount, error) => failureCount < 2 && isNetworkError(error),
        retryDelay: 3_000,
        onMutate: (vars) => {
          if (!onlineManager.isOnline()) toast.info(def.queued(vars.ticketCode))
        },
        onSuccess: (order, vars) => {
          applyProductionOrderDetail(queryClient, order)
          patchMyTicketsAfterSubTicketAction(queryClient, order, vars, action)
          void queryClient.invalidateQueries({
            queryKey: ['production-order-costing', vars.orderCode],
            refetchType: 'none',
          })
          scheduleMyTicketsRefresh(queryClient)
          toast.success(def.done(vars.ticketCode))
        },
        onError: (error, vars) => {
          toast.error(`Phiếu ${vars.ticketCode}: ${error.message}`)
          scheduleMyTicketsRefresh(queryClient)
          void queryClient.invalidateQueries({ queryKey: ['production-order', vars.orderCode] })
        },
      },
    )
  }
}

/**
 * Thao tác phiếu con của thợ. Mất mạng thì react-query giữ lại trong hàng chờ và tự gửi
 * khi có sóng — kể cả khi thợ đã tắt app đi (xem offlineCache.ts).
 */
export function useSubTicketAction(action: SubTicketAction) {
  return useMutation<ProductionOrderDetail, Error, SubTicketVars>({
    mutationKey: subTicketMutationKey(action),
  })
}

function useQueuedRows(): QueuedSubTicketAction[] {
  return useMutationState<QueuedSubTicketAction>({
    filters: { mutationKey: [SUB_TICKET_ACTION_KEY], status: 'pending' },
    select: (mutation) => ({
      ticketCode: (mutation.state.variables as SubTicketVars | undefined)?.ticketCode ?? '',
      action: (mutation.options.mutationKey?.[1] ?? 'claim') as SubTicketAction,
      waiting: mutation.state.isPaused,
    }),
  })
}

/** Tra theo mã phiếu con: phiếu nào đang có thao tác chưa chốt xong. */
export function useQueuedSubTickets(): Map<string, QueuedSubTicketAction> {
  return queuedByTicket(useQueuedRows())
}

/** Số thao tác đang nằm chờ mạng — dùng cho thanh báo ngoại tuyến ở AppShell. */
export function useWaitingCount(): number {
  return waitingCount(useQueuedRows())
}
