/** 1 g sáp = 24 g bạc — tổng bạc ước tính cho phiếu đúc. */
export const WAX_TO_SILVER_RATIO = 24
/** Bạc 925 = 92.5% bạc nguyên chất, phần còn lại là hội pha. */
const S999_RATIO = 0.925

export type SilverEstimate = {
  s999: number
  masterAlloy: number
  s925: number
  total: number
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000

/**
 * Ước tính bạc cấp cho phiếu đúc. Nửa tổng là S925, nửa còn lại nấu ra từ
 * S999 (92.5%) và hội pha (phần dư) nên ba dòng cộng lại đúng bằng tổng.
 */
export function silverEstimateFromWax(
  waxGram: number | string | null | undefined,
): SilverEstimate {
  const n = Number(waxGram)
  if (!Number.isFinite(n) || n <= 0) {
    return { s999: 0, masterAlloy: 0, s925: 0, total: 0 }
  }
  const total = n * WAX_TO_SILVER_RATIO
  const half = total / 2
  const s999 = half * S999_RATIO
  return {
    s999: round4(s999),
    masterAlloy: round4(half - s999),
    s925: round4(half),
    total: round4(total),
  }
}
