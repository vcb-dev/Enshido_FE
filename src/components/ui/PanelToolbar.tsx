import { useState, type ReactNode } from 'react'
import {
  Badge,
  Box,
  Button,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'
import { useIsMobile } from '../../hooks/useBreakpoint'
import { SearchInput } from './SearchInput'

/**
 * Kích thước chuẩn cho một ô lọc trên thanh công cụ: cố định từ `sm`, và chiếm
 * trọn bề ngang khi rơi vào drawer lọc trên điện thoại.
 */
export const FILTER_FIELD_SX: SxProps<Theme> = {
  width: { xs: '100%', sm: 180 },
  flex: { sm: '0 0 auto' },
}

export type PanelToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  /** Bộ lọc phụ (SelectInput...) đặt ngay sau ô tìm kiếm. */
  filters?: ReactNode
  /** Số bộ lọc đang khác mặc định — hiện trên badge nút lọc. Lấy từ `useTableParams`. */
  filterCount?: number
  onClearFilters?: () => void
  createLabel: string
  onCreate: () => void
}

/**
 * Thanh công cụ chuẩn trên DataTable: tìm kiếm + bộ lọc + nút thêm ghim phải.
 *
 * Từ `sm` trở lên giữ nguyên một hàng như cũ. Dưới `sm` các ô lọc chuyển vào
 * drawer đáy — nếu để nguyên tại chỗ chúng xếp thành nhiều hàng và ăn hết màn
 * hình trước khi thấy được dòng dữ liệu nào.
 */
export function PanelToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  filterCount = 0,
  onClearFilters,
  createLabel,
  onCreate,
}: PanelToolbarProps) {
  const isMobile = useIsMobile()
  const [filterOpen, setFilterOpen] = useState(false)

  if (!isMobile) {
    return (
      <>
        <SearchInput value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />
        {filters}
        {filterCount > 0 && onClearFilters ? (
          <Button size="small" onClick={onClearFilters}>
            Xóa lọc
          </Button>
        ) : null}
        <Button variant="contained" sx={{ ml: 'auto' }} onClick={onCreate}>
          {createLabel}
        </Button>
      </>
    )
  }

  return (
    <>
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        sx={{ flex: 1 }}
      />
      {filters ? (
        <IconButton
          aria-label="Bộ lọc"
          onClick={() => setFilterOpen(true)}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
        >
          <Badge badgeContent={filterCount} color="primary">
            <TuneIcon fontSize="small" />
          </Badge>
        </IconButton>
      ) : null}
      <Button variant="contained" fullWidth onClick={onCreate}>
        {createLabel}
      </Button>

      <Drawer anchor="bottom" open={filterOpen} onClose={() => setFilterOpen(false)}>
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            Bộ lọc
          </Typography>
          <Stack spacing={1.5}>{filters}</Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end' }}>
            {onClearFilters ? (
              <Button
                onClick={() => {
                  onClearFilters()
                  setFilterOpen(false)
                }}
                disabled={filterCount === 0}
              >
                Xóa lọc
              </Button>
            ) : null}
            <Button variant="contained" onClick={() => setFilterOpen(false)}>
              Xong
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </>
  )
}
