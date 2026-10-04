import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cutCastingSlipApi, cutCastingSlipsApi, type CutCastingSlipItem } from './castingSlips'

const fetchMock = vi.fn()
const item: CutCastingSlipItem = {
  slipId: 'slip-1',
  blanks: [{ intakeOrderId: 'order-1', qty: 800, weightGram: 800,
    images: [{ url: 'https://example.com/blank.jpg', publicId: 'blank' }] }],
  restWeightGram: 200,
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
      blanks: item.blanks, restWeightGram: 200, restImages: item.restImages,
    })
  })

  it('cắt nhiều phiếu giữ slipId để xác định từng phiếu', async () => {
    await cutCastingSlipsApi([item])
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/casting-slips/cut-many')
    expect(JSON.parse(options.body)).toEqual({ items: [item] })
  })
})
