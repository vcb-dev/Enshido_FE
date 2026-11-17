import type { StageEntry } from '../api/productionOrders'
import { SILVER_LOSS_LIMITS } from './catalog'

/** Nhận lại nặng hơn đầu vào quá mức này (g) thì coi là bất thường — cân lại. */
export const STONE_GAIN_TOLERANCE = 0.05

export type StoneConfirmCheck = {
  silverIn: number
  /** Đá thực tế = Σ (TL gói cấp − TL gói thừa QC cân). */
  stoneIssued: number
  stoneLeft: number
  stoneUsed: number
  /** TL QC cân lại hàng đạt + hàng lỗi + nguyên liệu thừa thu hồi. */
  out: number
  /** Hao theo đá thực tế (g) = bạc vào khâu + đá thực tế − TL ra. Âm = nhận lại nặng hơn. */
  loss: number
  /** % hao trên bạc vào khâu — cùng cách tính hao hụt trên phiếu. */
  percent: number
  /** 'gain' = nặng hơn đầu vào; 'high' = hao vượt mức đỏ của khâu. */
  issue: 'gain' | 'high' | null
}

const num = (value: string | null | undefined) => (value == null || value === '' ? 0 : Number(value))
const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits

/**
 * Đối chiếu TL sau Vào đá với đá thực tế lúc thủ kho xác nhận. Hao hụt trên phiếu dùng TL đá theo
 * 3D làm mốc, nên không lộ được trường hợp QC ghi gói đá thừa sai (vd. ghi 0 khi còn đá thừa) — ở đây
 * dùng TL gói cấp − TL gói thừa. Trả null khi không đủ số liệu (không phải Vào đá, chưa cân, có gói
 * đá không cân TL).
 */
export function stoneConfirmCheck(entry: StageEntry | null): StoneConfirmCheck | null {
  if (!entry || entry.stage !== 'STONE_SETTING') return null
  if (entry.silverIn == null || entry.returnedSilverWeight == null) return null
  const lines = entry.stoneLines ?? []
  if (lines.length === 0 || lines.some((line) => line.weight == null)) return null
  const silverIn = num(entry.silverIn)
  if (silverIn <= 0) return null
  const stoneIssued = lines.reduce((sum, line) => sum + num(line.weight), 0)
  const stoneLeft = lines.reduce((sum, line) => sum + num(line.returnedWeight), 0)
  const stoneUsed = stoneIssued - stoneLeft
  const out =
    num(entry.returnedSilverWeight) +
    num(entry.btpRecoveredWeight) +
    num(entry.silverRecoveredWeight) +
    num(entry.scrapS999Weight)
  const loss = silverIn + stoneUsed - out
  const percent = (loss / silverIn) * 100
  const issue =
    loss < -STONE_GAIN_TOLERANCE ? 'gain' : percent > SILVER_LOSS_LIMITS.warn ? 'high' : null
  return {
    silverIn: round(silverIn),
    stoneIssued: round(stoneIssued),
    stoneLeft: round(stoneLeft),
    stoneUsed: round(stoneUsed),
    out: round(out),
    loss: round(loss),
    percent: round(percent, 1),
    issue,
  }
}
