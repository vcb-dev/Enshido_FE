import { apiFetch } from './auth'

export type LocationOccupant = {
  id: string
  sku: string | null
  name: string
  unit: string
  qty: string
  shape: string | null
  color: string | null
}

export type LocationSlot = {
  id: string
  code: string
  zone: string
  aisle: number
  level: string
  position: number
  occupied: boolean
  materialId: string | null
  materialName: string | null
  materials: LocationOccupant[]
}

export type LocationListResponse = {
  warehouse: { id: string; code: string; name: string; shortName: string }
  items: LocationSlot[]
}

export type GenerateLocationsPayload = {
  warehouseCode: string
  zone: string
  aisleCount: number
  levelCount: number
  positionCount: number
}

export type GenerateLocationsResult = {
  created: number
  skipped: number
  total: number
  from: string | null
  to: string | null
}

export function getLocationsApi(warehouseCode = 'nvl-chinh') {
  return apiFetch<LocationListResponse>(
    `/locations?warehouseCode=${encodeURIComponent(warehouseCode)}`,
  )
}

export function generateLocationsApi(payload: GenerateLocationsPayload) {
  return apiFetch<GenerateLocationsResult>('/locations/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteLocationApi(id: string) {
  return apiFetch<{ success: boolean }>(`/locations/${id}`, { method: 'DELETE' })
}

export type UpdateLocationPayload = {
  zone: string
  aisle: number
  level: string
  position: number
}

export function updateLocationApi(id: string, payload: UpdateLocationPayload) {
  return apiFetch<{
    id: string
    code: string
    zone: string
    aisle: number
    level: string
    position: number
  }>(`/locations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
