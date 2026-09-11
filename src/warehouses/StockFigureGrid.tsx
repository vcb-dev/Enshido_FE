import { Fragment } from 'react'
import { Box, TextField, Typography } from '@mui/material'
import { formatMoney, formatQty, formatQtyInput, parseQtyInput } from '../api/inventory'
import { useIsMobile } from '../hooks/useBreakpoint'

export type StockFigures = {
  openingQty: string
  openingAmount: string
  inQty: string
  inAmount: string
  outQty: string
  outAmount: string
  qty: string
  amount: string
}

const GROUPS = [
  { key: 'open', label: 'Tồn đầu kỳ', bg: '#edf1f4', note: 'TT = SL × đơn giá tồn' },
  { key: 'in', label: 'Nhập', bg: '#e4f0e8', note: 'Tổng phiếu nhập (Σ SL × đơn giá)' },
  { key: 'out', label: 'Xuất', bg: '#f3ebe7', note: 'Tổng phiếu xuất theo ngày' },
  { key: 'stock', label: 'Tồn kho', bg: '#d6e3ee', note: 'Công thức cố định' },
] as const

const LINE = '#b7c2cc'

/**
 * Lưới 4 nhóm (Tồn đầu kỳ / Nhập / Xuất / Tồn kho) × 2 dòng SL / TT, dùng chung
 * cho hộp thoại sửa NVL và thẻ NVL trên màn hẹp.
 *
 * Đường kẻ là khe `gap` 1px trên nền `LINE` — mọi ô con đều có nền đục nên khe
 * hiện ra thành viền, không phụ thuộc số cột như cách dùng `nth-of-type(5n)`.
 *
 * Ở khổ hẹp phải *xoay trục* chứ không chỉ đổi `gridTemplateColumns`: 72px + 4
 * cột số trên màn 360px chỉ còn ~52px mỗi ô, không đủ hiện `1.234.567`.
 */
export function StockFigureGrid({
  values,
  notes,
  editableOpeningQty,
  orientation,
}: {
  values: StockFigures
  /** Hiện phụ đề công thức dưới tên nhóm (dùng trong hộp thoại). */
  notes?: boolean
  /** Cho sửa ô SL của "Tồn đầu kỳ". */
  editableOpeningQty?: { value: string; onChange: (value: string) => void }
  /** Bỏ trống thì tự chọn theo bề ngang màn hình. */
  orientation?: 'columns' | 'rows'
}) {
  const isMobile = useIsMobile()
  const layout = orientation ?? (isMobile ? 'rows' : 'columns')
  // Phụ đề công thức chỉ đọc được ở trục ngang; xếp dọc thì nó đội ô nhóm lên 3 dòng.
  const showNotes = notes && layout === 'columns'

  const qtyOf: Record<string, string> = {
    open: values.openingQty,
    in: values.inQty,
    out: values.outQty,
    stock: values.qty,
  }
  const amountOf: Record<string, string> = {
    open: values.openingAmount,
    in: values.inAmount,
    out: values.outAmount,
    stock: values.amount,
  }

  function qtyCell(groupKey: string) {
    if (groupKey === 'open' && editableOpeningQty) {
      return (
        <EditableCell
          value={formatQtyInput(editableOpeningQty.value)}
          onChange={(raw) => editableOpeningQty.onChange(parseQtyInput(raw))}
        />
      )
    }
    return <ValueCell value={formatQty(qtyOf[groupKey])} />
  }

  function amountCell(groupKey: string) {
    const raw = amountOf[groupKey]
    return <ValueCell value={formatMoney(groupKey === 'open' || groupKey === 'stock' ? raw || '0' : raw)} />
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gap: '1px',
        bgcolor: LINE,
        border: `1px solid ${LINE}`,
        borderRadius: 1,
        overflow: 'hidden',
        gridTemplateColumns:
          layout === 'columns'
            ? '72px repeat(4, minmax(0, 1fr))'
            : '76px minmax(0, 1fr) minmax(0, 1.3fr)',
        '& > *': { px: 1, py: 0.85, minWidth: 0 },
      }}
    >
      {layout === 'columns' ? (
        <>
          <CornerCell />
          {GROUPS.map((group) => (
            <GroupCell key={group.key} group={group} notes={showNotes} align="center" />
          ))}
          <AxisCell label="SL" />
          {GROUPS.map((group) => (
            <Fragment key={group.key}>{qtyCell(group.key)}</Fragment>
          ))}
          <AxisCell label="TT" />
          {GROUPS.map((group) => (
            <Fragment key={group.key}>{amountCell(group.key)}</Fragment>
          ))}
        </>
      ) : (
        <>
          <CornerCell />
          <AxisCell label="SL" align="right" />
          <AxisCell label="TT" align="right" />
          {GROUPS.map((group) => (
            <Fragment key={group.key}>
              <GroupCell group={group} notes={showNotes} align="left" />
              {qtyCell(group.key)}
              {amountCell(group.key)}
            </Fragment>
          ))}
        </>
      )}
    </Box>
  )
}

function CornerCell() {
  return <Box sx={{ bgcolor: '#f4f6f7' }} />
}

function AxisCell({ label, align = 'left' }: { label: string; align?: 'left' | 'right' }) {
  return (
    <Box
      sx={{
        bgcolor: '#f4f6f7',
        fontSize: 12,
        fontWeight: 700,
        color: 'text.secondary',
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {label}
    </Box>
  )
}

function GroupCell({
  group,
  notes,
  align,
}: {
  group: (typeof GROUPS)[number]
  notes?: boolean
  align: 'left' | 'center'
}) {
  return (
    <Box
      sx={{
        bgcolor: group.bg,
        fontWeight: 700,
        fontSize: 13,
        textAlign: align,
        color: group.key === 'stock' ? 'primary.main' : 'text.primary',
        lineHeight: 1.25,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {group.label}
      {notes ? (
        <Typography
          component="span"
          sx={{ fontWeight: 500, fontSize: 11, color: 'text.secondary', fontStyle: 'italic', mt: 0.25 }}
        >
          {group.note}
        </Typography>
      ) : null}
    </Box>
  )
}

function ValueCell({ value }: { value: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        fontVariantNumeric: 'tabular-nums',
        color: 'text.secondary',
        bgcolor: '#fbfcfd',
      }}
    >
      {value}
    </Box>
  )
}

function EditableCell({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Box sx={{ p: '4px !important', bgcolor: '#fff' }}>
      <TextField
        value={value}
        onChange={(event) => onChange(event.target.value)}
        size="small"
        fullWidth
        hiddenLabel
        slotProps={{
          htmlInput: {
            inputMode: 'decimal',
            style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '6px 4px' },
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root': { bgcolor: '#fff' },
          '& fieldset': { borderColor: '#d5dbe0' },
        }}
      />
    </Box>
  )
}
