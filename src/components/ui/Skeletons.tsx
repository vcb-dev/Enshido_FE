import type { ReactNode } from 'react'
import { Box, Container, Paper, Skeleton, Stack } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

/**
 * Khung chờ cho màn đang tải: bám đúng bố cục thật (PageHeader, thẻ Paper, bảng…) để lúc dữ
 * liệu về trang không nhảy. Chỉ dựng từ `Skeleton` của MUI, không gọi API.
 */

const LINE_WIDTHS = ['92%', '78%', '85%', '64%', '88%', '72%']

/** Vài dòng chữ độ dài so le. */
export function LinesSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Stack spacing={0.25}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} variant="text" width={LINE_WIDTHS[index % LINE_WIDTHS.length]} />
      ))}
    </Stack>
  )
}

/** Cùng bố cục với PageHeader: breadcrumbs, tiêu đề + chip, subtitle, cụm nút bên phải. */
export function PageHeaderSkeleton({
  breadcrumbs = false,
  subtitle = true,
  chips = 0,
  actions = 0,
}: {
  breadcrumbs?: boolean
  subtitle?: boolean
  /** Số chip trạng thái cạnh tiêu đề. */
  chips?: number
  /** Số nút ở góc phải; nút đầu rộng, các nút sau là nút vuông. */
  actions?: number
}) {
  return (
    <Stack spacing={1} sx={{ flexShrink: 0 }}>
      {breadcrumbs ? (
        <Skeleton variant="text" width={180} sx={{ display: { xs: 'none', sm: 'block' } }} />
      ) : null}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 1.5 }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Skeleton variant="text" sx={{ fontSize: '1.5rem', width: { xs: '55%', sm: 240 } }} />
            {Array.from({ length: chips }, (_, index) => (
              <Skeleton key={index} variant="rounded" width={72} height={24} />
            ))}
          </Stack>
          {subtitle ? <Skeleton variant="text" sx={{ width: { xs: '85%', sm: 380 } }} /> : null}
        </Stack>
        {actions ? (
          <Stack direction="row" spacing={1}>
            {Array.from({ length: actions }, (_, index) => (
              <Skeleton key={index} variant="rounded" width={index === 0 ? 108 : 34} height={32} />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  )
}

/** Hàng tab. `paper` khi tab nằm trong thẻ (trang chi tiết), không thì gạch chân như trang danh sách. */
export function TabsSkeleton({ count = 4, paper = false }: { count?: number; paper?: boolean }) {
  const tabs = (
    <Stack direction="row" spacing={3} sx={{ px: 1.5, height: paper ? 42 : 40, alignItems: 'center', overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} variant="text" width={index === 0 ? 64 : 84} sx={{ flexShrink: 0 }} />
      ))}
    </Stack>
  )
  if (paper) return <Paper sx={{ px: { xs: 0.5, md: 1 }, flexShrink: 0 }}>{tabs}</Paper>
  return <Box sx={{ flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>{tabs}</Box>
}

/** Lưới cặp nhãn / giá trị như khối "Thông tin đơn". */
export function FieldGridSkeleton({
  count = 8,
  columns = { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
}: {
  count?: number
  columns?: Record<string, string> | string
}) {
  return (
    <Box sx={{ display: 'grid', columnGap: 2, rowGap: 1.25, gridTemplateColumns: columns }}>
      {Array.from({ length: count }, (_, index) => (
        <Box key={index} sx={{ minWidth: 0 }}>
          <Skeleton variant="text" width="45%" sx={{ fontSize: '0.75rem' }} />
          <Skeleton variant="text" width={index % 3 === 1 ? '60%' : '80%'} />
        </Box>
      ))}
    </Box>
  )
}

/** Thẻ Paper có tiêu đề: mặc định vài dòng chữ, hoặc nội dung skeleton truyền vào. */
export function SectionSkeleton({
  title = true,
  action = false,
  lines = 3,
  children,
  sx,
}: {
  title?: boolean
  /** Nút nhỏ bên phải tiêu đề. */
  action?: boolean
  lines?: number
  children?: ReactNode
  sx?: SxProps<Theme>
}) {
  return (
    <Paper sx={{ p: { xs: 1.5, md: 2 }, ...sx }}>
      {title || action ? (
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.25, gap: 1 }}>
          {title ? <Skeleton variant="text" width={170} sx={{ fontSize: '1rem' }} /> : <span />}
          {action ? <Skeleton variant="rounded" width={84} height={30} /> : null}
        </Stack>
      ) : null}
      {children ?? <LinesSkeleton lines={lines} />}
    </Paper>
  )
}

/** Hàng ô số liệu như SummaryStat. */
export function StatRowSkeleton({
  count = 4,
  columns = { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
}: {
  count?: number
  columns?: Record<string, string> | string
}) {
  return (
    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: columns }}>
      {Array.from({ length: count }, (_, index) => (
        <Box
          key={index}
          sx={{ border: '1px solid #ded3c3', borderLeft: '4px solid #ded3c3', borderRadius: 1, px: 1.25, py: 1 }}
        >
          <Skeleton variant="text" width="60%" sx={{ fontSize: '0.75rem' }} />
          <Skeleton variant="text" width="45%" sx={{ fontSize: '1rem' }} />
        </Box>
      ))}
    </Box>
  )
}

/** Các dòng của một bảng (không kèm khung) — dùng bên trong thẻ đã có sẵn. */
export function TableRowsSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  const template = `minmax(0, 0.6fr) repeat(${Math.max(columns - 1, 1)}, minmax(0, 1fr))`
  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: template,
          gap: 2,
          px: 1.5,
          py: 1,
          bgcolor: '#f8f3eb',
          borderBottom: '1px solid #ded3c3',
        }}
      >
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} variant="text" width="70%" sx={{ fontSize: '0.8rem' }} />
        ))}
      </Box>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <Box
          key={rowIndex}
          sx={{
            display: 'grid',
            gridTemplateColumns: template,
            gap: 2,
            px: 1.5,
            py: 1.1,
            borderBottom: '1px solid #e9e0d4',
          }}
        >
          {Array.from({ length: columns }, (_, cellIndex) => (
            <Skeleton key={cellIndex} variant="text" width={cellIndex === 0 ? '50%' : LINE_WIDTHS[(rowIndex + cellIndex) % 6]} />
          ))}
        </Box>
      ))}
    </Box>
  )
}

