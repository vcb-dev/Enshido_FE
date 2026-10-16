import { useState } from 'react'
import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import { formatMoneyInput, moneyDigitsFromInput } from '../../../api/inventory'
import { TextInput } from '../TextInput'
import type { TextInputProps } from '../TextInput'
import { isUserBlur, withRequiredRule } from './field'
import type { FormFieldBaseProps } from './field'

export type FormMoneyFieldProps<T extends FieldValues> = FormFieldBaseProps<T> &
  Omit<TextInputProps, 'name' | 'value' | 'onChange' | 'onBlur' | 'errorText' | 'inputRef'>

/**
 * Ô nhập tiền: hiển thị có phân cách nghìn, lưu vào form dạng chuỗi chỉ chữ số
 * để gửi thẳng lên API.
 */
export function FormMoneyField<T extends FieldValues>({
  name,
  control,
  rules,
  required,
  ...props
}: FormMoneyFieldProps<T>) {
  const { field, fieldState } = useController({
    name,
    control,
    rules: withRequiredRule(rules, required),
  })
  const { ref, value, onChange, onBlur, ...rest } = field
  const [autoFocusAt] = useState(() => (props.autoFocus ? Date.now() : null))

  return (
    <TextInput
      slotProps={{ htmlInput: { inputMode: 'numeric' } }}
      {...props}
      {...rest}
      value={formatMoneyInput(String(value ?? ''))}
      onChange={(event) => onChange(moneyDigitsFromInput(event.target.value))}
      onBlur={(event) => {
        if (isUserBlur(event, autoFocusAt)) onBlur()
      }}
      inputRef={ref}
      required={required}
      errorText={fieldState.error?.message}
    />
  )
}
