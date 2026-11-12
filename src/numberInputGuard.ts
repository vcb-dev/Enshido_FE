/**
 * Ô `type="number"` (số lượng, số viên…): Chrome đổi số khi lăn chuột lúc con trỏ đang đứng trên ô đã
 * chọn — người dùng cuộn hộp thoại là số lặng lẽ tăng / giảm. Lăn chuột trên ô thì bỏ chọn ô để chỉ cuộn
 * trang. Đồng thời chặn gõ e / + / - (Chrome nhận "1e5" = 100000, "-3"), các ô này đều là số không âm.
 */
const isNumberInput = (el: EventTarget | null): el is HTMLInputElement =>
  el instanceof HTMLInputElement && el.type === 'number'

export function guardNumberInputs() {
  document.addEventListener(
    'wheel',
    (event) => {
      const el = document.activeElement
      if (isNumberInput(el) && event.target === el) el.blur()
    },
    { passive: true, capture: true },
  )
  document.addEventListener(
    'keydown',
    (event) => {
      if (isNumberInput(event.target) && ['e', 'E', '+', '-'].includes(event.key)) event.preventDefault()
    },
    { capture: true },
  )
}
