export type WarehouseCode = 'nvl-chinh' | 'btp-cho-vao-da' | 'nvl-tieu-hao'

export type WarehouseSectionCode = 'stock' | 'inbound' | 'outbound'

export type WarehouseDef = {
  code: WarehouseCode
  name: string
  shortName: string
  description: string
  sections?: boolean
}

export const WAREHOUSE_SECTIONS: Array<{ code: WarehouseSectionCode; name: string }> = [
  { code: 'stock', name: 'Tồn' },
  { code: 'inbound', name: 'Nhập' },
  { code: 'outbound', name: 'Xuất' },
]

/** Mã mục kho trên URL cũ (/kho/nvl-chinh/ton) → mã hiện tại. */
export const LEGACY_SECTION_CODES: Record<string, WarehouseSectionCode> = {
  ton: 'stock',
  nhap: 'inbound',
  xuat: 'outbound',
}

export const WAREHOUSES: WarehouseDef[] = [
  {
    code: 'nvl-chinh',
    name: 'Kho nguyên vật liệu chính',
    shortName: 'Kho NVL chính',
    description: 'Nhập, xuất và tồn nguyên vật liệu chính.',
    sections: true,
  },
  {
    code: 'btp-cho-vao-da',
    name: 'Kho BTP',
    shortName: 'Kho BTP',
    description: 'Nhập, xuất và tồn bán thành phẩm. Xuất từ kho khác có thể chuyển sang đây.',
    sections: true,
  },
  {
    code: 'nvl-tieu-hao',
    name: 'Kho nguyên vật liệu tiêu hao',
    shortName: 'Kho NVL tiêu hao',
    description: 'Nhập, xuất và tồn vật tư tiêu hao phục vụ sản xuất.',
    sections: true,
  },
]

const CONSUMABLE_TYPE_CODES = ['ccdc', 'nvl-phu']

/// Cột nào hiện trên bảng tồn kho, tuỳ đặc thù từng kho.
export type StockProfile = {
  showSku: boolean
  showLocation: boolean
  showShapeColor: boolean
  showType: boolean
  showBodyMetal: boolean
  showProductKind: boolean
  showBtpCategory: boolean
  showNvlCategory: boolean
  showStatus: boolean
  typeLabel: string
  /// Whitelist mã nhóm NVL. Bỏ trống = tất cả trừ nhóm của kho tiêu hao.
  typeCodes?: string[]
  noun: string
  nameLabel: string
  skuLabel: string
  categoryLabel: string
  createLabel: string
  inboundLabel: string
  outboundLabel: string
  searchPlaceholder: string
  emptyText: string
  emptyFiltered: string
}

const NVL_COPY = {
  noun: 'NVL',
  nameLabel: 'Tên NVL',
  skuLabel: 'Mã NVL',
  categoryLabel: 'Danh mục NVL',
  createLabel: 'Nhập NVL',
  inboundLabel: 'Nhập NVL',
  outboundLabel: 'Xuất NVL',
  searchPlaceholder: 'Tìm tên NVL hoặc mã…',
  emptyText: 'Chưa có hàng tồn. Bấm Nhập NVL để tạo tên hàng.',
  emptyFiltered: 'Không có NVL khớp bộ lọc.',
}

const DEFAULT_STOCK_PROFILE: StockProfile = {
  showSku: true,
  showLocation: true,
  showShapeColor: true,
  showType: true,
  showBodyMetal: false,
  showProductKind: false,
  showBtpCategory: false,
  showNvlCategory: true,
  showStatus: true,
  typeLabel: 'Chất loại',
  ...NVL_COPY,
}

const STOCK_PROFILES: Record<string, StockProfile> = {
  'btp-cho-vao-da': {
    showSku: true,
    showLocation: false,
    showShapeColor: false,
    showType: false,
    showBodyMetal: true,
    showProductKind: true,
    showBtpCategory: true,
    showNvlCategory: false,
    showStatus: false,
    typeLabel: 'Chất loại',
    noun: 'BTP',
    nameLabel: 'Tên BTP',
    skuLabel: 'Mã BTP',
    categoryLabel: 'Danh mục BTP',
    createLabel: 'Nhập BTP',
    inboundLabel: 'Nhập BTP',
    outboundLabel: 'Xuất BTP',
    searchPlaceholder: 'Tìm tên BTP hoặc mã…',
    emptyText: 'Chưa có hàng tồn. Bấm Nhập BTP để tạo tên hàng.',
    emptyFiltered: 'Không có BTP khớp bộ lọc.',
  },
  // Vật tư tiêu hao không có hình dạng / màu / vị trí kệ.
  'nvl-tieu-hao': {
    showSku: true,
    showLocation: false,
    showShapeColor: false,
    showType: true,
    showBodyMetal: false,
    showProductKind: false,
    showBtpCategory: false,
    showNvlCategory: false,
    showStatus: true,
    typeLabel: 'Danh mục',
    typeCodes: CONSUMABLE_TYPE_CODES,
    ...NVL_COPY,
  },
}

export function stockProfile(code: string): StockProfile {
  return STOCK_PROFILES[code] ?? DEFAULT_STOCK_PROFILE
}

/// Lọc danh mục nhóm NVL cho đúng kho đang mở.
export function materialTypesFor<T extends { code: string }>(profile: StockProfile, types: T[]) {
  if (profile.typeCodes) {
    return types.filter((item) => profile.typeCodes?.includes(item.code))
  }
  return types.filter((item) => !CONSUMABLE_TYPE_CODES.includes(item.code))
}

export function catalogChildren(
  parents: Array<{ code: string; children?: Array<{ id: string; code: string; name: string }> }> | undefined,
  code: string,
) {
  return (parents?.find((row) => row.code === code)?.children ?? []).map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
  }))
}

export function withFallback<T>(primary: T[] | undefined, fallback: T[]) {
  return primary?.length ? primary : fallback
}

export type MetalKindCode = 'SILVER' | 'GOLD' | 'STONE' | 'ALLOY' | 'COPPER'

export const METAL_KINDS: Array<{ code: MetalKindCode; name: string }> = [
  { code: 'SILVER', name: 'Bạc' },
  { code: 'GOLD', name: 'Vàng' },
  { code: 'STONE', name: 'Đá' },
  { code: 'ALLOY', name: 'Hội pha' },
  { code: 'COPPER', name: 'Đồng' },
]

export const OTHER_CATEGORY = { code: 'OTHER' as const, name: 'Phân loại khác' }

export const CATEGORY_GROUPS: Array<{ code: MetalKindCode | 'OTHER'; name: string }> = [
  ...METAL_KINDS,
  OTHER_CATEGORY,
]

export const CONSUMABLE_CATEGORIES: Array<{ code: string; name: string }> = [
  { code: 'ccdc', name: 'CCDC' },
  { code: 'nvl-phu', name: 'NVL phụ' },
  { code: 'nvl-chinh', name: 'NVL chính' },
]

export function warehouseByCode(code: string) {
  return WAREHOUSES.find((w) => w.code === code)
}

export function warehouseSectionByCode(code?: string) {
  if (!code) return undefined
  return WAREHOUSE_SECTIONS.find((s) => s.code === code)
}

export function stockWarehouseCode(warehouse: WarehouseDef) {
  return warehouse.code
}

export function warehousePath(warehouse: WarehouseDef, section?: WarehouseSectionCode) {
  if (warehouse.sections) {
    return `/warehouses/${warehouse.code}/${section ?? 'stock'}`
  }
  return `/warehouses/${warehouse.code}`
}
