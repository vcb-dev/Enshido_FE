import { Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import {
  currentMonthPeriod,
  monthPeriod,
  periodMonth,
  setWarehousePeriod,
  shiftMonth,
  useWarehousePeriod,
} from './warehousePeriod'

/**
 * Chọn kỳ xem kho (mặc định tháng hiện tại): Tồn tính đầu kỳ / nhập / xuất / cuối kỳ trong kỳ,
 * Nhập và Xuất chỉ hiện phiếu trong kỳ. Bấm mũi tên để lùi / tới từng tháng.
 */
export function WarehousePeriodBar() {
  const period = useWarehousePeriod()
  const month = periodMonth(period)
  const thisMonth = currentMonthPeriod()
  const isThisMonth = period.from === thisMonth.from && period.to === thisMonth.to
  // Kỳ tự chọn: mũi tên nhảy theo tháng của ngày bắt đầu.
  const anchor = month || period.from.slice(0, 7)
  const [y, m] = anchor.split('-')

  return (
    <Stack
      direction="row"
      sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, justifyContent: { sm: 'flex-end' } }}
    >
      <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
        <IconButton
          size="small"
          aria-label="Tháng trước"
          onClick={() => setWarehousePeriod(monthPeriod(shiftMonth(anchor, -1)))}
        >
          <ChevronLeftIcon />
        </IconButton>
        <Tooltip title={month ? '' : 'Đang xem khoảng ngày tự chọn'}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, minWidth: 104, textAlign: 'center', whiteSpace: 'nowrap' }}
          >
            {month ? `Tháng ${m}/${y}` : 'Tự chọn'}
          </Typography>
        </Tooltip>
        <IconButton
          size="small"
          aria-label="Tháng sau"
          onClick={() => setWarehousePeriod(monthPeriod(shiftMonth(anchor, 1)))}
        >
          <ChevronRightIcon />
        </IconButton>
      </Stack>
      <TextField
        size="small"
        type="date"
        label="Từ ngày"
        value={period.from}
        onChange={(event) => {
          const from = event.target.value
          if (!from) return
          setWarehousePeriod({ from, to: from > period.to ? from : period.to })
        }}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ width: 160 }}
      />
      <TextField
        size="small"
        type="date"
        label="Đến ngày"
        value={period.to}
        onChange={(event) => {
          const to = event.target.value
          if (!to) return
          setWarehousePeriod({ from: to < period.from ? to : period.from, to })
        }}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: period.from } }}
        sx={{ width: 160 }}
      />
      {isThisMonth ? null : (
        <Button size="small" onClick={() => setWarehousePeriod(thisMonth)}>
          Tháng này
        </Button>
      )}
    </Stack>
  )
}