/**
 * Bảng dữ liệu đang tải: thanh công cụ + tiêu đề cột + các dòng. Dưới `sm` chuyển thành
 * danh sách thẻ như DataTable ở chế độ thẻ.
 */
export function TableSkeleton({
  rows = 8,
  columns = 7,
  toolbar = true,
  sx,
}: {
  rows?: number
  columns?: number
  toolbar?: boolean
  sx?: SxProps<Theme>
}) {
  return (
    <Paper sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, ...sx }}>
      {toolbar ? (
        <Stack direction="row" spacing={1} sx={{ px: 1.5, py: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <Skeleton variant="rounded" height={32} sx={{ width: { xs: '60%', sm: 240 } }} />
          <Skeleton variant="rounded" width={96} height={32} />
        </Stack>
      ) : null}
      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
        <TableRowsSkeleton rows={rows} columns={columns} />
      </Box>
      <Stack spacing={1} sx={{ display: { xs: 'flex', sm: 'none' }, p: 1 }}>
        {Array.from({ length: Math.min(rows, 4) }, (_, index) => (
          <Box key={index} sx={{ border: '1px solid #e9e0d4', borderRadius: 1, p: 1.25 }}>
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="65%" />
          </Box>
        ))}
      </Stack>
    </Paper>
  )
}

