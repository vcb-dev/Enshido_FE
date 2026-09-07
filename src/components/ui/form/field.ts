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
