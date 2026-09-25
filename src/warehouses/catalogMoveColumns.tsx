import type { ReactNode } from 'react'
import type { StockRow } from '../api/inventory'
import { ColumnHeaderFilter, type Column } from '../components/ui'
import type { StockProfile } from './catalog'

export type ColFilter = {
  valueId: string
  options: Array<{ id: string; name: string }>
  onChange: (id: string) => void
}

function filterCell(filter?: ColFilter): ReactNode {
  return filter ? <ColumnHeaderFilter {...filter} /> : undefined
}

export function catalogColumnsBeforeName<T>(
  profile: StockProfile,
  stockOf: (row: T) => StockRow | undefined,
  skuOf: (row: T) => string | null | undefined,
  filters: { location?: ColFilter; shape?: ColFilter; color?: ColFilter },
): Column<T>[] {
  const columns: Column<T>[] = []
  if (profile.showLocation) {
    columns.push({
      key: 'locationCode',
      header: 'Vị trí',
      width: 88,
      filter: filterCell(filters.location),
      render: (row) => stockOf(row)?.locationCode ?? '—',
    })
  }
  if (profile.showSku) {
    columns.push({
      key: 'sku',
      header: profile.skuLabel,
      width: 128,
      cellSx: { fontWeight: 700, whiteSpace: 'nowrap' },
      render: (row) => skuOf(row) ?? '—',
    })
  }
  if (profile.showShapeColor) {
    columns.push(
      {
        key: 'shape',
        header: 'Hình dạng',
        width: 96,
        filter: filterCell(filters.shape),
        render: (row) => stockOf(row)?.shape ?? '—',
      },
      {
        key: 'color',
        header: 'Màu sắc',
        width: 88,
        filter: filterCell(filters.color),
        render: (row) => stockOf(row)?.color ?? '—',
      },
    )
  }
  return columns
}

export function catalogColumnsAfterAmount<T>(
  profile: StockProfile,
  stockOf: (row: T) => StockRow | undefined,
  filters: { kind?: ColFilter; type?: ColFilter; bodyMetal?: ColFilter; productKind?: ColFilter },
): Column<T>[] {
  const columns: Column<T>[] = []
  if (profile.showNvlCategory || profile.showBtpCategory) {
    columns.push({
      key: 'kind',
      header: profile.showBtpCategory ? 'Danh mục BTP' : 'Danh mục',
      width: 110,
      filter: filterCell(filters.kind),
      render: (row) => {
        const stock = stockOf(row)
        return profile.showBtpCategory
          ? (stock?.otherClass ?? '—')
          : (stock?.metalKindLabel ?? '—')
      },
    })
  }
  if (profile.showType) {
    columns.push({
      key: 'type',
      header: profile.typeLabel,
      width: 110,
      filter: filterCell(filters.type),
      render: (row) => {
        const stock = stockOf(row)
        if (profile.typeCodes) {
          return stock?.otherClass ?? stock?.otherClassParent ?? stock?.materialType ?? '—'
        }
        return stock?.materialType ?? '—'
      },
    })
  }
  if (profile.showBodyMetal) {
    columns.push({
      key: 'bodyMetal',
      header: 'Chất liệu',
      width: 110,
      filter: filterCell(filters.bodyMetal),
      render: (row) => stockOf(row)?.bodyMetal ?? '—',
    })
  }
  if (profile.showProductKind) {
    columns.push({
      key: 'productKind',
      header: 'Phân loại sản phẩm',
      width: 130,
      filter: filterCell(filters.productKind),
      render: (row) => stockOf(row)?.productKind ?? '—',
    })
  }
  return columns
}
