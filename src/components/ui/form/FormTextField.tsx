import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import { TextInput } from '../TextInput'
import type { TextInputProps } from '../TextInput'
import { withRequiredRule } from './field'
import type { FormFieldBaseProps } from './field'

export type FormTextFieldProps<T extends FieldValues> = FormFieldBaseProps<T> &
  Omit<TextInputProps, 'name' | 'value' | 'onChange' | 'onBlur' | 'errorText' | 'inputRef'> & {
    /** Chuẩn hoá giá trị ngay khi gõ, vd: `(v) => v.replace(/\D/g, '')` chỉ giữ chữ số. */
    transform?: (value: string) => string
  }

/** Ô nhập văn bản nối với react-hook-form qua Controller. */
export function FormTextField<T extends FieldValues>({
  name,
  control,
  rules,
  required,
  transform,
  ...props
}: FormTextFieldProps<T>) {
  const { field, fieldState } = useController({
    name,
    control,
    rules: withRequiredRule(rules, required),
  })
  const { ref, value, onChange, ...rest } = field

  return (
    <TextInput
      {...props}
      {...rest}
      value={value ?? ''}
      onChange={
        transform
          ? (event) => onChange(transform(event.target.value))
          : onChange
      }
      inputRef={ref}
      required={required}
      errorText={fieldState.error?.message}
    />
  )
}
