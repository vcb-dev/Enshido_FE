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
  { code: 'ton', name: 'Kho tồn' },
  { code: 'nhap', name: 'Kho nhập' },
  { code: 'xuat', name: 'Kho xuất' },
]

export function extraBinSections(binCode: string): Array<{ code: BinSectionCode; name: string }> {
  if (binCode === 'bac') {
    return [{ code: 'btp', name: 'Kho BTP chờ vào đá' }]
  }
  return []
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
  bac: [
    { sku: 'AG-999', name: 'Bạc 999', unit: 'gram', qty: 0 },
    { sku: 'AG-925', name: 'Bạc 925', unit: 'gram', qty: 0 },
    { sku: 'AG-WIRE', name: 'Dây bạc', unit: 'mét', qty: 0 },
  ],
  da: [
    { sku: 'ST-CZ', name: 'Đá CZ', unit: 'viên', qty: 0 },
    { sku: 'ST-SYN', name: 'Đá tổng hợp', unit: 'viên', qty: 0 },
    { sku: 'ST-NAT', name: 'Đá thiên nhiên', unit: 'viên', qty: 0 },
  ],
  'nvl-tieu-hao': [
    { sku: 'CS-GLUE', name: 'Keo gắn', unit: 'chai', qty: 0 },
    { sku: 'CS-SAND', name: 'Giấy nhám', unit: 'tờ', qty: 0 },
    { sku: 'CS-POL', name: 'Sáp đánh bóng', unit: 'thỏi', qty: 0 },
  ],
  'ban-thanh-pham': [
    { sku: 'SF-RNG', name: 'Nhẫn chờ vào đá', unit: 'chiếc', qty: 0 },
    { sku: 'SF-PDT', name: 'Mặt dây chờ vào đá', unit: 'chiếc', qty: 0 },
    { sku: 'SF-ERG', name: 'Bông tai chờ vào đá', unit: 'đôi', qty: 0 },
  ],
}

export const MOCK_IN: Record<string, StockMove[]> = {
  bac: [],
  da: [],
}

export const MOCK_OUT: Record<string, StockMove[]> = {
  bac: [],
  da: [],
}

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
  if (warehouse.bins?.length) {
    const bin = binCode ?? warehouse.bins[0].code
    const sec = section ?? 'ton'
    return `/kho/${warehouse.code}/${bin}/${sec}`
  }
  return `/kho/${warehouse.code}`
}
