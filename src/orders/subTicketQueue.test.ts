import { describe, expect, it } from 'vitest'
import {
  queuedByTicket,
  queuedLabel,
  subTicketMutationKey,
  waitingCount,
  type QueuedSubTicketAction,
} from './subTicketQueue'

const row = (over: Partial<QueuedSubTicketAction> = {}): QueuedSubTicketAction => ({
  ticketCode: 'A012-1',
  action: 'claim',
  waiting: true,
  ...over,
})

describe('queuedLabel', () => {
  it('nói rõ đang chờ mạng hay đang gửi', () => {
    expect(queuedLabel(row())).toBe('Chờ gửi: nhận phiếu')
    expect(queuedLabel(row({ action: 'submit' }))).toBe('Chờ gửi: báo xong')
    expect(queuedLabel(row({ waiting: false }))).toBe('Đang gửi lên…')
  })
})

describe('queuedByTicket', () => {
  it('gom theo mã phiếu, giữ thao tác bấm sau cùng', () => {
    const map = queuedByTicket([row(), row({ action: 'unclaim' }), row({ ticketCode: 'A012-2' })])
    expect(map.get('A012-1')?.action).toBe('unclaim')
    expect(map.get('A012-2')?.action).toBe('claim')
    expect(map.size).toBe(2)
  })

  it('bỏ qua mutation chưa kịp có variables', () => {
    expect(queuedByTicket([row({ ticketCode: '' })]).size).toBe(0)
  })
})

describe('waitingCount', () => {
  it('chỉ đếm cái chưa gửi đi', () => {
    expect(waitingCount([row(), row({ ticketCode: 'A012-2', waiting: false })])).toBe(1)
  })
})

describe('subTicketMutationKey', () => {
  it('cùng gốc để lọc được cả nhóm', () => {
    expect(subTicketMutationKey('claim')).toEqual(['sub-ticket-action', 'claim'])
    expect(subTicketMutationKey('unsubmit')[0]).toBe(subTicketMutationKey('claim')[0])
  })
})
