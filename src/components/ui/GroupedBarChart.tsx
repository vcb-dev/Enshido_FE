import { Box, Stack, Tooltip, Typography } from '@mui/material'

export type ChartSeries = { key: string; label: string; color: string }

export type ChartBucket = {
  key: string
  /** Nhãn ngắn dưới trục x. */
  label: string
  /** Dòng đầu tooltip. */
  title: string
  values: Record<string, number>
  /** Chữ nhỏ trên đầu cột (vd "24 / 30"). */
  caption?: string
}

const GRID = '#e1e0d9'
const AXIS = '#c3c2b7'

const fmt = (value: number) => value.toLocaleString('vi-VN')

/** Mốc trục y tròn (1, 2, 5 × 10ⁿ) để vạch lưới dễ đọc. */
function niceMax(value: number) {
  if (value <= 4) return 4
  const step = 10 ** Math.floor(Math.log10(value / 4))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * step * 4 >= value) return m * step * 4
  }
  return value
}

export function ChartSwatch({ color }: { color: string }) {
  return (
    <Box
      component="span"
      sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: color, flexShrink: 0 }}
    />
  )
}

export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <Stack direction="row" spacing={1.5}>
      {series.map((s) => (
        <Stack key={s.key} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <ChartSwatch color={s.color} />
          <Typography variant="caption" color="text.secondary">
            {s.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  )
}

/** Cột nhóm vẽ bằng Box: mỗi mốc một nhóm cột theo `series`, trục y tự làm tròn, tooltip khi rê. */
export function GroupedBarChart({
  buckets,
  series,
  height = 160,
}: {
  buckets: ChartBucket[]
  series: ChartSeries[]
  height?: number
}) {
  const max = niceMax(
    Math.max(0, ...buckets.flatMap((b) => series.map((s) => b.values[s.key] ?? 0))),
  )
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  // Nhãn trục x thưa để không chồng nhau: tối đa ~12 nhãn.
  const labelEvery = Math.ceil(buckets.length / 12)
  const hasCaption = buckets.some((b) => b.caption)

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {/* Trục y */}
      <Box
        sx={{ position: 'relative', width: 28, height, flexShrink: 0, mt: hasCaption ? 2.5 : 0 }}
      >
        {ticks.map((tick) => (
          <Typography
            key={tick}
            variant="caption"
            color="text.secondary"
            sx={{
              position: 'absolute',
              right: 0,
              bottom: `${(tick / max) * 100}%`,
              transform: 'translateY(50%)',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmt(tick)}
          </Typography>
        ))}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {hasCaption ? (
          <Box sx={{ display: 'flex', height: 20, mb: 0.5 }}>
            {buckets.map((bucket) => (
              <Typography
                key={bucket.key}
                variant="caption"
                color="text.secondary"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {bucket.caption}
              </Typography>
            ))}
          </Box>
        ) : null}
        <Box sx={{ position: 'relative', height }}>
          {ticks.map((tick) => (
            <Box
              key={tick}
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${(tick / max) * 100}%`,
                borderTop: `1px solid ${tick === 0 ? AXIS : GRID}`,
              }}
            />
          ))}
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex' }}>
            {buckets.map((bucket) => (
              <Tooltip
                key={bucket.key}
                arrow
                placement="top"
                title={
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                      {bucket.title}
                    </Typography>
                    {series.map((s) => (
                      <Stack key={s.key} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                        <ChartSwatch color={s.color} />
                        <Typography variant="caption">
                          {s.label}: {fmt(bucket.values[s.key] ?? 0)}
                        </Typography>
                      </Stack>
                    ))}
                  </Box>
                }
              >
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: '2px',
                    px: '12%',
                    '&:hover': { bgcolor: 'rgba(11,11,11,0.04)' },
                  }}
                >
                  {series.map((s) => {
                    const value = bucket.values[s.key] ?? 0
                    return (
                      <Box
                        key={s.key}
                        sx={{
                          flex: 1,
                          maxWidth: 24,
                          height: `${(value / max) * 100}%`,
                          minHeight: value > 0 ? 2 : 0,
                          bgcolor: s.color,
                          borderRadius: '4px 4px 0 0',
                        }}
                      />
                    )
                  })}
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>
        {/* Trục x */}
        <Box sx={{ display: 'flex', mt: 0.5 }}>
          {buckets.map((bucket, i) => (
            <Typography
              key={bucket.key}
              variant="caption"
              color="text.secondary"
              sx={{ flex: 1, minWidth: 0, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}
            >
              {i % labelEvery === 0 ? bucket.label : ''}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
