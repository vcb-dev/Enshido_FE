import { apiFetch } from './auth'
import type { OrderMetalType } from './intakeOrders'
import type { StageCode } from './productionOrders'

const BASE = '/loss-reports'

/** Khâu tính hao hụt: Đúc + 5 khâu thợ. */
export type LossStage = 'CASTING' | StageCode
export type LossMetal = 'SILVER' | 'GOLD'

export const LOSS_STAGE_LABEL: Record<LossStage, string> = {
  CASTING: 'Đúc',
  FILING: 'Nguội',
  STONE_SETTING: 'Vào đá',
  ENGRAVING: 'Khắc',
  POLISHING: 'Đánh bóng',
  PLATING: 'Xi',
}

export const LOSS_METAL_LABEL: Record<LossMetal, string> = { SILVER: 'Bạc', GOLD: 'Vàng' }

/** Tên cột TL giao theo kim loại — bạc và vàng tính riêng. */
export const lossInHeader = (metal: LossMetal) => `Tổng trọng lượng nguyên liệu ${LOSS_METAL_LABEL[metal].toLowerCase()} được giao`

/** Các vế theo cột tab BÁO CÁO: giao = hàng trả + BTP thu hồi + NVL thu hồi (+ mạt) + hao hụt. Số gram dạng chuỗi. */
export type LossSums = {
  tickets: number
  qty: number
  inGram: string
  productGram: string
  btpGram: string
  nvlGram: string
  returnedGram: string
  lossGram: string
  lossPercent: string | null
  limitPercent: string | null
}

export type LossWorkerRow = LossSums & {
  /** Thứ Hai của tuần. */
  week: string
  workerKey: string
  workerUserId: string | null
  workerName: string
  /** Mạt vụn thợ trả cuối tuần — chỉ trừ ở dòng tổng của thợ. */
  scrapGram: string
  stages: (LossSums & { stage: LossStage })[]
}

export type LossItem = {
  week: string
  workerKey: string
  stage: LossStage
  ticketCode: string
  attempt: number
  confirmedAt: string
  qty: number
  inGram: string
  productGram: string
  btpGram: string
  nvlGram: string
  lossGram: string
  lossPercent: string | null
}

export type ScrapReturn = {
  id: string
  week: string
  workerKey: string
  workerName: string
  weightGram: string
  note: string | null
  receivedAt: string
  receivedByName: string
}

export type WeeklyLossReport = {
  weeks: { start: string; end: string }[]
  metal: LossMetal
  /** QC đã nhận lại nhưng thủ kho chưa xác nhận — chưa tính vào tuần nào. */
  pendingCount: number
  limits: { stage: LossStage; percent: string | null }[]
  workers: LossWorkerRow[]
  items: LossItem[]
  scrapReturns: ScrapReturn[]
}

/** `from` / `to`: ngày bất kỳ trong tuần đầu / tuần cuối (YYYY-MM-DD). */
export function getWeeklyLossApi(params: { from: string; to: string; metal: LossMetal }) {
  const query = new URLSearchParams(params)
  return apiFetch<WeeklyLossReport>(`${BASE}/weekly?${query.toString()}`)
}

export type LossLimit = {
  stage: LossStage
  metal: LossMetal
  percent: string | null
  updatedByName: string | null
  updatedAt: string | null
}

export function getLossLimitsApi() {
  return apiFetch<LossLimit[]>(`${BASE}/limits`)
}

export function updateLossLimitsApi(limits: { stage: LossStage; metal: LossMetal; percent: number | null }[]) {
  return apiFetch<LossLimit[]>(`${BASE}/limits`, { method: 'PUT', body: JSON.stringify({ limits }) })
}

export type ScrapWorker = { id: string; fullName: string; username: string; workerStages: StageCode[] }

export function getScrapWorkersApi() {
  return apiFetch<ScrapWorker[]>(`${BASE}/workers`)
}

export function createScrapReturnApi(payload: {
  craftsmanUserId: string
  week: string
  metal: LossMetal
  /** Bắt buộc với mạt vàng — mỗi tuổi một mã NVL thu hồi. */
  goldType?: OrderMetalType
  weightGram: number
  note?: string
}) {
  return apiFetch<{ id: string }>(`${BASE}/scrap-returns`, { method: 'POST', body: JSON.stringify(payload) })
}

export function deleteScrapReturnApi(id: string) {
  return apiFetch<{ ok: true }>(`${BASE}/scrap-returns/${id}`, { method: 'DELETE' })
}
