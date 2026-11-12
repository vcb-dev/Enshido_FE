import { useEffect, useRef, useState } from 'react'
import { TextField, type TextFieldProps } from '@mui/material'

/** Năm gõ dở (0002, 0020, 0202…) thì chưa phải ngày thật. */
const MIN_YEAR = 2000
/** Gõ tay: ngừng gõ chừng này thì mới báo ngày lên. */
const TYPING_IDLE_MS = 800

export function isCompleteDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= MIN_YEAR
}

export type DateFieldProps = Omit<TextFieldProps, 'type' | 'value' | 'onChange' | 'defaultValue'> & {
  value: string
  /** Chỉ gọi với ngày đủ (năm ≥ 2000) hoặc '' khi xoá trống ô. */
  onChange: (value: string) => void
}

/**
 * Ô chọn ngày gõ tay được. Khi gõ, Chrome bắn ra ngày sau từng phím (tháng "1" của "11" thành tháng 01,
 * năm 0002 → 0020 → 0202 → 2025); đẩy thẳng các giá trị dở đó lên trên (ép khoảng Từ–Đến, gọi API) thì
 * ô nhảy giá trị và mất phím. Nên: chọn trên lịch thì báo lên ngay; gõ tay thì giữ bản đang gõ trong ô,
 * chỉ báo lên khi ngừng gõ, bấm Enter hoặc rời ô. Ngày còn dở lúc đó thì trả ô về ngày cũ.
 */
export function DateField({ value, onChange, onBlur, onKeyDown, onMouseDown, slotProps, ...props }: DateFieldProps) {
  const [draft, setDraft] = useState(value)
  const typing = useRef(false)
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef({ value, onChange })
  latest.current = { value, onChange }

  useEffect(() => {
    if (pending.current === null) setDraft(value)
  }, [value])

  useEffect(() => () => clearTimeout(timer.current), [])

  const commit = (next: string) => {
    if (next === '' || isCompleteDate(next)) {
      if (next !== latest.current.value) latest.current.onChange(next)
    } else {
      setDraft(latest.current.value)
    }
  }

  const flush = () => {
    clearTimeout(timer.current)
    typing.current = false
    if (pending.current === null) return
    const next = pending.current
    pending.current = null
    commit(next)
  }

  return (
    <TextField
      {...props}
      type="date"
      value={draft}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        if (!typing.current) {
          if (next === '' || isCompleteDate(next)) latest.current.onChange(next)
          return
        }
        pending.current = next
        clearTimeout(timer.current)
        timer.current = setTimeout(flush, TYPING_IDLE_MS)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') flush()
        else if (event.key !== 'Tab' && event.key !== 'Escape') typing.current = true
        onKeyDown?.(event)
      }}
      onMouseDown={(event) => {
        // Bấm chuột (mở lịch) → lần đổi tiếp theo là chọn trên lịch, báo lên ngay.
        flush()
        onMouseDown?.(event)
      }}
      onBlur={(event) => {
        flush()
        onBlur?.(event)
      }}
      slotProps={{ ...slotProps, inputLabel: { shrink: true, ...(slotProps?.inputLabel as object) } }}
    />
  )
}
