import type { QueryClient } from '@tanstack/react-query'
import type {
  BtpOption,
  FinishedProductOption,
  NvlOption,
  ProductionOrderDetail,
  ProductionOrderListResponse,
  ProductionOrderRow,
  SubTicketSummary,
} from '../api/productionOrders'
import { invalidateBtpStock } from './btpStock'
import { invalidateNvlStock, invalidateNvlWarehouse } from './nvlStock'
import {
  patchProductionStatusCounts,
  scheduleProductionStatusCountsRefresh,
} from './productionStatusCountsRefresh'

/** Ghi cache chi tiết + vá danh sách để vào trang đơn ngay, không chờ refetch. */
export function seedProductionOrder(queryClient: QueryClient, order: ProductionOrderDetail) {
  queryClient.setQueryData(['production-order', order.code], order)
  queryClient.setQueriesData(
    { queryKey: ['production-orders'] },
    (current: ProductionOrderListResponse | undefined) => patchOrderList(queryClient, current, order),
  )
}

export function refreshProductionOrderLists(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['production-orders'], refetchType: 'none' })
}

/** Mọi thao tác role trả về chi tiết đơn — vá list + cache chi tiết tức thì. */
export function applyProductionOrderDetail(
  queryClient: QueryClient,
  order: ProductionOrderDetail,
) {
  seedProductionOrder(queryClient, order)
  scheduleProductionStatusCountsRefresh(queryClient)
}

export function removeProductionOrderFromLists(queryClient: QueryClient, orderId: string, code: string) {
  queryClient.setQueriesData(
    { queryKey: ['production-orders'] },
    (current: ProductionOrderListResponse | undefined) => {
      if (!current?.items) return current
      const removed = current.items.find((item) => item.id === orderId)
      if (!removed) return current
      patchProductionStatusCounts(queryClient, removed.status, undefined)
      const statusCounts = current.statusCounts
        ? {
            ...current.statusCounts,
            ALL: Math.max(0, current.statusCounts.ALL - 1),
            [removed.status]: Math.max(0, current.statusCounts[removed.status] - 1),
          }
        : undefined
      return {
        ...current,
        total: Math.max(0, current.total - 1),
        statusCounts,
        items: current.items.filter((item) => item.id !== orderId),
      }
    },
  )
  queryClient.removeQueries({ queryKey: ['production-order', code] })
}

/**
 * Sau lên đơn / lưu: hiện trang đơn ngay từ cache, trừ tồn trên picker,
 * rồi mới làm mới kho khi trình duyệt rảnh — tránh giật lúc ấn Lên đơn.
 */
export function afterProductionOrderSaved(
  queryClient: QueryClient,
  order: ProductionOrderDetail,
  previous?: ProductionOrderDetail | null,
) {
  seedProductionOrder(queryClient, order)
  scheduleProductionStatusCountsRefresh(queryClient)
  if (!previous) patchPickerStock(queryClient, order)
  scheduleIdle(() => {
    const wasBtp = previous?.source === 'BTP' || order.source === 'BTP'
    const wasNvl = previous?.source === 'NVL' || order.source === 'NVL'
    if (wasBtp) {
      invalidateBtpStock(queryClient)
      invalidateNvlWarehouse(queryClient)
    }
    if (wasNvl) invalidateNvlStock(queryClient)
  })
}

function scheduleIdle(fn: () => void) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(fn, { timeout: 800 })
    return
  }
  window.setTimeout(fn, 280)
}

function patchPickerStock(queryClient: QueryClient, order: ProductionOrderDetail) {
  const issuedNvl = order.nvlLines?.filter((line) => line.materialId && (line.qty ?? 0) > 0) ?? []
  if (issuedNvl.length) {
    queryClient.setQueryData(['nvl-options'], (items: NvlOption[] | undefined) => {
      let next = items
      for (const line of issuedNvl) {
        next = subtractQty(next, line.materialId, line.qty ?? 0)
      }
      return next
    })
  } else {
    const nvlUsed = order.stoneCount ?? 0
    if (order.nvl?.id && nvlUsed > 0) {
      queryClient.setQueryData(['nvl-options'], (items: NvlOption[] | undefined) =>
        subtractQty(items, order.nvl!.id, nvlUsed),
      )
    }
  }
  const btpUsed = order.finishedProductQty ?? order.qty
  if (order.btp?.id && btpUsed > 0) {
    queryClient.setQueryData(['btp-options'], (items: BtpOption[] | undefined) =>
      subtractQty(items, order.btp!.id, btpUsed),
    )
  }
  const fgUsed = order.finishedProductQty ?? 0
  if (order.source === 'NVL' && order.sourceOrderCode && fgUsed > 0) {
    queryClient.setQueryData(
      ['finished-product-options'],
      (items: FinishedProductOption[] | undefined) =>
        items?.map((item) =>
          item.code === order.sourceOrderCode
            ? { ...item, remainingQty: Math.max(0, item.remainingQty - fgUsed) }
            : item,
        ),
    )
  }
}

