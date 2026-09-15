import type { StockProfile } from './catalog'

export const CATALOG_FILTER_DEFAULTS = {
  shape: '',
  location: '',
  stone: '',
  kind: '',
  bodyMetal: '',
  productKind: '',
}

export type CatalogFilterValues = {
  shape: string
  location: string
  stone: string
  kind: string
  bodyMetal: string
  productKind: string
}

export type CatalogFilterRow = {
  shapeId?: string | null
  shape?: string | null
  locationCode?: string | null
  materialTypeId?: string | null
  materialType?: string | null
  otherClassId?: string | null
  otherClass?: string | null
  otherClassParentId?: string | null
  otherClassParent?: string | null
  metalKind?: string | null
  bodyMetalId?: string | null
  bodyMetal?: string | null
  productKindId?: string | null
  productKind?: string | null
}

export function hasActiveCatalogFilters(params: CatalogFilterValues) {
  return Boolean(
    params.shape ||
      params.location ||
      params.stone ||
      params.kind ||
      params.bodyMetal ||
      params.productKind,
  )
}

/** Dòng không có snapshot tồn (phiếu cũ / chưa gắn NVL) bị loại khi đang lọc danh mục. */
export function matchesCatalogFilters(
  row: CatalogFilterRow | undefined,
  params: CatalogFilterValues,
  profile: StockProfile,
) {
  if (!hasActiveCatalogFilters(params)) return true
  if (!row) return false
  if (params.shape && row.shapeId !== params.shape && row.shape !== params.shape) return false
  if (params.location && (row.locationCode ?? '') !== params.location) return false
  if (
    params.stone &&
    row.materialTypeId !== params.stone &&
    row.materialType !== params.stone &&
    row.otherClassId !== params.stone &&
    row.otherClass !== params.stone &&
    row.otherClassParentId !== params.stone &&
    row.otherClassParent !== params.stone
  ) {
    return false
  }
  if (profile.showBtpCategory) {
    if (params.kind && row.otherClassId !== params.kind && row.otherClass !== params.kind) {
      return false
    }
  } else if (params.kind === 'OTHER') {
    if (!row.otherClassId) return false
  } else if (params.kind && row.metalKind !== params.kind) {
    return false
  }
  if (params.bodyMetal && row.bodyMetalId !== params.bodyMetal && row.bodyMetal !== params.bodyMetal) {
    return false
  }
  if (
    params.productKind &&
    row.productKindId !== params.productKind &&
    row.productKind !== params.productKind
  ) {
    return false
  }
  return true
}

export function headerTotal(
  label: string,
  value: string | undefined,
  format: (value: string) => string,
) {
  return value == null ? label : `${label} (${format(value)})`
}

export function uniqueNameOptions(values: Array<string | null | undefined>) {
  const names = new Set<string>()
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) names.add(trimmed)
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .map((name) => ({ value: name, label: name }))
}

export function uniqueFilterOptions(values: Array<string | null | undefined>) {
  return uniqueNameOptions(values).map((item) => ({ id: item.value, name: item.label }))
}

export function sumMoveTotals(rows: Array<{ qty: string; amount: string }>) {
  return {
    qty: String(rows.reduce((acc, row) => acc + (Number(row.qty) || 0), 0)),
    amount: String(rows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0)),
  }
}

export function upsertMoveList<
  T extends { id: string; qty: string; amount: string },
  L extends { items: T[]; totals: { qty: string; amount: string } },
>(current: L | undefined, row: T, replace: boolean): L | undefined {
  if (!current) return current
  const items = replace
    ? current.items.map((item) => (item.id === row.id ? row : item))
    : [...current.items, row]
  return { ...current, items, totals: sumMoveTotals(items) }
}

export function removeMoveList<
  T extends { id: string; qty: string; amount: string },
  L extends { items: T[]; totals: { qty: string; amount: string } },
>(current: L | undefined, id: string): L | undefined {
  if (!current) return current
  const items = current.items.filter((item) => item.id !== id)
  return { ...current, items, totals: sumMoveTotals(items) }
}
