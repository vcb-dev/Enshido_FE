import type { ProductionOrderLookups, StageCode } from '../api/productionOrders'

/** Thợ trong dialog giao khâu, kèm các khâu được làm (gán ở màn Nhân sự). */
export type StageWorker = { id: string; username: string; fullName: string; stages: StageCode[] }

/** Tài khoản chọn được làm thợ; admin chỉ hiện khi người giao là admin (BE cũng chặn). */
export function stageWorkersFrom(lookups: ProductionOrderLookups | undefined, viewerIsAdmin: boolean): StageWorker[] {
  if (!lookups) return []
  const adminIds = new Set(lookups.adminIds ?? [])
  return lookups.users
    .filter((user) => lookups.workerIds.includes(user.id) && (viewerIsAdmin || !adminIds.has(user.id)))
    .map((user) => ({ ...user, stages: lookups.workerStages?.[user.id] ?? [] }))
}

/**
 * Chỉ thợ được làm đúng khâu đang giao — kể cả tài khoản admin: admin muốn nhận khâu nào thì
 * gán khâu đó ở màn Nhân sự như thợ. Chọn sai thì BE từ chối, đừng để thủ kho chọn được.
 */
export function workersForStage(workers: StageWorker[], stage: StageCode | '' | null): StageWorker[] {
  if (!stage) return []
  return workers.filter((worker) => worker.stages.includes(stage))
}
