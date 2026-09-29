import { apiFetch } from './auth'
import type { OrderImage } from './productionOrders'

export type CastingSlipImage = Pick<OrderImage, 'url' | 'publicId' | 'width' | 'height'>

export type CastingSlip = {
  id: string
  code: string
  slipDate: string
  intakeOrderId: string
  intakeCode: string
  intakeProductName: string
  intakeQty?: number
  waxWeightGram: string
  batchOrderCodes: string
  issueS999Gram: string | null
  issueMasterAlloyGram: string | null
  issueS925Gram: string | null
  issueTotalGram: string
  createdAt: string
  images: CastingSlipImage[]
}

export type CastingSlipList = {
  items: CastingSlip[]
  total: number
  page: number
  pageSize: number
}

export type CreateCastingSlipFlaskPayload = {
  issueS999Gram?: number
  issueMasterAlloyGram?: number
  issueS925Gram?: number
  images: CastingSlipImage[]
}

export type CreateCastingSlipsPayload = {
  slipDate: string
  batchOrderCodes: string
  flasks: CreateCastingSlipFlaskPayload[]
}

export type CreateCastingSlipsResult = {
  items: CastingSlip[]
  count: number
}

export type ListCastingSlipsParams = {
  search?: string
  slipDate?: string
  intakeCode?: string
  batchOrderCodes?: string
  waxWeight?: string
  issueTotal?: string
  page: number
  pageSize: number
}

export function listCastingSlipsApi(params: ListCastingSlipsParams) {
  const query = new URLSearchParams()
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.slipDate?.trim()) query.set('slipDate', params.slipDate.trim())
  if (params.intakeCode?.trim()) query.set('intakeCode', params.intakeCode.trim())
  if (params.batchOrderCodes?.trim()) query.set('batchOrderCodes', params.batchOrderCodes.trim())
  if (params.waxWeight?.trim()) query.set('waxWeight', params.waxWeight.trim())
  if (params.issueTotal?.trim()) query.set('issueTotal', params.issueTotal.trim())
  query.set('page', String(params.page))
  query.set('pageSize', String(params.pageSize))
  return apiFetch<CastingSlipList>(`/casting-slips?${query.toString()}`)
}

export function getCastingSlipApi(id: string) {
  return apiFetch<CastingSlip>(`/casting-slips/${id}`)
}

export function createCastingSlipsFromIntakeApi(
  intakeOrderId: string,
  payload: CreateCastingSlipsPayload,
) {
  return apiFetch<CreateCastingSlipsResult>(`/casting-slips/from-intake/${intakeOrderId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
