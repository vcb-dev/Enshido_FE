import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
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
import { keyframes, type Breakpoint } from '@mui/material/styles'
import TuneIcon from '@mui/icons-material/Tune'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import { useIsCardMode, useIsCompact, useIsMobile } from '../../hooks/useBreakpoint'
import type { SortDir } from '../../hooks/useTableParams'

/** Nhóm tiêu đề bậc 1 gộp nhiều cột liền kề (vd: "Nhập" gộp SL + TT). */
export type ColumnGroup = {
  key: string
  label: ReactNode
  headSx?: SxProps<Theme>
}

export type Column<T, S = never> = {
  /** Định danh cột, cũng là khoá sắp xếp mặc định. */
  key: string
  header: ReactNode
  /** Tự vẽ ô. Không truyền thì lấy `row[field]` hoặc `row[key]`. */
  render?: (row: T, index: number) => ReactNode
  /**
   * Ô của dòng con (xem `DataTableProps.subRows`). Không khai thì ô để trống — dòng con chỉ
   * nên hiện những gì khác dòng cha, phần kế thừa để trống cho dễ đọc.
   */
  renderSub?: (sub: S, parent: T) => ReactNode
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
  /** Ô lọc trên hàng filter, cùng cột với tiêu đề. */
  filter?: ReactNode
}

/**
 * `title` in đậm ở đầu thẻ, `meta` là dòng phụ nhạt màu, `body` vào lưới
 * nhãn / giá trị, `actions` ghim bên phải đầu thẻ, `hidden` bị bỏ qua.
 */
export type CardRole = 'title' | 'meta' | 'body' | 'actions' | 'hidden'

/**
 * Dòng con xổ ra dưới dòng cha (vd. phiếu con dưới đơn mẹ), dùng chung bộ cột với dòng cha —
 * mỗi cột tự vẽ ô dòng con qua `Column.renderSub`. Dòng có con thì bấm vào dòng (hoặc mũi tên
 * ở cột đầu) để xổ / thu; tiêu đề cột đầu có nút xổ / thu tất cả.
 */
export type SubRowsConfig<T, S> = {
  /** Các dòng con của một dòng; rỗng thì dòng đó không có mũi tên. */
  get: (row: T) => S[]
  key: (sub: S) => string
  /** Tên gọi theo số lượng, cho tooltip và trình đọc màn hình — vd `3 phiếu con`. */
  label?: (count: number) => string
  /** Tự xổ các dòng có con; đổi key để xổ lại khi ngữ cảnh lọc thay đổi. */
  autoExpandKey?: string
}

export type DataTableProps<T, S = never> = {
  columns: Column<T, S>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  subRows?: SubRowsConfig<T, S>
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
  /** Dòng có dòng con thì bấm vào là xổ / thu, không gọi `onRowClick`. */
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
  '& .col-filter-row .MuiTableCell-root': {
    border: '0 !important',
    borderTop: '0 !important',
    bgcolor: '#fff !important',
    backgroundColor: '#fff !important',
    backgroundImage: 'none',
    py: '4px !important',
    px: '4px !important',
    whiteSpace: 'normal',
    overflow: 'visible',
    boxShadow: 'none',
  },
} as const

function defaultCell(value: unknown): ReactNode {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  return String(value)
}

const subRowIn = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })

/** Dòng con: nền nhạt hơn dòng cha, hiện dần khi xổ ra. */
const SUB_ROW_SX = { bgcolor: '#f6f8fa', animation: `${subRowIn} 160ms ease-out` } as const
/** Dòng cha đang xổ: tô nhẹ để nhìn ra nhóm. */
const OPEN_PARENT_SX = { bgcolor: '#eef3f8', cursor: 'pointer' } as const

/**
 * Bấm vào link / nút / ô nhập bên trong dòng thì để chúng tự xử lý, không xổ / thu dòng.
 * Kéo chuột bôi đen chữ cũng không tính là bấm.
 */
function isToggleClick(event: MouseEvent) {
  if (typeof window !== 'undefined' && window.getSelection()?.toString()) return false
  const target = event.target
  return !(
    target instanceof Element &&
    target.closest(
      'a, button, input, textarea, select, label, [role="button"], [role="checkbox"], [role="menuitem"]',
    )
  )
}

