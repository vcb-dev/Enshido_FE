import { TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'
import {
  caretInQtyFormat,
  formatQtyInput,
  gramReadout,
  isGramLabel,
  pasteIntoQty,
  readQtyInput,
  skipGroupSeparatorOnDelete,
} from '../../api/inventory'
import { useFormattedCaret } from './useFormattedCaret'

export type QtyTextFieldProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  /** Chuỗi số chuẩn (vd. `200000`, `12.5`) — không phải chuỗi đã format hiển thị. */
  value: string
  onChange: (canonical: string) => void
}

/** Ô gram/số lượng: hiển thị vi-VN (1.250,5), lưu state dạng chuỗi số chuẩn. */
export function QtyTextField({ value, onChange, slotProps, helperText, inputRef, onKeyDown, ...props }: QtyTextFieldProps) {
  const readout = isGramLabel(props.label) ? gramReadout(value) : ''
  const caret = useFormattedCaret(value)
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
      inputRef={(node: HTMLInputElement | null) => {
        caret.input.current = node
        if (typeof inputRef === 'function') inputRef(node)
        else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = node
      }}
      onKeyDown={(event) => {
        skipGroupSeparatorOnDelete(event.target as HTMLInputElement, event.key)
        onKeyDown?.(event)
      }}
      onChange={(event) => {
        const read = readQtyInput(event.target, (event.nativeEvent as InputEvent).data)
        caret.place((formatted) => caretInQtyFormat(formatted, read.caret))
        onChange(read.value)
      }}
    />
  )
}
