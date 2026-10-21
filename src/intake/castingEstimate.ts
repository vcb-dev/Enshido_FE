/** 1 g sáp = 14 g bạc — tổng bạc ước tính cho phiếu đúc. */
export const WAX_TO_SILVER_RATIO = 14
/** Bạc 925 = 92.5% bạc nguyên chất, phần còn lại là hội pha. */
const S999_RATIO = 0.925

/** Ước tính vàng = TL sáp × hệ số theo K của mã NVL đã chọn. */
export const WAX_TO_GOLD_RATIO = { '10': 11, '14': 13, '18': 16, '24': 18 } as const
export type GoldKarat = keyof typeof WAX_TO_GOLD_RATIO
const GOLD_KARATS = Object.keys(WAX_TO_GOLD_RATIO) as GoldKarat[]

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

/** Đọc 10k/14k/18k/24k từ mã danh mục, SKU hoặc tên. Nhiều K khác nhau thì không đoán. */
export function goldKaratFromLabel(...parts: Array<string | null | undefined>): GoldKarat | null {
  const text = parts.filter(Boolean).join(' ')
  if (!text.trim()) return null
  const found = new Set<GoldKarat>()
  const lower = text.toLowerCase()
  for (const karat of GOLD_KARATS) {
    const asCode = new RegExp(`vang[-_]?${karat}k(?:$|[^a-z0-9])`, 'i')
    const asKarat = new RegExp(`(?:^|[^0-9])${karat}\\s*k(?:$|[^a-z0-9])`, 'i')
    if (asCode.test(lower) || asKarat.test(lower)) found.add(karat)
  }
  return found.size === 1 ? [...found][0] : null
}

export function goldEstimateFromWax(
  waxGram: number | string | null | undefined,
  karat: GoldKarat | null | undefined,
) {
  const n = Number(waxGram)
  if (!karat || !Number.isFinite(n) || n <= 0) return 0
  return round4(n * WAX_TO_GOLD_RATIO[karat])
}
