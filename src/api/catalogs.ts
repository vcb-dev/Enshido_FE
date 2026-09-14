import { apiFetch } from './auth'

export type CatalogKind = 'CATALOG' | 'OTHER'

export type CatalogItem = {
  id: string
  code: string
  name: string
  kind: CatalogKind
  parentId: string | null
  sortOrder: number
  children?: CatalogItem[]
}

export function listCatalogsApi(kind: CatalogKind = 'CATALOG') {
  return apiFetch<CatalogItem[]>(`/catalogs?kind=${kind}`)
}

export function createCatalogApi(payload: {
  name: string
  kind?: CatalogKind
  parentId?: string | null
  sortOrder?: number
}) {
  return apiFetch<CatalogItem>('/catalogs', { method: 'POST', json: payload })
}

export function updateCatalogApi(
  id: string,
  payload: { name?: string; parentId?: string | null; sortOrder?: number },
) {
  return apiFetch<CatalogItem>(`/catalogs/${id}`, { method: 'PATCH', json: payload })
}

export function deleteCatalogApi(id: string) {
  return apiFetch<{ success: boolean }>(`/catalogs/${id}`, { method: 'DELETE' })
}
