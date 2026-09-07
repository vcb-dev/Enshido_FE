import type { ReactNode, Ref } from 'react'
import { Checkbox, FormControl, FormControlLabel, FormHelperText } from '@mui/material'
import type { CheckboxProps } from '@mui/material'

export type CheckboxInputProps = Omit<CheckboxProps, 'onChange' | 'checked'> & {
  label?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  errorText?: string
  helperText?: ReactNode
  /** MUI v9 không còn `inputRef` trên Checkbox nên chuyển tiếp qua slot `input`. */
  inputRef?: Ref<HTMLInputElement>
}

/** Ô tích chọn kèm nhãn và chỗ hiện lỗi giống các ô nhập khác. */
export function CheckboxInput({
  label,
  checked,
  onChange,
  errorText,
  helperText,
  inputRef,
  slotProps,
  size = 'small',
  ...props
}: CheckboxInputProps) {
  const mergedSlotProps = inputRef
    ? {
        ...slotProps,
        input: {
          ...(typeof slotProps?.input === 'object' ? slotProps.input : null),
          ref: inputRef,
        },
      }
    : slotProps

  return (
    <FormControl error={Boolean(errorText)} component="fieldset" variant="standard">
      <FormControlLabel
        label={label}
        control={
          <Checkbox
            {...props}
            size={size}
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            slotProps={mergedSlotProps}
          />
        }
      />
      {errorText ?? helperText ? (
        <FormHelperText sx={{ mt: 0, ml: 1.75 }}>{errorText ?? helperText}</FormHelperText>
      ) : null}
    </FormControl>
  )
}