/** Lưới thẻ (phiếu của thợ, nhóm danh mục…). */
export function CardGridSkeleton({
  count = 3,
  height = 140,
  columns = { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
  media = false,
}: {
  count?: number
  height?: number
  columns?: Record<string, string> | string
  /** Ô ảnh vuông bên trái như thẻ phiếu. */
  media?: boolean
}) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: columns }}>
      {Array.from({ length: count }, (_, index) => (
        <Paper key={index} sx={{ p: 1.5, minHeight: height, display: 'flex', gap: 1.5, minWidth: 0 }}>
          {media ? <Skeleton variant="rounded" width={72} height={72} sx={{ flexShrink: 0 }} /> : null}
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Skeleton variant="text" width={96} sx={{ fontSize: '1rem' }} />
              <Skeleton variant="rounded" width={64} height={22} />
            </Stack>
            <LinesSkeleton lines={2} />
            <Skeleton variant="rounded" width={112} height={30} sx={{ mt: 'auto !important' }} />
          </Stack>
        </Paper>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Khung cả trang — ghép từ các khối trên theo đúng bố cục từng màn.
// ---------------------------------------------------------------------------

/** Màn danh sách: tiêu đề + (tab) + bảng. */
export function ListPageSkeleton({ tabs = 0, subTabs = 0 }: { tabs?: number; subTabs?: number }) {
  return (
    <Stack spacing={1.25} sx={{ flex: { md: 1 }, minHeight: { md: 0 } }}>
      <PageHeaderSkeleton actions={1} />
      {tabs ? <TabsSkeleton count={tabs} /> : null}
      {subTabs ? <TabsSkeleton count={subTabs} /> : null}
      <TableSkeleton sx={{ flex: { md: 1 } }} />
    </Stack>
  )
}

/** Chi tiết đơn sản xuất: tiêu đề + chip, tab trong thẻ, cột chính và cột phụ (QR, trạng thái, Đúc). */
export function OrderDetailSkeleton() {
  return (
    <Stack spacing={1.5} sx={{ pb: 3 }}>
      <PageHeaderSkeleton breadcrumbs chips={3} actions={2} />
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <TabsSkeleton count={4} paper />
          <SectionSkeleton>
            <Stack spacing={1.75}>
              <Skeleton variant="rounded" height={56} />
              <FieldGridSkeleton count={8} />
              <FieldGridSkeleton count={8} />
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                {[0, 1].map((key) => (
                  <Box key={key}>
                    <Skeleton variant="text" width={140} />
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Skeleton variant="rounded" width={96} height={96} />
                      <Skeleton variant="rounded" width={96} height={96} />
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Stack>
          </SectionSkeleton>
        </Stack>
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <SectionSkeleton>
            <Stack spacing={1} sx={{ alignItems: 'center' }}>
              <Skeleton variant="rounded" width={164} height={164} />
              <Skeleton variant="text" width={80} sx={{ fontSize: '1.25rem' }} />
              <Skeleton variant="text" width={180} />
            </Stack>
          </SectionSkeleton>
          <SectionSkeleton lines={5} />
          <SectionSkeleton action>
            <FieldGridSkeleton count={2} columns="1fr 1fr" />
          </SectionSkeleton>
        </Stack>
      </Box>
    </Stack>
  )
}

/** Trang phiếu con / thông tin tham khảo của thợ: các thẻ xếp dọc. */
export function TicketDetailSkeleton({ maxWidth }: { maxWidth?: number }) {
  return (
    <Stack spacing={1.5} sx={{ pb: 3, maxWidth }}>
      <PageHeaderSkeleton breadcrumbs chips={2} />
      <SectionSkeleton lines={2}>
        <Stack spacing={1.25}>
          <LinesSkeleton lines={2} />
          <Skeleton variant="rounded" height={42} sx={{ width: { xs: '100%', sm: 260 } }} />
        </Stack>
      </SectionSkeleton>
      <SectionSkeleton>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Skeleton variant="rounded" width={96} height={96} />
            <Skeleton variant="rounded" width={96} height={96} />
          </Stack>
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <LinesSkeleton lines={2} />
            <FieldGridSkeleton count={8} columns="repeat(2, minmax(0, 1fr))" />
          </Stack>
        </Stack>
      </SectionSkeleton>
      <SectionSkeleton>
        <TableRowsSkeleton rows={3} columns={6} />
      </SectionSkeleton>
    </Stack>
  )
}

/** Chi tiết phiếu xuất hàng: tiêu đề, thẻ thông tin chung, bảng dòng hàng. */
export function ShipmentDetailSkeleton() {
  return (
    <Stack spacing={1.5} sx={{ pb: 3 }}>
      <PageHeaderSkeleton breadcrumbs actions={3} />
      <SectionSkeleton title={false}>
        <FieldGridSkeleton count={4} columns={{ xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }} />
      </SectionSkeleton>
      <SectionSkeleton title={false}>
        <TableRowsSkeleton rows={4} columns={8} />
        <Skeleton variant="text" width={320} sx={{ mt: 1.25 }} />
      </SectionSkeleton>
    </Stack>
  )
}

/** Màn dạng thẻ: tiêu đề + các nhóm thẻ (Phiếu của tôi) hoặc một lưới thẻ (Danh mục). */
export function CardsPageSkeleton({
  groups = 1,
  count = 3,
  media = false,
}: {
  groups?: number
  count?: number
  media?: boolean
}) {
  return (
    <Stack spacing={2} sx={{ pb: 3 }}>
      <PageHeaderSkeleton actions={2} />
      {Array.from({ length: groups }, (_, index) => (
        <CardGroupSkeleton key={index} count={count} media={media} />
      ))}
    </Stack>
  )
}

/** Một nhóm thẻ có tiêu đề nhóm. */
export function CardGroupSkeleton({ count = 2, media = false }: { count?: number; media?: boolean }) {
  return (
    <Box>
      <Skeleton variant="text" width={140} sx={{ fontSize: '1rem', mb: 1 }} />
      <CardGridSkeleton
        count={count}
        media={media}
        height={media ? 120 : 140}
        columns={{ xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }}
      />
    </Box>
  )
}

/** Trang tổng quan: tiêu đề + thẻ nhãn / giá trị. */
export function DashboardSkeleton() {
  return (
    <Stack spacing={2}>
      <PageHeaderSkeleton />
      <Paper sx={{ px: { xs: 1.5, sm: 2 }, py: 0.5 }}>
        {Array.from({ length: 5 }, (_, index) => (
          <Stack
            key={index}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 0.25, sm: 2 }}
            sx={{ py: 1.25, borderBottom: index < 4 ? '1px solid #ded3c3' : undefined }}
          >
            <Skeleton variant="text" sx={{ width: { xs: 100, sm: 180 }, flexShrink: 0 }} />
            <Skeleton variant="text" sx={{ width: { xs: '70%', sm: 260 } }} />
          </Stack>
        ))}
      </Paper>
    </Stack>
  )
}

/** Trang in (phiếu thợ, phiếu xuất): nền xám, thanh nút, tờ giấy. */
export function PrintSheetSkeleton() {
  return (
    <Box sx={{ height: '100dvh', overflow: 'hidden', bgcolor: '#e5e8eb', px: 2 }}>
      <Stack direction="row" spacing={1} sx={{ py: 1.5, justifyContent: 'center' }}>
        <Skeleton variant="rounded" width={104} height={32} />
        <Skeleton variant="rounded" width={180} height={32} />
        <Skeleton variant="rounded" width={64} height={32} />
      </Stack>
      <Paper sx={{ width: '210mm', maxWidth: '100%', mx: 'auto', p: '6mm' }}>
        <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
          <Skeleton variant="rounded" width={88} height={88} />
          <Stack spacing={0.5} sx={{ flex: 1 }}>
            <Skeleton variant="text" width="45%" sx={{ fontSize: '1.25rem' }} />
            <Skeleton variant="text" width="70%" />
          </Stack>
        </Stack>
        <FieldGridSkeleton count={8} columns="repeat(4, minmax(0, 1fr))" />
        <Box sx={{ mt: 2 }}>
          <TableRowsSkeleton rows={5} columns={6} />
        </Box>
      </Paper>
    </Box>
  )
}

/** Màn đăng nhập lúc đang kiểm tra phiên cũ. */
export function LoginSkeleton() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
      <Container maxWidth="xs">
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
              <Skeleton variant="rounded" width={180} height={64} />
              <Skeleton variant="text" width={150} />
            </Stack>
            <Skeleton variant="text" width={90} sx={{ fontSize: '1rem' }} />
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={32} />
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
