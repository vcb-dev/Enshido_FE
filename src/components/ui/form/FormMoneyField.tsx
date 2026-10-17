import { useLayoutEffect, useRef, useState } from 'react'
import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import {
  caretAfterMoneyFormat,
  formatMoneyInput,
  moneyDigitsFromInput,
} from '../../../api/inventory'
import { TextInput } from '../TextInput'
import type { TextInputProps } from '../TextInput'
import { isUserBlur, withRequiredRule } from './field'
import type { FormFieldBaseProps } from './field'

export type FormMoneyFieldProps<T extends FieldValues> = FormFieldBaseProps<T> &
  Omit<TextInputProps, 'name' | 'value' | 'onChange' | 'onBlur' | 'errorText' | 'inputRef'>

/**
 * Ô nhập tiền: hiển thị có phân cách nghìn, lưu vào form dạng chuỗi chỉ chữ số
 * để gửi thẳng lên API. Caret bám theo chữ số để lúc thêm dấu chấm nghìn không nhảy.
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
  const inputEl = useRef<HTMLInputElement | null>(null)
  const digitsBeforeCaret = useRef<number | null>(null)

  useLayoutEffect(() => {
    const input = inputEl.current
    const digits = digitsBeforeCaret.current
    if (!input || digits == null) return
    const pos = caretAfterMoneyFormat(input.value, digits)
    input.setSelectionRange(pos, pos)
    digitsBeforeCaret.current = null
  }, [value])

  return (
    <TextInput
      slotProps={{ htmlInput: { inputMode: 'numeric' } }}
      {...props}
      {...rest}
      value={formatMoneyInput(String(value ?? ''))}
      onChange={(event) => {
        const input = event.target
        const caret = input.selectionStart ?? input.value.length
        digitsBeforeCaret.current = (input.value.slice(0, caret).match(/\d/g) ?? []).length
        onChange(moneyDigitsFromInput(input.value))
      }}
      onBlur={(event) => {
        if (isUserBlur(event, autoFocusAt)) onBlur()
      }}
      inputRef={(node) => {
        inputEl.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      required={required}
      errorText={fieldState.error?.message}
    />
  )
}
