import { useState, type ReactNode } from 'react'
import { Box, Button, Collapse } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import TableChartIcon from '@mui/icons-material/TableChart'

/**
 * Bảng quá trình sản xuất (phiếu giấy Nguội → Hoàn thiện) rất dài — mặc định thu gọn để màn
 * chỉ còn trạng thái và nút thao tác; ai cần đối chiếu số liệu thì bấm mở. Bản in vẫn in đủ bảng.
 */
export function CollapsibleMatrix({
  label = 'Xem bảng quá trình sản xuất',
  children,
}: {
  label?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Box>
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        startIcon={open ? <ExpandLessIcon /> : <TableChartIcon />}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? 'Ẩn bảng quá trình sản xuất' : label}
      </Button>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ mt: 1 }}>{children}</Box>
      </Collapse>
    </Box>
  )
}
