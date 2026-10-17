/** Vị trí trên form Nhập NVL — trùng dòng khác hoặc ô kệ đã có hàng thì báo ngay. */
export function validateStockLocation(
  value: unknown,
  {
    occupied,
    self,
    siblings,
  }: {
    occupied: Array<{ code: string; materialName?: string | null }>
    self?: string | null
    siblings?: string[]
  },
) {
  const code = String(value ?? '').trim()
  if (!code) return true
  if (self && self === code) return true
  if (siblings?.some((item) => item.trim() === code)) {
    return `Vị trí ${code} trùng với dòng khác trên form`
  }
  const taken = occupied.find((slot) => slot.code === code)
  if (taken) {
    return taken.materialName
      ? `Vị trí ${code} đang dùng cho ${taken.materialName}`
      : `Vị trí ${code} đang được dùng`
  }
  return true
}
