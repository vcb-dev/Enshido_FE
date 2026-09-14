import { useMemo } from 'react'
import type { InventoryLookups, StockRow } from '../api/inventory'
import {
  CATEGORY_GROUPS,
  catalogChildren,
  withFallback,
  type StockProfile,
} from './catalog'
import { uniqueFilterOptions } from './stockFilters'

export function useCatalogFilterOptions(
  profile: StockProfile,
  lookups: InventoryLookups | undefined,
  btpParents: Array<{ code: string; children?: Array<{ id: string; code: string; name: string }> }> | undefined,
  stockItems: StockRow[],
) {
  const colorOptions = useMemo(() => {
    const fromLookups = (lookups?.colors ?? []).map((item) => ({ id: item.id, name: item.name }))
    const extra = uniqueFilterOptions(stockItems.map((row) => row.color)).filter(
      (item) => !fromLookups.some((row) => row.id === item.id || row.name === item.name),
    )
    return [...fromLookups, ...extra]
  }, [stockItems, lookups?.colors])

  const typeFilterOptions = useMemo(() => {
    if (profile.typeCodes) return lookups?.consumableCategories ?? []
    return [...(lookups?.materialTypes ?? []), ...(lookups?.otherClasses ?? [])]
  }, [lookups, profile.typeCodes])

  const kindFilterOptions = useMemo(() => {
    if (profile.showBtpCategory) {
      return withFallback(lookups?.btpCategories, catalogChildren(btpParents, 'danh-muc-btp'))
    }
    return CATEGORY_GROUPS.map((item) => ({ id: item.code, name: item.name }))
  }, [lookups?.btpCategories, btpParents, profile.showBtpCategory])

  const shapeOptions = lookups?.shapes ?? []
  const bodyMetalOptions = withFallback(
    lookups?.bodyMetals,
    catalogChildren(btpParents, 'chat-lieu'),
  )
  const productKindOptions = withFallback(
    lookups?.productKinds,
    catalogChildren(btpParents, 'phan-loai-san-pham'),
  )

  return {
    colorOptions,
    typeFilterOptions,
    kindFilterOptions,
    shapeOptions,
    bodyMetalOptions,
    productKindOptions,
  }
}
