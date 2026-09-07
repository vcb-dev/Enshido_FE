import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import { formatQtyInput, parseQtyInput } from '../../../api/inventory'
import { TextInput } from '../TextInput'
import type { TextInputProps } from '../TextInput'
import { withRequiredRule } from './field'
import type { FormFieldBaseProps } from './field'

export type FormQtyFieldProps<T extends FieldValues> = FormFieldBaseProps<T> &
  Omit<TextInputProps, 'name' | 'value' | 'onChange' | 'onBlur' | 'errorText' | 'inputRef'>

/**
 * Ô nhập số lượng: hiển thị theo định dạng vi-VN (dấu phẩy thập phân), lưu vào
 * form dạng chuỗi số chuẩn để gửi lên API.
 */
export function FormQtyField<T extends FieldValues>({
  name,
  control,
  rules,
  required,
  ...props
}: FormQtyFieldProps<T>) {
  const { field, fieldState } = useController({
    name,
    control,
    rules: withRequiredRule(rules, required),
  })
  const { ref, value, onChange, ...rest } = field

  return (
    <TextInput
      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
      {...props}
      {...rest}
      value={formatQtyInput(String(value ?? ''))}
      onChange={(event) => onChange(parseQtyInput(event.target.value))}
      inputRef={ref}
      required={required}
      errorText={fieldState.error?.message}
    />
  )
}
