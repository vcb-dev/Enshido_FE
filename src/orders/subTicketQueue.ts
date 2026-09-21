/**
 * Hàng chờ thao tác phiếu con của thợ. Tách riêng phần thuần logic để test được mà không
 * phải dựng react-query — phần nối với API nằm ở subTicketActions.ts.
 */

export type SubTicketAction = 'claim' | 'unclaim' | 'submit' | 'unsubmit'

export type SubTicketVars = {
  orderCode: string
  no: number
  /** Mã phiếu con (vd A012-1) — để đánh dấu đúng thẻ phiếu và ghi vào thông báo. */
  ticketCode: string
}

export type QueuedSubTicketAction = {
  ticketCode: string
  action: SubTicketAction
  /** true = chưa gửi đi, đang đợi có mạng · false = đang gửi lên máy chủ. */
  waiting: boolean
}

export const SUB_TICKET_ACTION_KEY = 'sub-ticket-action'

export function subTicketMutationKey(action: SubTicketAction) {
  return [SUB_TICKET_ACTION_KEY, action]
}

const WAITING_LABEL: Record<SubTicketAction, string> = {
  claim: 'Chờ gửi: nhận phiếu',
  unclaim: 'Chờ gửi: huỷ nhận',
  submit: 'Chờ gửi: báo xong',
  unsubmit: 'Chờ gửi: bỏ báo xong',
}

/** Nhãn hiện trên thẻ phiếu khi thao tác chưa chốt được với máy chủ. */
export function queuedLabel(entry: QueuedSubTicketAction): string {
  return entry.waiting ? WAITING_LABEL[entry.action] : 'Đang gửi lên…'
}

/**
 * Mỗi phiếu chỉ hiện một thao tác — cái thợ bấm sau cùng, vì react-query trả danh sách
 * theo thứ tự bấm. Bỏ qua bản ghi chưa kịp có variables (mutation vừa dựng xong).
 */
export function queuedByTicket(rows: QueuedSubTicketAction[]): Map<string, QueuedSubTicketAction> {
  const byTicket = new Map<string, QueuedSubTicketAction>()
  for (const row of rows) {
    if (row.ticketCode) byTicket.set(row.ticketCode, row)
  }
  return byTicket
}

/** Số thao tác còn nằm chờ mạng — hiện trên thanh báo ngoại tuyến. */
export function waitingCount(rows: QueuedSubTicketAction[]): number {
  return rows.filter((row) => row.waiting).length
}
