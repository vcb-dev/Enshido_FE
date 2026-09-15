import { useEffect, useRef, useState } from 'react'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

export type SearchInputProps = {
  /** Từ khoá đã chốt (thường lấy từ URL param). */
  value: string
  /** Gọi sau khi người dùng ngừng gõ `delay` ms, hoặc khi bấm xoá. */
  onChange: (value: string) => void
  placeholder?: string
  delay?: number
  disabled?: boolean
  autoFocus?: boolean
  sx?: SxProps<Theme>
}

/**
 * Ô tìm kiếm tự debounce: gõ phím cập nhật tức thì trong ô, chỉ bắn `onChange`
 * khi đã ngừng gõ — nhờ vậy URL và queryKey của react-query không đổi mỗi ký tự.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  delay = 350,
  disabled,
  autoFocus,
  sx,
}: SearchInputProps) {
  const [text, setText] = useState(value)
  const debounced = useDebouncedValue(text, delay)
  // Giá trị gần nhất đã đồng bộ hai chiều, để phân biệt người dùng gõ với
  // thay đổi từ bên ngoài (nút xoá lọc, nút back của trình duyệt).
  const settled = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (value === settled.current) return
    settled.current = value
    setText(value)
  }, [value])

  useEffect(() => {
    if (debounced === settled.current) return
    settled.current = debounced
    onChangeRef.current(debounced)
  }, [debounced])

  function clear() {
    setText('')
    settled.current = ''
    onChange('')
  }

  return (
    <TextField
      value={text}
      onChange={(event) => setText(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      fullWidth={false}
      sx={{ minWidth: { xs: 0, sm: 260 }, width: { xs: '100%', sm: 'auto' }, ...sx }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="disabled" />
            </InputAdornment>
          ),
          endAdornment: text ? (
            <InputAdornment position="end">
              <IconButton size="small" edge="end" onClick={clear} aria-label="Xoá tìm kiếm">
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  )
}
