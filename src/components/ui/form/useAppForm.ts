import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { FieldErrors, FieldValues, Path, UseFormProps, UseFormReturn } from 'react-hook-form'

/** Đường dẫn các ô đang báo lỗi (kể cả ô trong mảng: `lines.0.qty`), bỏ lỗi `root`. */
export function errorPaths(errors: FieldErrors, prefix = ''): string[] {
  const paths: string[] = []
  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object' || (prefix === '' && key === 'root')) continue
    const path = prefix ? `${prefix}.${key}` : key
    if ('message' in value || 'type' in value) paths.push(path)
    else paths.push(...errorPaths(value as FieldErrors, path))
  }
  return paths
}

/**
 * `useForm` của cả app: báo lỗi lần đầu khi rời ô (blur), sau đó sửa tới đâu cập nhật tới đó —
 * người dùng thấy lỗi trước khi bấm Lưu. Form nào cần kiểu khác thì truyền `mode` để ghi đè.
 *
 * Luật đọc giá trị ô khác (ngày giao ≥ ngày nhận, số viên thừa theo TL gói…): một ô đổi thì các
 * ô khác đang báo lỗi được kiểm lại, để lỗi tự mất khi đã sửa bằng ô kia — ô chưa đụng tới không
 * bị báo đỏ thêm.
 */
export function useAppForm<
  TFieldValues extends FieldValues = FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues,
>(
  props?: UseFormProps<TFieldValues, TContext, TTransformedValues>,
): UseFormReturn<TFieldValues, TContext, TTransformedValues> {
  const form = useForm<TFieldValues, TContext, TTransformedValues>({ mode: 'onTouched', ...props })

  useEffect(() => {
    const subscription = form.watch((_, { name, type }) => {
      if (type !== 'change' || !name) return
      const stale = errorPaths(form.formState.errors).filter((path) => path !== name)
      if (stale.length) void form.trigger(stale as Path<TFieldValues>[])
    })
    return () => subscription.unsubscribe()
  }, [form])

  return form
}
