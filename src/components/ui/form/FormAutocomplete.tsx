import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import { AutocompleteInput } from '../AutocompleteInput'
import type { AutocompleteInputProps } from '../AutocompleteInput'
import { withRequiredRule } from './field'
import type { FormFieldBaseProps } from './field'

export type FormAutocompleteProps<T extends FieldValues, TOption> = FormFieldBaseProps<T> &
  Omit<
    AutocompleteInputProps<TOption>,
    'value' | 'onChange' | 'onBlur' | 'errorText' | 'inputRef'
  > & {
    /**
     * Trường của option được lưu vào form, ví dụ `'id'`.
     * Bỏ trống thì lưu nguyên object option.
     */
    valueKey?: keyof TOption
  }

/**
 * Ô chọn có tìm kiếm, nối với react-hook-form qua Controller.
 *
 * ```tsx
 * <FormAutocomplete<StockFormValues, LookupItem>
 *   name="unitId"
 *   label="Đơn vị"
 *   options={lookups.units}
 *   valueKey="id"
 *   getOptionLabel={(item) => item.name}
 *   required
 * />
 * ```
 */
export function FormAutocomplete<T extends FieldValues, TOption>({
  name,
  control,
  rules,
  required,
  valueKey,
  options,
  ...props
}: FormAutocompleteProps<T, TOption>) {
  const { field, fieldState } = useController({
    name,
    control,
    rules: withRequiredRule(rules, required),
  })
  const { ref, value, onChange, onBlur } = field

  const selected = valueKey
    ? (options.find((option) => option[valueKey] === value) ?? null)
    : ((value ?? null) as TOption | null)

  return (
    <AutocompleteInput<TOption>
      {...props}
      options={options}
      value={selected}
      onChange={(next) => onChange(valueKey ? (next ? next[valueKey] : null) : next)}
      onBlur={onBlur}
      inputRef={ref}
      required={required}
      errorText={fieldState.error?.message}
    />
  )
}
