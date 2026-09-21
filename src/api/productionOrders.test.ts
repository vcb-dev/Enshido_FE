import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getOrderReferenceApi,
  getProductionOrderApi,
  listProductionOrdersApi,
  type ProductionOrderListParams,
} from './productionOrders'

const fetchMock = vi.fn()

function jsonRes(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as unknown as Response
}

const LIST_PARAMS = { source: 'NVL', page: 1, pageSize: 25 } as ProductionOrderListParams

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('document', { cookie: '' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * Máy chủ cũ hơn bản FE đang chạy thì đơn về không có `subTickets`. Cột mã đơn đọc thẳng
 * `row.subTickets.length` nên thiếu mảng là ném lỗi ngay trong render, tức trắng cả trang
 * đơn sản xuất chứ không chỉ hỏng một ô.
 */
describe('máy chủ cũ chưa trả phiếu con', () => {
  it('dòng danh sách được bù mảng rỗng thay vì undefined', async () => {
    fetchMock.mockResolvedValue(
      jsonRes({
        total: 1,
        statusCounts: { ALL: 1 },
        items: [{ id: 'o1', code: 'A001' }],
      }),
    )

    const res = await listProductionOrdersApi(LIST_PARAMS)

    expect(res.items[0].subTickets).toEqual([])
    expect(res.items[0].code).toBe('A001')
  })

  it('chi tiết đơn được bù cả mảng phiếu con và số đã chia', async () => {
    fetchMock.mockResolvedValue(jsonRes({ id: 'o1', code: 'A001' }))

    const order = await getProductionOrderApi('A001')

    expect(order.subTickets).toEqual([])
    expect(order.subTicketTotals).toEqual({ qty: 0, silverWeight: '0' })
  })

  it('trang tra cứu cho thợ quét QR cũng được bù', async () => {
    fetchMock.mockResolvedValue(jsonRes({ code: 'A001' }))

    const order = await getOrderReferenceApi('A001')

    expect(order.subTickets).toEqual([])
  })
})

describe('máy chủ trả đủ phiếu con', () => {
  it('giữ nguyên dữ liệu máy chủ, không ghi đè bằng mặc định', async () => {
    const tickets = [{ code: 'A001-1', no: 1, qty: 2 }]
    fetchMock.mockResolvedValue(
      jsonRes({
        id: 'o1',
        code: 'A001',
        subTickets: tickets,
        subTicketTotals: { qty: 2, silverWeight: '12.5' },
      }),
    )

    const order = await getProductionOrderApi('A001')

    expect(order.subTickets).toEqual(tickets)
    expect(order.subTicketTotals).toEqual({ qty: 2, silverWeight: '12.5' })
  })
})
