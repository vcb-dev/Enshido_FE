import type { ReactNode } from 'react'
import { Box, Divider, Stack, Typography } from '@mui/material'

export type VerticalInfoItem = {
  label: string
  value: ReactNode
}

/** Danh sách nhãn / giá trị một dòng một mục — dễ quét trên cả máy tính lẫn điện thoại. */
export function VerticalInfoList({ items }: { items: VerticalInfoItem[] }) {
  return (
    <Stack divider={<Divider flexItem />}>
      {items.map((item) => (
        <VerticalInfoRow key={item.label} label={item.label} value={item.value} />
      ))}
    </Stack>
  )
}

export function VerticalInfoRow({ label, value }: VerticalInfoItem) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '180px minmax(0, 1fr)' },
        gap: { xs: 0.25, sm: 2 },
        py: 1,
        minWidth: 0,
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        component="div"
        sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', minWidth: 0 }}
      >
        {value == null || value === '' ? '—' : value}
      </Typography>
    </Box>
  )
}
