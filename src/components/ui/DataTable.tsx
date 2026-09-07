import type { ReactNode } from 'react'
import {
  Alert,
  Box,
  LinearProgress,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tooltip,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import type { SortDir } from '../../hooks/useTableParams'

export type Column<T> = {
  /** Định danh cột, cũng là khoá sắp xếp mặc định. */
  key: string
  header: ReactNode
  /** Tự vẽ ô. Không truyền thì lấy `row[field]` hoặc `row[key]`. */
  render?: (row: T, index: number) => ReactNode
  field?: keyof T
  align?: 'left' | 'center' | 'right'
  width?: number | string
  sortable?: boolean
  /** Khoá gửi lên API khi sắp xếp; mặc định là `key`. */
  sortKey?: string
  /** Cắt bớt nội dung dài và hiện tooltip đầy đủ khi rê chuột. */
  ellipsis?: boolean
  /** Canh phải + chữ số đều bề ngang, dùng cho cột số lượng / tiền. */
  numeric?: boolean
  cellSx?: SxProps<Theme>
  headSx?: SxProps<Theme>
  className?: string
}

export type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  loading?: boolean
  errorText?: string
  emptyText?: ReactNode
  /** Thanh công cụ phía trên bảng: ô tìm kiếm, bộ lọc, nút thêm mới. */
  toolbar?: ReactNode
  /** Hàng tổng cộng ghim dưới phần thân. */
  footer?: ReactNode
  /**
   * Thay toàn bộ phần tiêu đề tự sinh, dùng khi cần tiêu đề nhóm nhiều tầng
   * (rowSpan / colSpan). Tự chịu trách nhiệm vẽ cả ô STT nếu bật `showIndex`.
   */
  customHeader?: ReactNode
  dense?: boolean
  stickyHeader?: boolean
  /** `grid` = ô có viền, nền tiêu đề dính — kiểu bảng của các panel kho. */
  variant?: 'plain' | 'grid'
  minWidth?: number | string
  /** Chia đều bề ngang theo `width` của cột thay vì co theo nội dung. */
  fixedLayout?: boolean
  /** Thêm cột STT ở đầu bảng. */
  showIndex?: boolean
  /** Số dòng đã bỏ qua ở các trang trước, để STT chạy tiếp. */
  indexOffset?: number
  onRowClick?: (row: T) => void
  isRowSelected?: (row: T) => boolean
  sort?: { key: string; dir: SortDir }
  onSortChange?: (key: string) => void
  /** Trang hiện tại, đếm từ 1 để khớp với [useTableParams](../../hooks/useTableParams.ts). */
  page?: number
  pageSize?: number
  /** Tổng số dòng; bỏ trống thì lấy `rows.length` (phân trang phía client). */
  total?: number
  pageSizeOptions?: number[]
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  /** Danh từ trong dòng "1–25 / 80 NVL". */
  rowsLabel?: string
  maxHeight?: number | string
  sx?: SxProps<Theme>
  tableSx?: SxProps<Theme>
}

const NUMERIC_SX = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

const ELLIPSIS_SX = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 0,
} as const

const GRID_TABLE_SX = {
  borderCollapse: 'separate',
  borderSpacing: 0,
  '& .MuiTableCell-root': {
    border: '1px solid #b7c2cc',
    py: 0.75,
    px: 1,
  },
  '& .MuiTableCell-head': { whiteSpace: 'nowrap' },
} as const

function defaultCell(value: unknown): ReactNode {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  return String(value)
}

