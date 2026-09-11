import type { ReactNode } from 'react'
import {
  Alert,
  Box,
  Divider,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import type { Breakpoint } from '@mui/material/styles'
import { useIsCardMode, useIsCompact, useIsMobile } from '../../hooks/useBreakpoint'
import type { SortDir } from '../../hooks/useTableParams'

/** Nhóm tiêu đề bậc 1 gộp nhiều cột liền kề (vd: "Nhập" gộp SL + TT). */
export type ColumnGroup = {
  key: string
  label: ReactNode
  headSx?: SxProps<Theme>
}

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
  /**
   * Gộp cột này vào một nhóm tiêu đề bậc 1. Các cột liền kề cùng `group.key`
   * tự gom thành một ô `colSpan`, cột không nhóm nhận `rowSpan={2}`.
   */
  group?: ColumnGroup
  /** Vị trí của cột khi bảng chuyển sang thẻ trên màn hẹp. Mặc định `body`. */
  card?: CardRole
  /** Nhãn trong thẻ; bỏ trống thì ghép từ `group.label` + `header`. */
  cardLabel?: ReactNode
}

/**
 * `title` in đậm ở đầu thẻ, `meta` là dòng phụ nhạt màu, `body` vào lưới
 * nhãn / giá trị, `actions` ghim bên phải đầu thẻ, `hidden` bị bỏ qua.
 */
export type CardRole = 'title' | 'meta' | 'body' | 'actions' | 'hidden'

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
  /**
   * Dưới breakpoint này mỗi dòng vẽ thành một thẻ thay vì một hàng bảng.
   * `false` = luôn giữ dạng bảng (khi đó màn hẹp cuộn ngang).
   */
  cardBreakpoint?: Breakpoint | false
  /** Tự vẽ toàn bộ thẻ, dùng khi bố cục nhãn / giá trị mặc định không đủ. */
  renderCard?: (row: T, index: number) => ReactNode
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
  cardBreakpoint = 'sm',
  renderCard,
  sx,
  tableSx,
}: DataTableProps<T>) {
  // Dưới `md` cả app chuyển sang một cổng cuộn duy nhất (Box trong AppShell):
  // bảng bỏ khoá chiều cao và bỏ sticky header, nội dung chảy ra ngoài.
  const flowMode = useIsCompact()
  const cardMode = useIsCardMode(cardBreakpoint)
  const isMobile = useIsMobile()

  const showPagination = page != null && pageSize != null && onPageChange != null
  const rowCount = total ?? rows.length
  const showSkeleton = loading && rows.length === 0
  const colCount = columns.length + (showIndex ? 1 : 0)

  function cellContent(column: Column<T>, row: T, index: number): ReactNode {
    return column.render
      ? column.render(row, index)
      : defaultCell((row as Record<string, unknown>)[(column.field as string) ?? column.key])
  }

  // Gom cột liền kề cùng nhóm thành từng dải; cột không nhóm là dải một cột.
  const bands: Array<{ group?: ColumnGroup; columns: Column<T>[] }> = []
  for (const column of columns) {
    const last = bands[bands.length - 1]
    if (column.group && last?.group?.key === column.group.key) last.columns.push(column)
    else bands.push({ group: column.group, columns: [column] })
  }
  const grouped = bands.some((band) => band.group)

  function headCell(column: Column<T>, rowSpan?: number) {
    const sortKey = column.sortKey ?? column.key
    const active = sort?.key === sortKey
    return (
      <TableCell
        key={column.key}
        rowSpan={rowSpan}
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
  }

  const indexHeadCell = showIndex ? (
    <TableCell align="center" rowSpan={grouped ? 2 : undefined} sx={{ width: 48 }}>
      STT
    </TableCell>
  ) : null

  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: flowMode ? 'visible' : 'hidden',
        ...sx,
      }}
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

      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          ...(flowMode ? null : { flex: 1, minHeight: 0 }),
        }}
      >
        {loading ? (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4 }} />
        ) : null}
        {cardMode ? (
          <CardList
            columns={columns}
            rows={rows}
            rowKey={rowKey}
            cellContent={cellContent}
            renderCard={renderCard}
            showIndex={showIndex}
            indexOffset={indexOffset}
            loading={loading}
            showSkeleton={showSkeleton}
            emptyText={emptyText}
          />
        ) : (
        <TableContainer
          sx={{ flex: 1, minWidth: 0, ...(flowMode ? null : { minHeight: 0, maxHeight }), overflow: 'auto' }}
        >
          <Table
            size={dense ? 'small' : 'medium'}
            stickyHeader={stickyHeader && !flowMode}
            sx={{
              width: '100%',
              minWidth,
              ...(fixedLayout ? { tableLayout: 'fixed' } : null),
              ...(variant === 'grid' ? GRID_TABLE_SX : null),
              ...tableSx,
            }}
          >
            <TableHead>
              {grouped ? (
                <>
                  <TableRow>
                    {indexHeadCell}
                    {bands.map((band) =>
                      band.group ? (
                        <TableCell
                          key={band.group.key}
                          align="center"
                          colSpan={band.columns.length}
                          sx={band.group.headSx}
                        >
                          {band.group.label}
                        </TableCell>
                      ) : (
                        headCell(band.columns[0], 2)
                      ),
                    )}
                  </TableRow>
                  <TableRow>
                    {bands
                      .filter((band) => band.group)
                      .flatMap((band) => band.columns.map((column) => headCell(column)))}
                  </TableRow>
                </>
              ) : (
                <TableRow>
                  {indexHeadCell}
                  {columns.map((column) => headCell(column))}
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
        )}
      </Box>

      {showPagination ? (
        <TablePagination
          component="div"
          count={rowCount}
          page={page - 1}
          onPageChange={(_, next) => onPageChange(next + 1)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(event) => onPageSizeChange?.(Number(event.target.value))}
          rowsPerPageOptions={onPageSizeChange && !isMobile ? pageSizeOptions : []}
          labelRowsPerPage={isMobile ? '' : 'Mỗi trang'}
          labelDisplayedRows={({ from, to, count }) =>
            isMobile ? `${from}–${to}/${count}` : `${from}–${to} / ${count} ${rowsLabel}`
          }
          sx={{ flexShrink: 0, borderTop: '1px solid #d5dbe0' }}
        />
      ) : null}
    </Paper>
  )
}

