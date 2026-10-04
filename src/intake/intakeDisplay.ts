import { formatQty } from '../api/inventory'

export function formatIntakeGram(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return `${formatQty(String(n))} g`
}
