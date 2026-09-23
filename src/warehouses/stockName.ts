function foldStockName(value: string) {
  return value.trim().toLocaleLowerCase('vi')
}

/** Tên nhập tay trên Tồn — trùng kho hoặc trùng dòng khác trên form thì báo. */
export function validateStockName(
  value: unknown,
  {
    existing,
    self,
    siblings,
    label,
  }: {
    existing: string[]
    self?: string | null
    siblings?: string[]
    label: string
  },
) {
  const name = foldStockName(String(value ?? ''))
  if (!name) return true
  if (self && foldStockName(self) === name) return true
  if (siblings?.some((item) => foldStockName(item) === name)) {
    return `${label} trùng với dòng khác trên form`
  }
  const names = new Set(existing.map(foldStockName))
  if (names.has(name)) {
    return `${label} này đã có trên Tồn`
  }
  return true
}