/** Nhãn của một cột khi hiển thị trong thẻ: ưu tiên `cardLabel`, rồi `group · header`. */
function cardLabelOf<T>(column: Column<T>): ReactNode {
  if (column.cardLabel != null) return column.cardLabel
  if (column.group) {
    return (
      <>
        {column.group.label} · {column.header}
      </>
    )
  }
  return column.header
}

/**
 * Dạng thẻ của bảng cho màn hẹp. Vai trò từng cột lấy từ `Column.card`; nếu
 * không cột nào khai báo `title` thì cột đầu tiên được dùng làm tiêu đề, và cột
 * `actions` tự nhận vai trò nút hành động.
 */
function CardList<T>({
  columns,
  rows,
  rowKey,
  cellContent,
  renderCard,
  showIndex,
  indexOffset,
  loading,
  showSkeleton,
  emptyText,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  cellContent: (column: Column<T>, row: T, index: number) => ReactNode
  renderCard?: (row: T, index: number) => ReactNode
  showIndex?: boolean
  indexOffset: number
  loading?: boolean
  showSkeleton?: boolean
  emptyText: ReactNode
}) {
  const declaredTitle = columns.some((column) => column.card === 'title')
  const roleOf = (column: Column<T>, index: number): CardRole => {
    if (column.card) return column.card
    if (column.key === 'actions') return 'actions'
    if (!declaredTitle && index === 0) return 'title'
    return 'body'
  }

  const titles: Column<T>[] = []
  const metas: Column<T>[] = []
  const bodies: Column<T>[] = []
  const actions: Column<T>[] = []
  columns.forEach((column, index) => {
    const role = roleOf(column, index)
    if (role === 'title') titles.push(column)
    else if (role === 'meta') metas.push(column)
    else if (role === 'actions') actions.push(column)
    else if (role === 'body') bodies.push(column)
  })

  if (showSkeleton) {
    return (
      <Stack spacing={1} sx={{ p: 1.5, width: '100%' }}>
        {Array.from({ length: 4 }, (_, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" />
            <Skeleton variant="text" width="40%" />
          </Paper>
        ))}
      </Stack>
    )
  }

  if (!loading && rows.length === 0) {
    return (
      <Box sx={{ p: 2, width: '100%', color: 'text.secondary' }}>{emptyText}</Box>
    )
  }

  return (
    <Stack spacing={1} sx={{ p: 1.5, width: '100%', minWidth: 0 }}>
      {rows.map((row, index) => {
        if (renderCard) return <Box key={rowKey(row, index)}>{renderCard(row, index)}</Box>

        return (
          <Paper key={rowKey(row, index)} variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
            >
              <Box sx={{ minWidth: 0 }}>
                {showIndex ? (
                  <Typography variant="caption" color="text.secondary">
                    #{indexOffset + index + 1}
                  </Typography>
                ) : null}
                {titles.map((column) => (
                  <Typography
                    key={column.key}
                    variant="subtitle2"
                    sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}
                  >
                    {cellContent(column, row, index)}
                  </Typography>
                ))}
                {metas.length ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.25, alignItems: 'center' }}
                  >
                    {metas.map((column) => (
                      <Typography key={column.key} variant="caption" color="text.secondary">
                        {cellContent(column, row, index)}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
              </Box>
              {actions.length ? (
                <Box sx={{ flexShrink: 0 }}>
                  {actions.map((column) => (
                    <Box key={column.key}>{cellContent(column, row, index)}</Box>
                  ))}
                </Box>
              ) : null}
            </Stack>

            {bodies.length ? (
              <>
                <Divider sx={{ my: 1 }} />
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    columnGap: 1.5,
                    rowGap: 0.5,
                  }}
                >
                  {bodies.map((column) => (
                    <Stack
                      key={column.key}
                      direction="row"
                      spacing={1}
                      sx={{ justifyContent: 'space-between', alignItems: 'baseline', minWidth: 0 }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {cardLabelOf(column)}
                      </Typography>
                      <Typography
                        variant="body2"
                        component="div"
                        sx={{
                          fontVariantNumeric: 'tabular-nums',
                          textAlign: 'right',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {cellContent(column, row, index)}
                      </Typography>
                    </Stack>
                  ))}
                </Box>
              </>
            ) : null}
          </Paper>
        )
      })}
    </Stack>
  )
}
