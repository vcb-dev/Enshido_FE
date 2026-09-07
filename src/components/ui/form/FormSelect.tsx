import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import { SelectInput } from '../SelectInput'
import type { SelectInputProps, SelectOptionValue } from '../SelectInput'
import { withRequiredRule } from './field'
import type { FormFieldBaseProps } from './field'

export type FormSelectProps<
  T extends FieldValues,
  V extends SelectOptionValue = string,
> = FormFieldBaseProps<T> &
  Omit<SelectInputProps<V>, 'name' | 'value' | 'onChange' | 'onBlur' | 'errorText' | 'inputRef'>

/** Ô chọn nối với react-hook-form qua Controller. */
export function FormSelect<T extends FieldValues, V extends SelectOptionValue = string>({
  name,
  control,
  rules,
  required,
  ...props
}: FormSelectProps<T, V>) {
  const { field, fieldState } = useController({
    name,
    control,
    rules: withRequiredRule(rules, required),
  })
  const { ref, value, onChange, ...rest } = field

  return (
    <SelectInput<V>
      {...props}
      {...rest}
      value={(value ?? '') as V | ''}
      onChange={onChange}
      inputRef={ref}
      required={required}
      errorText={fieldState.error?.message}
    />
  )
}
