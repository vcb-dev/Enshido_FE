import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dehydrate,
  hydrate,
  MutationObserver as RqMutationObserver,
  onlineManager,
  QueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { reportNetworkFailure } from '../auth/connectivity'
import { persistOptions } from '../auth/offlineCache'
import { claimSubTicketApi, type ProductionOrderDetail } from '../api/productionOrders'
import { registerSubTicketActions } from './subTicketActions'
import {
  queuedByTicket,
  SUB_TICKET_ACTION_KEY,
  subTicketMutationKey,
  type QueuedSubTicketAction,
  type SubTicketAction,
  type SubTicketVars,
} from './subTicketQueue'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn() },
}))
vi.mock('../auth/connectivity', () => ({
  reportNetworkFailure: vi.fn(),
  watchConnectivity: vi.fn(),
}))

const VARS: SubTicketVars = { orderCode: 'A012', no: 1, ticketCode: 'A012-1' }
const ORDER = { code: 'A012' } as ProductionOrderDetail

const fetchMock = vi.fn()
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Chờ hàng chờ chạy hết. Không await được lời hứa của mutation khôi phục từ bản lưu: nó
 * không còn observer nào, và onlineManager có thể đã tự resume trước khi ta kịp gọi.
 */
async function drain(client: QueryClient) {
  for (let i = 0; i < 50; i += 1) {
    const pending = client.getMutationCache().getAll().some((m) => m.state.status === 'pending')
    if (!pending) return
    await tick()
  }
  throw new Error('Hàng chờ không chạy hết')
}

function jsonRes(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as unknown as Response
}

/** Lặp lại đúng bộ lọc mà useQueuedSubTickets dùng, để kiểm cả phần lọc theo mutationKey. */
function readQueue(client: QueryClient): QueuedSubTicketAction[] {
  return client
    .getMutationCache()
    .findAll({ mutationKey: [SUB_TICKET_ACTION_KEY], status: 'pending' })
    .map((mutation) => ({
      ticketCode: (mutation.state.variables as SubTicketVars | undefined)?.ticketCode ?? '',
      action: (mutation.options.mutationKey?.[1] ?? 'claim') as SubTicketAction,
      waiting: mutation.state.isPaused,
    }))
}

function makeClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  registerSubTicketActions(client)
  client.mount()
  return client
}

function fire(client: QueryClient, action: SubTicketAction, vars = VARS) {
  const observer = new RqMutationObserver<ProductionOrderDetail, Error, SubTicketVars>(client, {
    mutationKey: subTicketMutationKey(action),
  })
  // Bắt sẵn để lời hứa bị từ chối không làm hỏng cả tiến trình test.
  const promise = observer.mutate(vars).catch((error: Error) => error)
  return { observer, promise }
}

function calledUrls() {
  return fetchMock.mock.calls.map((call) => String(call[0]))
}

let client: QueryClient

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  // apiFetch đọc cookie CSRF; bộ test chạy môi trường node nên phải dựng tạm document.
  vi.stubGlobal('document', { cookie: '' })
  onlineManager.setOnline(true)
  client = makeClient()
})

afterEach(() => {
  client.unmount()
  client.clear()
  onlineManager.setOnline(true)
  vi.unstubAllGlobals()
})

