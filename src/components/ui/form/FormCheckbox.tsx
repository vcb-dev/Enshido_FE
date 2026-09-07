import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import { CheckboxInput } from '../CheckboxInput'
import type { CheckboxInputProps } from '../CheckboxInput'
import { withRequiredRule } from './field'
import type { FormFieldBaseProps } from './field'

export type FormCheckboxProps<T extends FieldValues> = FormFieldBaseProps<T> &
  Omit<CheckboxInputProps, 'name' | 'checked' | 'onChange' | 'onBlur' | 'errorText' | 'inputRef'>

/** Ô tích chọn nối với react-hook-form qua Controller. */
export function FormCheckbox<T extends FieldValues>({
  name,
  control,
  rules,
  required,
  ...props
}: FormCheckboxProps<T>) {
  const { field, fieldState } = useController({
    name,
    control,
    rules: withRequiredRule(rules, required),
  })
  const { ref, value, onChange, ...rest } = field

  return (
    <CheckboxInput
      {...props}
      {...rest}
      inputRef={ref}
      checked={Boolean(value)}
      onChange={onChange}
      errorText={fieldState.error?.message}
    />
  )
}
