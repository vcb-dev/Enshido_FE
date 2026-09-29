import { TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'
import {
  formatQtyInput,
  gramReadout,
  isGramLabel,
  parseQtyInput,
  pasteIntoQty,
  typedDecimalAsComma,
} from '../../api/inventory'

export type QtyTextFieldProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  /** Chuỗi số chuẩn (vd. `200000`, `12.5`) — không phải chuỗi đã format hiển thị. */
  value: string
  onChange: (canonical: string) => void
}

/** Ô gram/số lượng: hiển thị vi-VN (1.250,5), lưu state dạng chuỗi số chuẩn. */
export function QtyTextField({ value, onChange, slotProps, helperText, ...props }: QtyTextFieldProps) {
  const readout = isGramLabel(props.label) ? gramReadout(value) : ''
  return (
    <TextField
      {...props}
      helperText={
        readout && !props.error ? (helperText ? <>{helperText} · {readout}</> : readout) : helperText
      }
      onPaste={(event) => {
        event.preventDefault()
        onChange(pasteIntoQty(event.target as HTMLInputElement, event.clipboardData.getData('text')))
      }}
      slotProps={{
        ...slotProps,
        htmlInput: { inputMode: 'decimal', ...slotProps?.htmlInput },
      }}
      value={formatQtyInput(value)}
      onChange={(event) => {
        const next = parseQtyInput(
          typedDecimalAsComma(event.target, (event.nativeEvent as InputEvent).data),
        )
        onChange(next)
      }}
    />
  )
}
