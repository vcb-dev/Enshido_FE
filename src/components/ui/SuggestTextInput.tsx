import { useLayoutEffect, useRef, type ChangeEvent, type KeyboardEvent, type Ref } from 'react'
import { TextInput } from './TextInput'
import type { TextInputProps } from './TextInput'

function foldVi(value: string) {
  return value.toLocaleLowerCase('vi')
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === 'function') ref(value)
  else (ref as { current: T | null }).current = value
}

/** Tên bắt đầu bằng phần đã gõ (không phân biệt hoa thường). Ưu tiên tên ngắn hơn. */
export function excelPrefixMatch(typed: string, suggestions: string[]): string | null {
  if (typed.length < 2) return null
  const needle = foldVi(typed)
  let best: string | null = null
  for (const item of suggestions) {
    if (!item || item.length <= typed.length) continue
    if (!foldVi(item).startsWith(needle)) continue
    if (
      !best ||
      item.length < best.length ||
      (item.length === best.length && item.localeCompare(best, 'vi') < 0)
    ) {
      best = item
    }
  }
  return best
}

export type SuggestTextInputProps = TextInputProps & {
  /** Danh sách tên đã có — gợi ý phần còn lại kiểu Excel (bôi xanh, Tab nhận). */
  suggestions?: string[]
}

/**
 * Ô nhập gợi ý kiểu Excel: gõ "Đá mois" thì tự điền nốt "... round tròn trắng 0.9mm"
 * và bôi xanh phần gợi ý. Tab / click giữ nguyên; tiếp tục gõ thì thay phần bôi xanh;
 * Escape trả về đúng phần đã gõ.
 */
export function SuggestTextInput({
  suggestions = [],
  onChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  inputRef,
  value,
  ...props
}: SuggestTextInputProps) {
  const inputEl = useRef<HTMLInputElement | null>(null)
  const composing = useRef(false)
  const prefixLen = useRef<number | null>(null)
  const pendingSelect = useRef<{ start: number; end: number } | null>(null)
  const text = String(value ?? '')

  useLayoutEffect(() => {
    const range = pendingSelect.current
    const el = inputEl.current
    if (!range || !el) return
    pendingSelect.current = null
    el.setSelectionRange(range.start, range.end)
  }, [text])

  function setInputNode(node: HTMLInputElement | null) {
    inputEl.current = node
    assignRef(inputRef, node)
  }

  function emit(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event)
  }

  function emitText(next: string) {
    const el = inputEl.current
    if (el) el.value = next
    ;(onChange as ((value: string) => void) | undefined)?.(next)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const el = event.target
    const typed = el.value
    const inputType = (event.nativeEvent as InputEvent).inputType ?? 'insertText'
    const deleting = inputType.startsWith('delete')

    if (composing.current || deleting || !suggestions.length) {
      prefixLen.current = null
      emit(event)
      return
    }

    const match = excelPrefixMatch(typed, suggestions)
    if (match) {
      prefixLen.current = typed.length
      pendingSelect.current = { start: typed.length, end: match.length }
      el.value = match
      emit(event)
      return
    }

    prefixLen.current = null
    emit(event)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && prefixLen.current != null) {
      event.preventDefault()
      event.stopPropagation()
      const prefix = text.slice(0, prefixLen.current)
      prefixLen.current = null
      pendingSelect.current = null
      emitText(prefix)
      return
    }
    if (event.key === 'Tab' && prefixLen.current != null) {
      prefixLen.current = null
      const el = inputEl.current
      if (el) el.setSelectionRange(text.length, text.length)
    }
    onKeyDown?.(event)
  }

  return (
    <TextInput
      {...props}
      value={value}
      inputRef={setInputNode}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onCompositionStart={(event) => {
        composing.current = true
        onCompositionStart?.(event)
      }}
      onCompositionEnd={(event) => {
        composing.current = false
        onCompositionEnd?.(event)
        const el = inputEl.current
        if (!el) return
        const typed = el.value
        const match = excelPrefixMatch(typed, suggestions)
        if (!match) return
        prefixLen.current = typed.length
        pendingSelect.current = { start: typed.length, end: match.length }
        emitText(match)
      }}
    />
  )
}
