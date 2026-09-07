import type { ReactNode } from 'react'
import { Button } from '@mui/material'
import { SearchInput } from './SearchInput'

export type PanelToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  /** Bộ lọc phụ (SelectInput...) đặt ngay sau ô tìm kiếm. */
  filters?: ReactNode
  createLabel: string
  onCreate: () => void
}

/** Thanh công cụ chuẩn trên DataTable: tìm kiếm + bộ lọc + nút thêm ghim phải. */
export function PanelToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  createLabel,
  onCreate,
}: PanelToolbarProps) {
  return (
    <>
      <SearchInput value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />
      {filters}
      <Button variant="contained" sx={{ ml: 'auto' }} onClick={onCreate}>
        {createLabel}
      </Button>
    </>
  )
}