describe('có mạng', () => {
  it('gửi thẳng, ghi đơn mới vào cache và báo cho thợ', async () => {
    fetchMock.mockResolvedValue(jsonRes(ORDER))

    await fire(client, 'claim').promise

    expect(calledUrls()).toEqual(['/api/production-orders/A012/sub-tickets/1/claim'])
    expect(client.getQueryData(['production-order', 'A012'])).toEqual(ORDER)
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Đã nhận phiếu A012-1'))
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('lỗi nghiệp vụ thì báo nguyên văn máy chủ và không thử lại', async () => {
    fetchMock.mockResolvedValue(jsonRes({ message: 'Phiếu A012-1 đã có thợ Nam nhận' }, 400))

    const error = (await fire(client, 'claim').promise) as Error

    expect(error.message).toBe('Phiếu A012-1 đã có thợ Nam nhận')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Phiếu A012-1: Phiếu A012-1 đã có thợ Nam nhận')
  })
})

describe('mất mạng', () => {
  it('không gửi đi, treo lại và nói rõ là đang xếp hàng', async () => {
    fetchMock.mockResolvedValue(jsonRes(ORDER))
    onlineManager.setOnline(false)

    const { observer } = fire(client, 'claim')
    await tick()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(observer.getCurrentResult().isPaused).toBe(true)
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Đã xếp hàng nhận phiếu A012-1'))
    expect(toast.success).not.toHaveBeenCalled()

    // Đúng thứ mà thẻ phiếu đọc để hiện chip vàng.
    const queued = queuedByTicket(readQueue(client)).get('A012-1')
    expect(queued).toEqual({ ticketCode: 'A012-1', action: 'claim', waiting: true })
  })

  it('có sóng lại thì tự gửi lên, không cần thợ bấm lại', async () => {
    fetchMock.mockResolvedValue(jsonRes(ORDER))
    onlineManager.setOnline(false)
    const { promise } = fire(client, 'claim')
    await tick()

    onlineManager.setOnline(true)
    await promise

    expect(calledUrls()).toEqual(['/api/production-orders/A012/sub-tickets/1/claim'])
    expect(toast.success).toHaveBeenCalledOnce()
    expect(readQueue(client)).toHaveLength(0)
  })

  it('nhiều phiếu thì giữ nguyên thứ tự thợ bấm', async () => {
    fetchMock.mockResolvedValue(jsonRes(ORDER))
    onlineManager.setOnline(false)
    const first = fire(client, 'claim', { orderCode: 'A012', no: 1, ticketCode: 'A012-1' })
    const second = fire(client, 'submit', { orderCode: 'A012', no: 2, ticketCode: 'A012-2' })
    await tick()

    expect(readQueue(client).every((row) => row.waiting)).toBe(true)
    expect(readQueue(client)).toHaveLength(2)

    onlineManager.setOnline(true)
    await Promise.all([first.promise, second.promise])

    expect(calledUrls()).toEqual([
      '/api/production-orders/A012/sub-tickets/1/claim',
      '/api/production-orders/A012/sub-tickets/2/submit',
    ])
  })
})

describe('tắt app rồi mở lại', () => {
  it('thao tác đang treo được lưu xuống máy và gửi lên ở phiên sau', async () => {
    fetchMock.mockResolvedValue(jsonRes(ORDER))
    onlineManager.setOnline(false)
    fire(client, 'submit')
    await tick()

    const saved = dehydrate(client, persistOptions.dehydrateOptions)
    expect(saved.mutations).toHaveLength(1)
    expect(saved.mutations[0].mutationKey).toEqual(['sub-ticket-action', 'submit'])
    expect(saved.mutations[0].state.variables).toEqual(VARS)

    // Phiên mới: client khác, chỉ có bản lưu đi qua JSON như khi nằm trong localStorage.
    client.unmount()
    client.clear()
    client = makeClient()
    hydrate(client, JSON.parse(JSON.stringify(saved)))
    expect(readQueue(client)).toHaveLength(1)

    onlineManager.setOnline(true)
    await client.resumePausedMutations()
    await drain(client)

    expect(calledUrls()).toEqual(['/api/production-orders/A012/sub-tickets/1/submit'])
    expect(client.getQueryData(['production-order', 'A012'])).toEqual(ORDER)
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Đã báo xong phiếu A012-1'))
  })

  it('thao tác đã gửi xong thì không lưu lại để gửi lần nữa', async () => {
    fetchMock.mockResolvedValue(jsonRes(ORDER))
    await fire(client, 'claim').promise

    expect(dehydrate(client, persistOptions.dehydrateOptions).mutations).toHaveLength(0)
  })
})

describe('chính sách thử lại', () => {
  it('chỉ thử lại khi hỏng vì mạng, tối đa 2 lần', () => {
    const retry = client.getMutationDefaults(subTicketMutationKey('claim')).retry
    expect(typeof retry).toBe('function')
    const shouldRetry = retry as (count: number, error: Error) => boolean
    const network = Object.assign(new Error('Mất kết nối tới máy chủ'), { name: 'NetworkError' })

    expect(shouldRetry(0, network)).toBe(true)
    expect(shouldRetry(1, network)).toBe(true)
    expect(shouldRetry(2, network)).toBe(false)
    // Endpoint claim/submit không idempotent — gọi lại lỗi nghiệp vụ chỉ tổ báo sai.
    expect(shouldRetry(0, new Error('Phiếu A012-1 đã có thợ Nam nhận'))).toBe(false)
  })

  it('fetch chết vì mạng thì hạ cờ ngoại tuyến và đổi sang lỗi tiếng Việt', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(claimSubTicketApi('A012', 1)).rejects.toThrow('Mất kết nối tới máy chủ')
    expect(reportNetworkFailure).toHaveBeenCalled()
  })
})
