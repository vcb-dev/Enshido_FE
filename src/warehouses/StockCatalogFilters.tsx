import type { LookupItem } from '../api/inventory'
import { SearchSelect, type SearchSelectOption } from './SearchSelect'
import {
  CATEGORY_GROUPS,
  catalogChildren,
  withFallback,
  type StockProfile,
} from './catalog'
import type { CatalogFilterValues } from './stockFilters'

const FIELD_SX = {
  shape: { flex: '1 1 150px', minWidth: 150, maxWidth: 220 },
  location: { flex: '1 1 140px', minWidth: 140, maxWidth: 200 },
  type: { flex: '1 1 150px', minWidth: 150, maxWidth: 220 },
  category: { flex: '1 1 140px', minWidth: 140, maxWidth: 200 },
  btpCategory: { flex: '1 1 160px', minWidth: 160, maxWidth: 220 },
  bodyMetal: { flex: '1 1 140px', minWidth: 140, maxWidth: 200 },
  productKind: { flex: '1 1 170px', minWidth: 170, maxWidth: 240 },
} as const

type CatalogLookups = {
  shapes?: LookupItem[]
  materialTypes?: LookupItem[]
  otherClasses?: LookupItem[]
  consumableCategories?: LookupItem[]
  btpCategories?: LookupItem[]
  bodyMetals?: LookupItem[]
  productKinds?: LookupItem[]
}

export function StockCatalogFilters({
  profile,
  lookups,
  btpParents,
  locationOptions,
  values,
  onChange,
}: {
  profile: StockProfile
  lookups?: CatalogLookups
  btpParents?: Array<{ code: string; children?: Array<{ id: string; code: string; name: string }> }>
  locationOptions?: SearchSelectOption[]
  values: CatalogFilterValues
  onChange: (patch: Partial<CatalogFilterValues>) => void
}) {
  return (
    <>
      {profile.showShapeColor ? (
        <SearchSelect
          label="Hình dạng"
          valueId={values.shape}
          options={lookups?.shapes ?? []}
          allowClear
          size="small"
          disablePortal={false}
          placeholder="Tìm hình dạng…"
          sx={FIELD_SX.shape}
          onChange={(id) => onChange({ shape: id })}
        />
      ) : null}
      {profile.showLocation ? (
        <SearchSelect
          label="Vị trí"
          valueId={values.location}
          options={locationOptions ?? []}
          allowClear
          size="small"
          disablePortal={false}
          placeholder="Tìm vị trí…"
          sx={FIELD_SX.location}
          onChange={(id) => onChange({ location: id })}
        />
      ) : null}
      {profile.showType ? (
        <SearchSelect
          label={profile.typeLabel}
          valueId={values.stone}
          options={
            profile.typeCodes
              ? (lookups?.consumableCategories ?? [])
              : [...(lookups?.materialTypes ?? []), ...(lookups?.otherClasses ?? [])]
          }
          allowClear
          size="small"
          disablePortal={false}
          placeholder={`Tìm ${profile.typeLabel.toLowerCase()}…`}
          sx={FIELD_SX.type}
          onChange={(id) => onChange({ stone: id })}
        />
      ) : null}
      {profile.showNvlCategory ? (
        <SearchSelect
          label="Danh mục"
          valueId={values.kind}
          options={CATEGORY_GROUPS.map((item) => ({ id: item.code, name: item.name }))}
          allowClear
          size="small"
          disablePortal={false}
          placeholder="Tìm danh mục…"
          sx={FIELD_SX.category}
          onChange={(id) => onChange({ kind: id })}
        />
      ) : null}
      {profile.showBtpCategory ? (
        <SearchSelect
          label="Danh mục BTP"
          valueId={values.kind}
          options={withFallback(
            lookups?.btpCategories,
            catalogChildren(btpParents, 'danh-muc-btp'),
          )}
          allowClear
          size="small"
          disablePortal={false}
          placeholder="Tìm danh mục BTP…"
          sx={FIELD_SX.btpCategory}
          onChange={(id) => onChange({ kind: id })}
        />
      ) : null}
      {profile.showBodyMetal ? (
        <SearchSelect
          label="Chất liệu"
          valueId={values.bodyMetal}
          options={withFallback(lookups?.bodyMetals, catalogChildren(btpParents, 'chat-lieu'))}
          allowClear
          size="small"
          disablePortal={false}
          placeholder="Tìm chất liệu…"
          sx={FIELD_SX.bodyMetal}
          onChange={(id) => onChange({ bodyMetal: id })}
        />
      ) : null}
      {profile.showProductKind ? (
        <SearchSelect
          label="Phân loại sản phẩm"
          valueId={values.productKind}
          options={withFallback(
            lookups?.productKinds,
            catalogChildren(btpParents, 'phan-loai-san-pham'),
          )}
          allowClear
          size="small"
          disablePortal={false}
          placeholder="Tìm phân loại…"
          sx={FIELD_SX.productKind}
          onChange={(id) => onChange({ productKind: id })}
        />
      ) : null}
    </>
  )
}
