export type WarehouseCode = 'nvl-chinh' | 'nvl-tieu-hao' | 'ban-thanh-pham'

export type StockBin = {
  code: string
  name: string
}

export type BinSectionCode = 'ton' | 'nhap' | 'xuat' | 'btp'

export type WarehouseDef = {
  code: WarehouseCode
  name: string
  shortName: string
  description: string
  bins?: StockBin[]
}

export const BIN_SECTIONS: Array<{ code: BinSectionCode; name: string }> = [
  { code: 'ton', name: 'Tồn' },
  { code: 'nhap', name: 'Nhập' },
  { code: 'xuat', name: 'Xuất' },
]

export function extraBinSections(binCode: string): Array<{ code: BinSectionCode; name: string }> {
  if (binCode === 'bac') {
    return [{ code: 'btp', name: 'Kho BTP chờ vào đá' }]
  }
  return []
}

/// Nhóm NVL chỉ dùng cho kho tiêu hao — không hiện ở dropdown của kho đá/bạc.
const CONSUMABLE_TYPE_CODES = ['ccdc', 'nvl-phu']

/// Cột nào hiện trên bảng tồn kho, tuỳ đặc thù từng kho.
export type StockProfile = {
  showSku: boolean
  showLocation: boolean
  showShapeColor: boolean
  /// Hiện cột Tồn thực tế + Chênh lệch (kiểm kê tay đối chiếu sổ sách).
  showStockCount: boolean
  typeLabel: string
  /// Whitelist mã nhóm NVL. Bỏ trống = tất cả trừ nhóm của kho tiêu hao.
  typeCodes?: string[]
}

const DEFAULT_STOCK_PROFILE: StockProfile = {
  showSku: true,
  showLocation: true,
  showShapeColor: true,
  showStockCount: false,
  typeLabel: 'Loại đá',
}

const STOCK_PROFILES: Record<string, StockProfile> = {
  da: { ...DEFAULT_STOCK_PROFILE, showSku: false },
  'nvl-tieu-hao': {
    showSku: true,
    showLocation: false,
    showShapeColor: false,
    showStockCount: true,
    typeLabel: 'Nhóm',
    typeCodes: CONSUMABLE_TYPE_CODES,
  },
}

export function stockProfile(code: string): StockProfile {
  return STOCK_PROFILES[code] ?? DEFAULT_STOCK_PROFILE
}

/// Lọc danh mục nhóm NVL cho đúng kho đang mở.
export function materialTypesFor<T extends { code: string }>(
  profile: StockProfile,
  types: T[],
) {
  if (profile.typeCodes) {
    return types.filter((item) => profile.typeCodes?.includes(item.code))
  }
  return types.filter((item) => !CONSUMABLE_TYPE_CODES.includes(item.code))
}

export const WAREHOUSES: WarehouseDef[] = [
  {
    code: 'nvl-chinh',
    name: 'Kho nguyên vật liệu chính',
    shortName: 'Kho NVL chính',
    description: 'Gồm kho bạc (kèm BTP chờ vào đá) và kho đá.',
    bins: [
      { code: 'bac', name: 'Kho bạc' },
      { code: 'da', name: 'Kho đá' },
    ],
  },
  {
    code: 'nvl-tieu-hao',
    name: 'Kho nguyên vật liệu tiêu hao',
    shortName: 'Kho NVL tiêu hao',
    description: 'Vật tư tiêu hao phục vụ sản xuất.',
  },
]

export function warehouseByCode(code: string) {
  return WAREHOUSES.find((w) => w.code === code)
}

export function binSectionByCode(code?: string, binCode?: string) {
  if (!code) return undefined
  return (
    BIN_SECTIONS.find((s) => s.code === code) ??
    extraBinSections(binCode ?? '').find((s) => s.code === code)
  )
}

export function stockWarehouseCode(
  warehouse: WarehouseDef,
  binCode?: string,
  section?: string,
) {
  if (section === 'btp') return 'ban-thanh-pham'
  return binCode ?? warehouse.code
}

export function warehousePath(
  warehouse: WarehouseDef,
  binCode?: string,
  section?: BinSectionCode,
) {
  const sec = section ?? 'ton'
  if (warehouse.bins?.length) {
    const bin = binCode ?? warehouse.bins[0].code
    return `/kho/${warehouse.code}/${bin}/${sec}`
  }
  return `/kho/${warehouse.code}/${sec}`
}
