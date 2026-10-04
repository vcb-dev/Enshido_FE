import { apiFetch } from './auth'
import type { IntakeOrder } from './intakeOrders'

export type WorkflowRevision = {
  intake: string
  production: string
  casting: string
  cut: string
}

export function getWorkflowRevisionApi() {
  return apiFetch<WorkflowRevision>('/workflow/revision')
}

export function getWorkflowIntakeLiveApi() {
  return apiFetch<{ items: IntakeOrder[] }>('/workflow/intake-live')
}
