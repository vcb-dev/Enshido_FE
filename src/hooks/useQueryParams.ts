import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

export type ParamValue = string | number | boolean
export type ParamDefaults = Record<string, ParamValue>

function parseParam(raw: string | null, fallback: ParamValue): ParamValue {
  if (raw == null || raw === '') return fallback
  if (typeof fallback === 'number') {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  if (typeof fallback === 'boolean') return raw === 'true' || raw === '1'
  return raw
}

/**
 * State đồng bộ với query string trên URL, kiểu dữ liệu suy ra từ `defaults`.
 * Giá trị trùng mặc định được xoá khỏi URL để link chia sẻ gọn.
 *
 * ```ts
 * const [params, setParams] = useQueryParams({ search: '', page: 1, onlyActive: false })
 * setParams({ search: 'abc', page: 1 })
 * ```
 */
export function useQueryParams<T extends ParamDefaults>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Giữ nguyên mặc định của lần render đầu để `setParams` không đổi identity.
  const defaultsRef = useRef(defaults)

  const params = useMemo(() => {
    const result = {} as T
    for (const key of Object.keys(defaultsRef.current)) {
      result[key as keyof T] = parseParam(
        searchParams.get(key),
        defaultsRef.current[key],
      ) as T[keyof T]
    }
    return result
  }, [searchParams])

  const setParams = useCallback(
    (patch: Partial<T>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined) continue
            if (value === '' || value === defaultsRef.current[key]) next.delete(key)
            else next.set(key, String(value))
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const resetParams = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const key of Object.keys(defaultsRef.current)) next.delete(key)
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  return [params, setParams, resetParams] as const
}
