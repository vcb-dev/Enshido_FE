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
    description: 'Vật tư tiêu hao phục vụ sản xuất.',
  },
]

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
