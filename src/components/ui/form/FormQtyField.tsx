import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import { formatQtyInput, parseQtyInput, typedDecimalAsComma } from '../../../api/inventory'
import { TextInput } from '../TextInput'
import type { TextInputProps } from '../TextInput'
import { withRequiredRule } from './field'
import type { FormFieldBaseProps } from './field'

export type FormQtyFieldProps<T extends FieldValues> = FormFieldBaseProps<T> &
  Omit<TextInputProps, 'name' | 'value' | 'onChange' | 'onBlur' | 'errorText' | 'inputRef'> & {
    /** Chuẩn hoá giá trị ngay khi gõ, vd chặn không cho vượt một mức trần. */
    transform?: (value: string) => string
  }

/**
 * Ô nhập số lượng: chỉ nhận chữ số và một dấu thập phân (gõ "." hay "," đều được),
 * hiển thị theo vi-VN (1.250,5), lưu vào form dạng chuỗi số chuẩn để gửi lên API.
 */
export function FormQtyField<T extends FieldValues>({
  name,
  control,
  rules,
  required,
  transform,
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
      onChange={(event) => {
        const next = parseQtyInput(
          typedDecimalAsComma(event.target, (event.nativeEvent as InputEvent).data),
        )
        onChange(transform ? transform(next) : next)
      }}
      inputRef={ref}
      required={required}
      errorText={fieldState.error?.message}
    />
  )
}
