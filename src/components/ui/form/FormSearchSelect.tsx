import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import type { SxProps, Theme } from '@mui/material'
import { SearchSelect } from '../../../warehouses/SearchSelect'
import type { SearchSelectOption } from '../../../warehouses/SearchSelect'
import { withRequiredRule } from './field'
import type { FormFieldBaseProps } from './field'

export type FormSearchSelectProps<T extends FieldValues> = FormFieldBaseProps<T> & {
  label: string
  options: SearchSelectOption[]
  /** Chế độ xem: hiện nhãn đã chọn dưới dạng text tĩnh. */
  readOnly?: boolean
  disabled?: boolean
  /** Nhãn hiển thị ở chế độ xem khi option không còn trong danh sách. */
  displayValue?: string
  placeholder?: string
  allowClear?: boolean
  noOptionsText?: string
  size?: 'small' | 'medium'
  /** Mặc định `false`: field form luôn nằm trong Dialog nên popper cần portal. */
  disablePortal?: boolean
  sx?: SxProps<Theme>
}

/**
 * Ô chọn có tìm kiếm nối với react-hook-form, dựng trên
 * [SearchSelect](../../../warehouses/SearchSelect.tsx).
 *
 * Dùng khi danh sách dài hoặc option cần dòng phụ (vị trí kệ trống / đang dùng).
 * Danh sách ngắn và cố định thì [FormSelect](./FormSelect.tsx) gọn hơn.
 */
export function FormSearchSelect<T extends FieldValues>({
  name,
  control,
  rules,
  required,
  size = 'small',
  disablePortal = false,
  ...props
}: FormSearchSelectProps<T>) {
  const { field, fieldState } = useController({
    name,
    control,
    rules: withRequiredRule(rules, required),
  })

  return (
    <SearchSelect
      {...props}
      size={size}
      disablePortal={disablePortal}
      required={required}
      valueId={String(field.value ?? '')}
      onChange={field.onChange}
      onBlur={field.onBlur}
      inputRef={field.ref}
      errorText={fieldState.error?.message}
    />
  )
}
