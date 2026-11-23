import { Autocomplete, TextField } from '@mui/material'
import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import { READ_ONLY_FIELD_SX, withRequiredRule, type FormFieldBaseProps } from '../components/ui'

type FreeSoloProps<T extends FieldValues> = FormFieldBaseProps<T> & {
  label: string
  options: string[]
  placeholder?: string
  readOnly?: boolean
}

/** Ô nhập tự do có gợi ý sẵn (người chốt, thời gian cần, công nợ…). */
export function FormFreeSoloField<T extends FieldValues>({
  name,
  control,
  rules,
  required,
  label,
  options,
  placeholder,
  readOnly,
}: FreeSoloProps<T>) {
  const { field, fieldState } = useController({
    name,
    control,
    rules: withRequiredRule(rules, required),
  })
  const value = String(field.value ?? '')

  return (
    <Autocomplete
      freeSolo
      options={options}
      value={value}
      inputValue={value}
      onInputChange={(_, next) => field.onChange(next)}
      onChange={(_, next) => field.onChange(next ?? '')}
      onBlur={field.onBlur}
      disabled={readOnly}
      disableClearable={!value}
      size="small"
      fullWidth
      sx={readOnly ? READ_ONLY_FIELD_SX : undefined}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          inputRef={field.ref}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message}
        />
      )}
    />
  )
}
