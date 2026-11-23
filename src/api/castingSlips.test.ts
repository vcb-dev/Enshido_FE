import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  canPrintCastingSlip,
  cutCastingSlipApi,
  cutCastingSlipsApi,
  type CastingSlipStatus,
  type CutCastingSlipItem,
} from './castingSlips'

const fetchMock = vi.fn()
const item: CutCastingSlipItem = {
  slipId: 'slip-1',
  blanks: [{ intakeOrderId: 'order-1', qty: 800, weightGram: 800,
    images: [{ url: 'https://example.com/blank.jpg', publicId: 'blank' }] }],
  restS925Gram: 150,
  restRecoveredGram: 50,
  restImages: [{ url: 'https://example.com/rest.jpg', publicId: 'rest' }],
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('document', { cookie: '' })
})

afterEach(() => vi.unstubAllGlobals())

describe('payload cắt cây thông', () => {
  it('cắt một phiếu không gửi slipId trong body dù đầu vào đến từ form nhiều phiếu', async () => {
    await cutCastingSlipApi(item.slipId, item)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/casting-slips/slip-1/cut')
    expect(JSON.parse(options.body)).toEqual({
      blanks: item.blanks, restS925Gram: 150, restRecoveredGram: 50, restImages: item.restImages,
    })
  })

  it('cắt nhiều phiếu giữ slipId để xác định từng phiếu', async () => {
    await cutCastingSlipsApi([item])
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/casting-slips/cut-many')
    expect(JSON.parse(options.body)).toEqual({ items: [item] })
  })
})

describe('in phiếu đúc sau khi nhập thực xuất', () => {
  it('phiếu Chờ cấp vật tư chưa in được', () => {
    expect(canPrintCastingSlip({ status: 'PENDING_ISSUE' })).toBe(false)
  })

  it('đã cấp vật tư (đã nhập thực xuất) trở đi thì in được', () => {
    const statuses: CastingSlipStatus[] = ['WAIT_CASTING', 'CASTING', 'PENDING_CONFIRMATION', 'DONE', 'CAST_FAILED']
    for (const status of statuses) expect(canPrintCastingSlip({ status })).toBe(true)
  })
})
