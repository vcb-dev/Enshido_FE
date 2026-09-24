import { apiFetch } from './auth'

export type EditLogRow = {
  id: string
  reason: string
  changedBy: string
  changedAt: string
}

export function listEditLogsApi(entityType: string, entityId: string) {
  const query = new URLSearchParams({ entityType, entityId })
  return apiFetch<EditLogRow[]>(`/edit-logs?${query.toString()}`)
}