/** Mũi tên xổ / thu ở cột đầu. */
function ExpandButton({
  open,
  label,
  onToggle,
}: {
  open: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <Tooltip title={open ? `Thu gọn ${label}` : `Xem ${label}`}>
      <IconButton
        size="small"
        aria-expanded={open}
        aria-label={open ? `Thu gọn ${label}` : `Xem ${label}`}
        onClick={onToggle}
        sx={{ p: 0.25 }}
      >
        <KeyboardArrowRightIcon
          fontSize="small"
          sx={{ transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'none' }}
        />
      </IconButton>
    </Tooltip>
  )
}

/**
 * Bảng dùng chung: sắp xếp, phân trang, trạng thái đang tải / lỗi / rỗng.
 * Ghép với [useTableParams](../../hooks/useTableParams.ts) để lưu trạng thái lên URL.
 */
export function DataTable<T, S = never>({
  columns,
  rows,
  rowKey,
  subRows,
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
}: DataTableProps<T, S>) {
  // Dưới `md` cả app chuyển sang một cổng cuộn duy nhất (Box trong AppShell):
  // bảng bỏ khoá chiều cao và bỏ sticky header, nội dung chảy ra ngoài.
  const flowMode = useIsCompact()
  const cardMode = useIsCardMode(cardBreakpoint)
  const isMobile = useIsMobile()

  // Dòng đang xổ, theo `rowKey`. Giữ nguyên qua các lần làm mới dữ liệu.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const subsOf = (row: T): S[] => subRows?.get(row) ?? []
  const labelOf = (count: number) => subRows?.label?.(count) ?? `${count} dòng con`
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const expandableKeys = subRows
    ? rows.flatMap((row, index) => (subsOf(row).length ? [rowKey(row, index)] : []))
    : []
  const expandableKeyToken = expandableKeys.join('\u0000')

  useEffect(() => {
    if (!subRows?.autoExpandKey || expandableKeys.length === 0) return
    setExpanded((current) => {
      const next = new Set(current)
      for (const key of expandableKeys) next.add(key)
      return next
    })
  }, [expandableKeyToken, subRows?.autoExpandKey])
  const allOpen = expandableKeys.length > 0 && expandableKeys.every((key) => expanded.has(key))
  const toggleAll = () =>
    setExpanded((current) => {
      const next = new Set(current)
      for (const key of expandableKeys) {
        if (allOpen) next.delete(key)
        else next.add(key)
      }
      return next
    })

  const showPagination = page != null && pageSize != null && onPageChange != null
  const rowCount = total ?? rows.length
  const showSkeleton = loading && rows.length === 0
  // Cột đầu: STT, và mũi tên xổ / thu nếu bảng có dòng con.
  const leadCol = Boolean(showIndex || subRows)
  // Khóa cứng: table-layout:fixed lấy độ rộng từ hàng đầu (hàng lọc), ô STT
  // hàng đó nếu không có width sẽ nuốt hết phần dư khi bảng giãn 100%.
  const leadColWidth = showIndex ? (subRows ? 72 : 44) : 44
  const leadColSx = {
    width: leadColWidth,
    minWidth: leadColWidth,
    maxWidth: leadColWidth,
    boxSizing: 'border-box' as const,
    px: 0.5,
  }
  const colCount = columns.length + (leadCol ? 1 : 0)
  const showFilterRow = columns.some((column) => column.filter != null)

  function cellContent(column: Column<T, S>, row: T, index: number): ReactNode {
    return column.render
      ? column.render(row, index)
      : defaultCell((row as Record<string, unknown>)[(column.field as string) ?? column.key])
  }

  /** Một ô thân bảng — dùng chung cho dòng cha và dòng con để canh lề / cắt chữ giống nhau. */
  function bodyCell(column: Column<T, S>, content: ReactNode) {
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
      <Tooltip key={column.key} title={content} disableHoverListener={!content || content === '—'}>
        {cell}
      </Tooltip>
    )
  }

  // Gom cột liền kề cùng nhóm thành từng dải; cột không nhóm là dải một cột.
  const bands: Array<{ group?: ColumnGroup; columns: Column<T, S>[] }> = []
  for (const column of columns) {
    const last = bands[bands.length - 1]
    if (column.group && last?.group?.key === column.group.key) last.columns.push(column)
    else bands.push({ group: column.group, columns: [column] })
  }
  const grouped = bands.some((band) => band.group)

  function headCell(column: Column<T, S>, rowSpan?: number) {
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

  const indexHeadCell = leadCol ? (
    <TableCell
      align="center"
      rowSpan={grouped ? 2 : undefined}
      sx={leadColSx}
    >
      <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', justifyContent: 'center' }}>
        {subRows && expandableKeys.length ? (
          <Tooltip title={allOpen ? 'Thu gọn tất cả' : 'Xổ tất cả'}>
            <IconButton
              size="small"
              aria-label={allOpen ? 'Thu gọn tất cả' : 'Xổ tất cả'}
              onClick={toggleAll}
              sx={{ p: 0.25 }}
            >
              {allOpen ? <UnfoldLessIcon fontSize="small" /> : <UnfoldMoreIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        ) : null}
        {showIndex ? <span>STT</span> : null}
      </Stack>
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

      {cardMode && showFilterRow ? <CardFilters columns={columns} /> : null}

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
            subRows={subRows}
            expanded={expanded}
            onToggle={toggle}
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
            {leadCol || columns.some((column) => column.width != null) ? (
              <colgroup>
                {leadCol ? <col style={{ width: leadColWidth, minWidth: leadColWidth }} /> : null}
                {columns.map((column) => (
                  <col key={column.key} style={column.width != null ? { width: column.width } : undefined} />
                ))}
              </colgroup>
            ) : null}
            <TableHead>
              {showFilterRow ? (
                <TableRow className="col-filter-row" sx={{ bgcolor: '#fff' }}>
                  {leadCol ? <TableCell sx={leadColSx} /> : null}
                  {columns.map((column) => (
                    <TableCell key={column.key}>{column.filter}</TableCell>
                  ))}
                </TableRow>
              ) : null}
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
                : rows.flatMap((row, index) => {
                    const key = rowKey(row, index)
                    const subs = subsOf(row)
                    const open = subs.length > 0 && expanded.has(key)
                    const parent = (
                      <TableRow
                        key={key}
                        hover
                        selected={isRowSelected?.(row) ?? false}
                        onClick={
                          subs.length
                            ? (event) => {
                                if (isToggleClick(event)) toggle(key)
                              }
                            : onRowClick
                              ? () => onRowClick(row)
                              : undefined
                        }
                        sx={
                          open
                            ? OPEN_PARENT_SX
                            : subs.length || onRowClick
                              ? { cursor: 'pointer' }
                              : undefined
                        }
                      >
                        {leadCol ? (
                          <TableCell align="center" sx={leadColSx}>
                            <Stack
                              direction="row"
                              spacing={0.25}
                              sx={{ alignItems: 'center', justifyContent: 'center' }}
                            >
                              {subRows ? (
                                subs.length ? (
                                  <ExpandButton
                                    open={open}
                                    label={labelOf(subs.length)}
                                    onToggle={() => toggle(key)}
                                  />
                                ) : (
                                  // Giữ chỗ để STT các dòng không có con vẫn thẳng cột.
                                  <Box sx={{ width: 24, flexShrink: 0 }} />
                                )
                              ) : null}
                              {showIndex ? <span>{indexOffset + index + 1}</span> : null}
                            </Stack>
                          </TableCell>
                        ) : null}
                        {columns.map((column) => bodyCell(column, cellContent(column, row, index)))}
                      </TableRow>
                    )
                    if (!open || !subRows) return [parent]
                    return [
                      parent,
                      ...subs.map((sub) => (
                        <TableRow key={`${key}::${subRows.key(sub)}`} hover sx={SUB_ROW_SX}>
                          {leadCol ? (
                            <TableCell align="right" sx={leadColSx}>
                              <SubdirectoryArrowRightIcon
                                fontSize="small"
                                sx={{ color: 'text.disabled', verticalAlign: 'middle' }}
                              />
                            </TableCell>
                          ) : null}
                          {columns.map((column) =>
                            bodyCell(column, column.renderSub ? column.renderSub(sub, row) : null),
                          )}
                        </TableRow>
                      )),
                    ]
                  })}

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
function cardLabelOf<T, S>(column: Column<T, S>): ReactNode {
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
/** Chế độ thẻ không có hàng tiêu đề, nên ô lọc của từng cột gom vào một khối thu gọn. */
function CardFilters<T, S>({ columns }: { columns: Column<T, S>[] }) {
  const [open, setOpen] = useState(false)
  const filterable = columns.filter((column) => column.filter != null)

  return (
    <Box sx={{ px: 1.5, pb: 1, flexShrink: 0 }}>
      <Button
        size="small"
        startIcon={<TuneIcon fontSize="small" />}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Ẩn bộ lọc' : 'Bộ lọc'}
      </Button>
      <Collapse in={open} unmountOnExit>
        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            pt: 1,
          }}
        >
          {filterable.map((column) => (
            <Box key={column.key} sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {column.cardLabel ?? column.header}
              </Typography>
              {column.filter}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

function CardList<T, S>({
  columns,
  rows,
  rowKey,
  cellContent,
  renderCard,
  subRows,
  expanded,
  onToggle,
  showIndex,
  indexOffset,
  loading,
  showSkeleton,
  emptyText,
}: {
  columns: Column<T, S>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  cellContent: (column: Column<T, S>, row: T, index: number) => ReactNode
  renderCard?: (row: T, index: number) => ReactNode
  subRows?: SubRowsConfig<T, S>
  expanded: ReadonlySet<string>
  onToggle: (key: string) => void
  showIndex?: boolean
  indexOffset: number
  loading?: boolean
  showSkeleton?: boolean
  emptyText: ReactNode
}) {
  const declaredTitle = columns.some((column) => column.card === 'title')
  const roleOf = (column: Column<T, S>, index: number): CardRole => {
    if (column.card) return column.card
    if (column.key === 'actions') return 'actions'
    if (!declaredTitle && index === 0) return 'title'
    return 'body'
  }

  const titles: Column<T, S>[] = []
  const metas: Column<T, S>[] = []
  const bodies: Column<T, S>[] = []
  const actions: Column<T, S>[] = []
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
        const key = rowKey(row, index)
        const subs = subRows?.get(row) ?? []
        const open = expanded.has(key)

        return (
          <Paper key={key} variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
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

            {subRows && subs.length ? (
              <>
                <Button
                  size="small"
                  aria-expanded={open}
                  onClick={() => onToggle(key)}
                  startIcon={
                    <KeyboardArrowRightIcon
                      sx={{ transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'none' }}
                    />
                  }
                  sx={{ mt: 1, px: 0.5 }}
                >
                  {subRows.label?.(subs.length) ?? `${subs.length} dòng con`}
                </Button>
                <Collapse in={open} unmountOnExit>
                  <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                    {subs.map((sub) => {
                      // Thẻ con chỉ hiện những cột có `renderSub` — phần kế thừa từ dòng cha bỏ qua.
                      const has = (column: Column<T, S>) => column.renderSub != null
                      const subCell = (column: Column<T, S>) => column.renderSub!(sub, row)
                      return (
                        <Paper
                          key={subRows.key(sub)}
                          variant="outlined"
                          sx={{ p: 1, bgcolor: '#f6f8fa', minWidth: 0 }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              {titles.filter(has).map((column) => (
                                <Typography
                                  key={column.key}
                                  variant="body2"
                                  component="div"
                                  sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}
                                >
                                  {subCell(column)}
                                </Typography>
                              ))}
                              <Stack
                                direction="row"
                                sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.25, alignItems: 'center' }}
                              >
                                {metas.filter(has).map((column) => (
                                  <Box key={column.key}>{subCell(column)}</Box>
                                ))}
                              </Stack>
                            </Box>
                            {actions.filter(has).map((column) => (
                              <Box key={column.key} sx={{ flexShrink: 0 }}>
                                {subCell(column)}
                              </Box>
                            ))}
                          </Stack>
                          {bodies.filter(has).map((column) => (
                            <Stack
                              key={column.key}
                              direction="row"
                              spacing={1}
                              sx={{ justifyContent: 'space-between', alignItems: 'baseline', mt: 0.5 }}
                            >
                              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                {cardLabelOf(column)}
                              </Typography>
                              <Typography
                                variant="body2"
                                component="div"
                                sx={{ textAlign: 'right', overflowWrap: 'anywhere' }}
                              >
                                {subCell(column)}
                              </Typography>
                            </Stack>
                          ))}
                        </Paper>
                      )
                    })}
                  </Stack>
                </Collapse>
              </>
            ) : null}
          </Paper>
        )
      })}
    </Stack>
  )
}
