import { useCallback, useMemo } from 'react'
import { useQueryParams } from './useQueryParams'
import type { ParamDefaults } from './useQueryParams'

export type SortDir = 'asc' | 'desc'

export type TableParams = {
  page: number
  pageSize: number
  search: string
  sort: string
  dir: SortDir
}

export type TableParamsOptions<F extends ParamDefaults> = {
  pageSize?: number
  sort?: string
  dir?: SortDir
  /** Bộ lọc riêng của bảng; giá trị mặc định quyết định kiểu dữ liệu. */
  filters?: F
}

/**
 * Trạng thái phân trang / tìm kiếm / sắp xếp / lọc của một bảng, lưu trên URL.
 * Truyền thẳng `params` vào queryKey của react-query để đổi param là refetch.
 *
 * ```ts
 * const table = useTableParams({ pageSize: 25, filters: { status: 'ALL' } })
 * table.setFilter({ status: 'LOW' })   // luôn nhảy về trang 1
 * ```
 */
export function useTableParams<F extends ParamDefaults = Record<string, never>>(
  options: TableParamsOptions<F> = {},
) {
  const { pageSize = 25, sort = '', dir = 'asc', filters } = options

  // Mặc định chỉ đọc ở lần render đầu (useQueryParams giữ trong ref), nên
  // object literal mới mỗi render cũng không gây vòng lặp.
  const defaults = { page: 1, pageSize, search: '', sort, dir, ...filters } as TableParams & F

  const [params, setParams, reset] = useQueryParams(defaults)

  // Các cast dưới đây chỉ để TypeScript chấp nhận literal cho `Partial<TableParams & F>`
  // khi F còn là generic chưa xác định.
  const setPage = useCallback(
    (page: number) => setParams({ page } as Partial<TableParams & F>),
    [setParams],
  )

  const setPageSize = useCallback(
    (size: number) => setParams({ pageSize: size, page: 1 } as Partial<TableParams & F>),
    [setParams],
  )

  const setSearch = useCallback(
    (search: string) => setParams({ search, page: 1 } as Partial<TableParams & F>),
    [setParams],
  )

  /** Đổi bộ lọc bất kỳ và luôn quay về trang 1. */
  const setFilter = useCallback(
    (patch: Partial<TableParams & F>) => setParams({ ...patch, page: 1 }),
    [setParams],
  )

  /** Đổi cột sắp xếp; bấm lại cột đang sắp xếp thì đảo chiều. */
  const toggleSort = useCallback(
    (key: string) =>
      setParams({
        sort: key,
        dir: params.sort === key && params.dir === 'asc' ? 'desc' : 'asc',
        page: 1,
      } as Partial<TableParams & F>),
    [setParams, params.sort, params.dir],
  )

  const sortState = useMemo(
    () => (params.sort ? { key: params.sort, dir: params.dir } : undefined),
    [params.sort, params.dir],
  )

  return {
    params,
    sortState,
    setPage,
    setPageSize,
    setSearch,
    setFilter,
    toggleSort,
    reset,
  }
}

/** Cắt trang phía client khi API chưa hỗ trợ phân trang. */
export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize
  return rows.slice(start, start + pageSize)
}