/**
 * Bảng dùng chung: sắp xếp, phân trang, trạng thái đang tải / lỗi / rỗng.
 * Ghép với [useTableParams](../../hooks/useTableParams.ts) để lưu trạng thái lên URL.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  errorText,
  emptyText = 'Chưa có dữ liệu.',
  toolbar,
  footer,
  customHeader,
  dense = true,
  stickyHeader = true,
  variant = 'plain',
  minWidth,
  fixedLayout,
  showIndex,
  indexOffset = 0,
  onRowClick,
  isRowSelected,
  sort,
  onSortChange,
  page,
  pageSize,
  total,
  pageSizeOptions = [8, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  rowsLabel = 'dòng',
  maxHeight,
  sx,
  tableSx,
}: DataTableProps<T>) {
  const showPagination = page != null && pageSize != null && onPageChange != null
  const rowCount = total ?? rows.length
  const showSkeleton = loading && rows.length === 0
  const colCount = columns.length + (showIndex ? 1 : 0)

  return (
    <Paper
      sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', ...sx }}
    >
      {toolbar ? (
        <Box
          sx={{
            px: 1.5,
            py: 1,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            flexShrink: 0,
            borderBottom: '1px solid #d5dbe0',
          }}
        >
          {toolbar}
        </Box>
      ) : null}

      {errorText ? (
        <Alert severity="error" square sx={{ borderRadius: 0, flexShrink: 0 }}>
          {errorText}
        </Alert>
      ) : null}

      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
        {loading ? (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4 }} />
        ) : null}
        <TableContainer sx={{ flex: 1, minHeight: 0, maxHeight, overflow: 'auto' }}>
          <Table
            size={dense ? 'small' : 'medium'}
            stickyHeader={stickyHeader}
            sx={{
              width: '100%',
              minWidth,
              ...(fixedLayout ? { tableLayout: 'fixed' } : null),
              ...(variant === 'grid' ? GRID_TABLE_SX : null),
              ...tableSx,
            }}
          >
            <TableHead>
              {customHeader ?? (
              <TableRow>
                {showIndex ? (
                  <TableCell align="center" sx={{ width: 48 }}>
                    STT
                  </TableCell>
                ) : null}
                {columns.map((column) => {
                  const sortKey = column.sortKey ?? column.key
                  const active = sort?.key === sortKey
                  return (
                    <TableCell
                      key={column.key}
                      align={column.align ?? (column.numeric ? 'right' : undefined)}
                      className={column.className}
                      sortDirection={active ? sort.dir : false}
                      sx={{
                        width: column.width,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        ...column.headSx,
                      }}
                    >
                      {column.sortable && onSortChange ? (
                        <TableSortLabel
                          active={active}
                          direction={active ? sort.dir : 'asc'}
                          onClick={() => onSortChange(sortKey)}
                        >
                          {column.header}
                        </TableSortLabel>
                      ) : (
                        column.header
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
              )}
            </TableHead>

            <TableBody>
              {showSkeleton
                ? Array.from({ length: 5 }, (_, rowIndex) => (
                    <TableRow key={`skeleton-${rowIndex}`}>
                      {Array.from({ length: colCount }, (_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton variant="text" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((row, index) => (
                    <TableRow
                      key={rowKey(row, index)}
                      hover
                      selected={isRowSelected?.(row) ?? false}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      sx={onRowClick ? { cursor: 'pointer' } : undefined}
                    >
                      {showIndex ? (
                        <TableCell align="center">{indexOffset + index + 1}</TableCell>
                      ) : null}
                      {columns.map((column) => {
                        const content = column.render
                          ? column.render(row, index)
                          : defaultCell(
                              (row as Record<string, unknown>)[
                                (column.field as string) ?? column.key
                              ],
                            )
                        const cell = (
                          <TableCell
                            key={column.key}
                            align={column.align ?? (column.numeric ? 'right' : undefined)}
                            className={column.className}
                            sx={{
                              ...(column.numeric ? NUMERIC_SX : null),
                              ...(column.ellipsis ? ELLIPSIS_SX : null),
                              ...column.cellSx,
                            }}
                          >
                            {content}
                          </TableCell>
                        )
                        if (!column.ellipsis || typeof content !== 'string') return cell
                        return (
                          <Tooltip
                            key={column.key}
                            title={content}
                            disableHoverListener={!content || content === '—'}
                          >
                            {cell}
                          </Tooltip>
                        )
                      })}
                    </TableRow>
                  ))}

              {!loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} sx={{ color: 'text.secondary' }}>
                    {emptyText}
                  </TableCell>
                </TableRow>
              ) : null}

              {footer}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {showPagination ? (
        <TablePagination
          component="div"
          count={rowCount}
          page={page - 1}
          onPageChange={(_, next) => onPageChange(next + 1)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(event) => onPageSizeChange?.(Number(event.target.value))}
          rowsPerPageOptions={onPageSizeChange ? pageSizeOptions : []}
          labelRowsPerPage="Mỗi trang"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count} ${rowsLabel}`}
          sx={{ flexShrink: 0, borderTop: '1px solid #d5dbe0' }}
        />
      ) : null}
    </Paper>
  )
}
