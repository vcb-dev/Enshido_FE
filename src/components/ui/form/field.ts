import type { Control, FieldPath, FieldValues, UseControllerProps } from 'react-hook-form'

export type FieldRules<T extends FieldValues> = UseControllerProps<T>['rules']

/** Props mà mọi field nối với react-hook-form đều nhận. */
export type FormFieldBaseProps<T extends FieldValues> = {
  name: FieldPath<T>
  /**
   * Bỏ trống khi field nằm trong [Form](./Form.tsx) — khi đó lấy control từ
   * FormProvider. Chỉ truyền khi dùng field ngoài `<Form>`.
   */
  control?: Control<T>
  rules?: FieldRules<T>
  /** Hiện dấu * và tự thêm rule `required` nếu `rules` chưa khai báo. */
  required?: boolean
}

export const REQUIRED_MESSAGE = 'Vui lòng nhập thông tin này'

export function withRequiredRule<T extends FieldValues>(
  rules: FieldRules<T>,
  required: boolean | undefined,
  message = REQUIRED_MESSAGE,
): FieldRules<T> {
  if (!required || rules?.required != null) return rules
  return { ...rules, required: message }
}

/** Ô tự focus khi mở dialog: blur trong khoảng này là do dialog chuyển focus, không phải người dùng. */
const AUTO_FOCUS_GRACE_MS = 500

/**
 * Blur của ô nhập có nên tính là "đã rời ô" (để báo lỗi) không. Bỏ qua khi:
 * - focus chuyển sang một nút không phải nút Lưu (Huỷ, X, Thêm dòng…) — báo lỗi lúc này làm
 *   nội dung giãn ra, nút bị xô đi và cú bấm trượt;
 * - ô `autoFocus` vừa gắn vào chưa lâu — dialog đang mở chuyển focus qua lại.
 */
export function isUserBlur(
  event: { relatedTarget: EventTarget | null },
  autoFocusAt: number | null,
) {
  const next =
    typeof Element !== 'undefined' && event.relatedTarget instanceof Element
      ? event.relatedTarget.closest('button')
      : null
  if (next && next.type !== 'submit') return false
  if (autoFocusAt != null && Date.now() - autoFocusAt < AUTO_FOCUS_GRACE_MS) return false
  return true
}
