import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import type { ChangeEvent, FocusEvent } from 'react'
import { SuggestTextInput } from '../SuggestTextInput'
import { TextInput } from '../TextInput'
import type { TextInputProps } from '../TextInput'
import { withRequiredRule } from './field'
import type { FormFieldBaseProps } from './field'

export type FormTextFieldProps<T extends FieldValues> = FormFieldBaseProps<T> &
  Omit<TextInputProps, 'name' | 'value' | 'onChange' | 'onBlur' | 'errorText' | 'inputRef'> & {
    /** Chuẩn hoá giá trị ngay khi gõ, vd: `(v) => v.replace(/\D/g, '')` chỉ giữ chữ số. */
    transform?: (value: string) => string
    /** Tên đã có trên kho — gợi ý phần còn lại kiểu Excel khi gõ. */
    suggestions?: string[]
    onBlur?: TextInputProps['onBlur']
  }

/** Ô nhập văn bản nối với react-hook-form qua Controller. */
export function FormTextField<T extends FieldValues>({
  name,
  control,
  rules,
  required,
  transform,
  suggestions,
  onBlur: onBlurProp,
  ...props
}: FormTextFieldProps<T>) {
  const { field, fieldState } = useController({
    name,
    control,
    rules: withRequiredRule(rules, required),
  })
  const { ref, value, onChange, onBlur, ...rest } = field
  const shared = {
    ...props,
    ...rest,
    value: value ?? '',
    onChange: transform
      ? (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(transform(event.target.value))
      : onChange,
    onBlur: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onBlur()
      onBlurProp?.(event)
    },
    inputRef: ref,
    required,
    errorText: fieldState.error?.message,
  }

  if (suggestions?.length) {
    return <SuggestTextInput {...shared} suggestions={suggestions} />
  }

  return <TextInput {...shared} />
}