function subtractQty<T extends { id: string; qty: string }>(
  items: T[] | undefined,
  id: string,
  used: number,
) {
  if (!items) return items
  return items.map((item) =>
    item.id === id ? { ...item, qty: String(Math.max(0, Number(item.qty) - used)) } : item,
  )
}

function toListRow(order: ProductionOrderDetail): ProductionOrderRow {
  const parentEntries = order.stages.filter((entry) => !entry.subTicketId)
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    source: order.source,
    btpSku: order.btp?.sku ?? order.btpSku ?? null,
    requestType: order.requestType,
    qty: order.qty,
    qtyUnit: order.qtyUnit,
    finishedProductQty: order.finishedProductQty,
    returnedQty: order.returnedQty,
    model3dCode: order.model3dCode,
    model3dUrl: order.model3dUrl,
    leadTime: order.leadTime,
    trackingCode: order.trackingCode,
    closedBy: order.closedBy,
    customerName: order.customerName ?? null,
    description: order.description,
    stoneColor: order.stoneColor,
    stoneTypes: order.stoneTypes,
    size: order.size,
    sizeLabel: order.sizeLabel,
    mainMaterial: order.mainMaterial,
    platingColor: order.platingColor,
    btpCategory: order.btpCategory,
    btpName: order.btpName,
    productKind: order.productKind,
    askedUserName: order.askedUserName,
    receivedDate: order.receivedDate,
    dueDate: order.dueDate,
    debtStatus: order.debtStatus,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    workState: order.subTickets.length ? null : (order.workTicket?.state ?? null),
    workStage: order.subTickets.length
      ? null
      : (order.workTicket?.activeStage ?? parentEntries.at(-1)?.stage ?? null),
    images: order.images.map((image) => ({
      id: image.id ?? image.publicId,
      kind: image.kind,
      url: image.url,
    })),
    subTickets: summarizeSubTickets(order),
  }
}

/**
 * Tóm tắt phiếu con từ bản chi tiết — khớp `subTicketSummary` bên BE, để dòng danh sách vá
 * sau mỗi lần sửa đơn hiện y như lúc tải lại từ máy chủ.
 */
export function summarizeSubTickets(order: ProductionOrderDetail): SubTicketSummary[] {
  return order.subTickets.map((ticket) => {
    const own = order.stages.filter((entry) => entry.subTicketId === ticket.id)
    const open = ticket.openEntryId ? own.find((entry) => entry.id === ticket.openEntryId) : undefined
    return {
      code: ticket.code,
      no: ticket.no,
      qty: ticket.qty,
      note: ticket.note,
      createdAt: ticket.createdAt,
      state: ticket.state,
      stage: ticket.activeStage ?? own.at(-1)?.stage ?? null,
      workerName:
        ticket.state === 'CLAIMED'
          ? ticket.claimedByName
          : ticket.state === 'WORKING' || ticket.state === 'SUBMITTED'
            ? (open?.craftsmanName ?? null)
            : null,
    }
  })
}

function patchOrderList(
  queryClient: QueryClient,
  current: ProductionOrderListResponse | undefined,
  order: ProductionOrderDetail,
): ProductionOrderListResponse | undefined {
  if (!current?.items) return current
  const row = toListRow(order)
  const index = current.items.findIndex((item) => item.id === order.id)
  if (index >= 0) {
    const prev = current.items[index]!
    if (prev.status !== order.status) {
      patchProductionStatusCounts(queryClient, prev.status, order.status)
    }
    const items = current.items.slice()
    items[index] = row
    let statusCounts = current.statusCounts
    if (statusCounts && prev.status !== order.status) {
      statusCounts = { ...statusCounts }
      statusCounts[prev.status] = Math.max(0, statusCounts[prev.status] - 1)
      statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1
    }
    return { ...current, items, ...(statusCounts ? { statusCounts } : {}) }
  }
  const sameSource = current.items.every((item) => item.source === order.source)
  if (!sameSource && current.items.length > 0) return current
  patchProductionStatusCounts(queryClient, undefined, order.status)
  const statusCounts = current.statusCounts
    ? {
        ...current.statusCounts,
        ALL: current.statusCounts.ALL + 1,
        [order.status]: (current.statusCounts[order.status] ?? 0) + 1,
      }
    : undefined
  return {
    ...current,
    total: current.total + 1,
    ...(statusCounts ? { statusCounts } : {}),
    items: [row, ...current.items],
  }
}
