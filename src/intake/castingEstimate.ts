/** 1 g sáp = 24 g bạc — ước tính S999 / Hội / S925 trên phiếu đúc. */
export const WAX_TO_SILVER_RATIO = 24

export function silverEstimateFromWax(
  waxGram: number | string | null | undefined,
): number {
  const n = Number(waxGram)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * WAX_TO_SILVER_RATIO * 10_000) / 10_000
}
