export type WarehouseCode = 'nvl-chinh' | 'btp-cho-vao-da' | 'nvl-tieu-hao'

export type WarehouseSectionCode = 'ton' | 'nhap' | 'xuat'

export type WarehouseDef = {
  code: WarehouseCode
  name: string
  shortName: string
  description: string
  sections?: boolean
}

export const WAREHOUSE_SECTIONS: Array<{ code: WarehouseSectionCode; name: string }> = [
  { code: 'ton', name: 'Kho tồn' },
  { code: 'nhap', name: 'Kho nhập' },
  { code: 'xuat', name: 'Kho xuất' },
]

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
    name: 'Kho BTP chờ vào đá',
    shortName: 'Kho BTP chờ vào đá',
    description: 'Sổ bán thành phẩm chờ gắn đá — không nhập / xuất / tồn.',
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
  // Vật tư tiêu hao không có hình dạng / màu / vị trí kệ, nhưng cần kiểm kê tay.
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
export function materialTypesFor<T extends { code: string }>(profile: StockProfile, types: T[]) {
  if (profile.typeCodes) {
    return types.filter((item) => profile.typeCodes?.includes(item.code))
  }
  return types.filter((item) => !CONSUMABLE_TYPE_CODES.includes(item.code))
}

export type MetalKindCode = 'SILVER' | 'GOLD' | 'STONE' | 'ALLOY' | 'COPPER'

export const METAL_KINDS: Array<{ code: MetalKindCode; name: string }> = [
  { code: 'SILVER', name: 'Bạc' },
  { code: 'GOLD', name: 'Vàng' },
  { code: 'STONE', name: 'Đá' },
  { code: 'ALLOY', name: 'Hội pha' },
  { code: 'COPPER', name: 'Đồng' },
]

export type StockItem = {
  sku: string
  name: string
  unit: string
  qty: number
  note?: string
}

export type StockMove = {
  docNo: string
  date: string
  sku: string
  name: string
  qty: number
  unit: string
  note?: string
}

export const MOCK_STOCK: Record<string, StockItem[]> = {
  'nvl-tieu-hao': [
    { sku: 'CS-GLUE', name: 'Keo gắn', unit: 'chai', qty: 0 },
    { sku: 'CS-SAND', name: 'Giấy nhám', unit: 'tờ', qty: 0 },
    { sku: 'CS-POL', name: 'Sáp đánh bóng', unit: 'thỏi', qty: 0 },
  ],
}

export const MOCK_IN: Record<string, StockMove[]> = {}

export const MOCK_OUT: Record<string, StockMove[]> = {}

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
    return `/kho/${warehouse.code}/${section ?? 'ton'}`
  }
  return `/kho/${warehouse.code}`
}
