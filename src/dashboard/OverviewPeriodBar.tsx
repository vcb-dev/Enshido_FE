import { Box, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import type { OverviewGroup } from '../api/productionOrders'
import { SelectInput } from '../components/ui'
import { todayKey } from './lossReport'
import {
  GROUP_OPTIONS,
  MAX_DAY_BUCKETS,
  periodDays,
  presetPeriod,
  PRESET_OPTIONS,
  rangeLabel,
  type OverviewPeriod,
  type PeriodPreset,
} from './overviewPeriod'

/**
 * Thanh lọc kỳ của màn Tổng quan: chọn nhanh / tuỳ chọn ngày, xem theo ngày / tuần / tháng. Kỳ trước
 * (để so sánh) do server tính và hiện ở dòng chú thích.
 */
export function OverviewPeriodBar({
  value,
  onChange,
  previous,
}: {
  value: OverviewPeriod
  onChange: (next: OverviewPeriod) => void
  previous?: { from: string; to: string }
}) {
  const today = todayKey()
  const tooLongForDays = periodDays(value.from, value.to) > MAX_DAY_BUCKETS

  // Sửa tay ngày → Tuỳ chọn; kỳ dài quá thì tự chuyển sang xem theo tuần.
  const setRange = (from: string, to: string) => {
    if (!from || !to) return
    const groupBy: OverviewGroup =
      value.groupBy === 'day' && periodDays(from, to) > MAX_DAY_BUCKETS ? 'week' : value.groupBy
    onChange({ preset: 'custom', from, to, groupBy })
  }

  return (
    <Paper variant="outlined" sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap', rowGap: 1.25 }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr 1fr', sm: '180px 160px 160px' },
          }}
        >
          <SelectInput<PeriodPreset>
            size="small"
            label="Kỳ xem"
            options={PRESET_OPTIONS}
            value={value.preset}
            onChange={(preset) => {
              const next = preset ? presetPeriod(preset, today) : null
              if (preset && next) onChange({ preset, ...next })
              else onChange({ ...value, preset: 'custom' })
            }}
            sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
          />
          <TextField
            size="small"
            type="date"
            label="Từ ngày"
            value={value.from}
            onChange={(event) => setRange(event.target.value, value.to)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: value.to } }}
          />
          <TextField
            size="small"
            type="date"
            label="Đến ngày"
            value={value.to}
            onChange={(event) => setRange(value.from, event.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: value.from, max: today } }}
          />
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Xem theo
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={value.groupBy}
            onChange={(_, groupBy: OverviewGroup | null) => groupBy && onChange({ ...value, groupBy })}
          >
            {GROUP_OPTIONS.map((option) => (
              <ToggleButton
                key={option.value}
                value={option.value}
                disabled={option.value === 'day' && tooLongForDays}
                sx={{ px: 1.75 }}
              >
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 200 }}>
          Kỳ {rangeLabel(value.from, value.to)}
          {previous ? ` · so với kỳ trước ${rangeLabel(previous.from, previous.to)}` : ''}
          {tooLongForDays ? ` · kỳ dài hơn ${MAX_DAY_BUCKETS} ngày chỉ xem theo tuần / tháng` : ''}
        </Typography>
      </Stack>
    </Paper>
  )
}
