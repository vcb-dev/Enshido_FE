import { apiFetch } from './auth'

export type BtpWaitingRow = {
  id: string
  stt: number
  receivedAt: string
  craftsmanUserId: string | null
  craftsmanName: string
  name: string
  unit: string
  unitId: string | null
  qty: string
  weight: string
  note: string | null
  enteredBy: string | null
}

export type BtpWaitingResponse = {
  warehouse: { id: string; code: string; name: string; shortName: string }
  totals: { qty: string; weight: string }
  items: BtpWaitingRow[]
}

export type UpsertBtpWaitingPayload = {
  receivedAt: string
  craftsmanUserId: string
  name: string
  unitId?: string | null
  unitName?: string
  qty: string
  weight: string
  note?: string
}

export function getBtpWaitingApi(code: string) {
  return apiFetch<BtpWaitingResponse>(`/warehouses/${code}/btp-waiting`)
}

export function createBtpWaitingApi(code: string, payload: UpsertBtpWaitingPayload) {
  return apiFetch<BtpWaitingRow>(`/warehouses/${code}/btp-waiting`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateBtpWaitingApi(
  code: string,
  id: string,
  payload: UpsertBtpWaitingPayload,
) {
  return apiFetch<BtpWaitingRow>(`/warehouses/${code}/btp-waiting/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteBtpWaitingApi(code: string, id: string) {
  return apiFetch<{ success: boolean }>(`/warehouses/${code}/btp-waiting/${id}`, {
    method: 'DELETE',
  })
}
