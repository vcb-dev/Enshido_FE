import type { ReactNode } from 'react'
import { Box, Chip, Paper, Stack, Typography, type SxProps, type Theme } from '@mui/material'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import { cloudinaryThumb } from '../api/uploads'
import type { StageCode } from '../api/productionOrders'
import { STAGE_LABEL, STAGES } from '../orders/catalog'

/** Khung thẻ dùng chung trên các màn của thợ: viền mảnh, bo 8px, không đổ bóng. */
export function SectionCard({
  title,
  action,
  children,
  sx,
  dense,
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  sx?: SxProps<Theme>
  dense?: boolean
}) {
  return (
    <Paper
      variant="outlined"
      sx={[{ borderRadius: 2, p: dense ? 1.5 : { xs: 1.75, md: 2.25 }, minWidth: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {title || action ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5, minWidth: 0 }}>
          {title ? (
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }}>
              {title}
            </Typography>
          ) : null}
          {action}
        </Stack>
      ) : null}
      {children}
    </Paper>
  )
}

/** Ảnh sản phẩm thu nhỏ; chưa có ảnh thì hiện biểu tượng thay cho ô trống. */
export function TicketThumb({ url, size = 64 }: { url: string | null | undefined; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        display: 'grid',
        placeItems: 'center',
        color: 'text.disabled',
      }}
    >
      {url ? (
        <Box
          component="img"
          src={cloudinaryThumb(url, size * 2)}
          alt=""
          loading="lazy"
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Inventory2OutlinedIcon sx={{ fontSize: size * 0.42 }} />
      )}
    </Box>
  )
}

/** Một cặp biểu tượng + giá trị trên dòng thông số (SL, gram, hạn trả). */
export function MetaItem({ icon, children, tone }: { icon: ReactNode; children: ReactNode; tone?: 'error' | 'warning' }) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        alignItems: 'center',
        color: tone ? `${tone}.main` : 'text.secondary',
        fontWeight: tone ? 600 : 400,
        '& svg': { fontSize: 16 },
        minWidth: 0,
      }}
    >
      {icon}
      <Typography variant="body2" component="span" sx={{ color: 'inherit', fontWeight: 'inherit' }} noWrap>
        {children}
      </Typography>
    </Stack>
  )
}

/** Hạn trả tính theo ngày lịch ở giờ máy: trễ → đỏ, hôm nay / mai → vàng. */
export function dueInfo(dueDate: string | null | undefined): { label: string; tone?: 'error' | 'warning' } | null {
  if (!dueDate) return null
  const [y, m, d] = dueDate.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const due = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (days < 0) return { label: `Trễ ${-days} ngày`, tone: 'error' }
  if (days === 0) return { label: 'Hạn hôm nay', tone: 'warning' }
  if (days === 1) return { label: 'Hạn ngày mai', tone: 'warning' }
  return { label: `Hạn ${pad(d)}/${pad(m)}` }
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <Stack
      spacing={1}
      sx={{
        alignItems: 'center',
        textAlign: 'center',
        py: { xs: 5, md: 7 },
        px: 2,
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        color: 'text.secondary',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ color: 'primary.light', '& svg': { fontSize: 40 } }}>{icon}</Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      ) : null}
    </Stack>
  )
}

/**
 * Tiến độ các khâu của phiếu: khâu đã QC nhận lại, khâu đang làm / đang mở, khâu còn lại.
 * Trên điện thoại cuộn ngang được thay vì co chữ.
 */
export function StageProgress({ done, current }: { done: StageCode[]; current: StageCode | null }) {
  return (
    <Box sx={{ overflowX: 'auto', mx: -0.5, px: 0.5, pb: 0.5 }}>
      <Stack direction="row" sx={{ alignItems: 'flex-start', minWidth: 360 }}>
        {STAGES.map((stage, index) => {
          const state = stage === current ? 'current' : done.includes(stage) ? 'done' : 'todo'
          const color = state === 'current' ? 'primary.main' : state === 'done' ? 'success.main' : 'divider'
          return (
            <Stack key={stage} sx={{ flex: 1, alignItems: 'center', position: 'relative', minWidth: 64 }}>
              {index > 0 ? (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 11,
                    right: '50%',
                    width: '100%',
                    height: 2,
                    zIndex: 0,
                    bgcolor: done.includes(stage) || state === 'current' ? 'success.light' : 'divider',
                  }}
                />
              ) : null}
              <Box
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  bgcolor: state === 'todo' ? 'background.paper' : color,
                  color: state === 'todo' ? 'text.secondary' : '#fff',
                  border: '2px solid',
                  borderColor: color,
                  boxShadow: state === 'current' ? '0 0 0 4px rgba(107,69,19,.15)' : 'none',
                }}
              >
                {state === 'done' ? '✓' : index + 1}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  mt: 0.5,
                  fontWeight: state === 'current' ? 700 : 500,
                  color: state === 'todo' ? 'text.secondary' : 'text.primary',
                  whiteSpace: 'nowrap',
                }}
              >
                {STAGE_LABEL[stage]}
              </Typography>
            </Stack>
          )
        })}
      </Stack>
    </Box>
  )
}

/** Lưới nhãn / giá trị gọn (2 cột trên điện thoại, 3–4 cột trên máy tính). */
export function FactGrid({
  items,
  columns = { xs: 2, sm: 3 },
}: {
  items: Array<{ label: string; value: ReactNode; tone?: 'error' | 'warning' }>
  columns?: { xs: number; sm?: number; md?: number }
}) {
  const shown = items.filter((item) => item.value != null && item.value !== '')
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: {
          xs: `repeat(${columns.xs}, minmax(0, 1fr))`,
          ...(columns.sm ? { sm: `repeat(${columns.sm}, minmax(0, 1fr))` } : {}),
          ...(columns.md ? { md: `repeat(${columns.md}, minmax(0, 1fr))` } : {}),
        },
      }}
    >
      {shown.map((item) => (
        <Box key={item.label} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {item.label}
          </Typography>
          <Typography
            variant="body2"
            component="div"
            sx={{
              fontWeight: 600,
              overflowWrap: 'anywhere',
              color: item.tone ? `${item.tone}.main` : 'text.primary',
            }}
          >
            {item.value}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

/**
 * Thanh nút chính dính đáy vùng cuộn — chỉ trên điện thoại, để thợ khỏi phải cuộn tìm nút.
 * Đặt làm con trực tiếp của khung trang (không lồng trong thẻ) thì mới dính suốt trang.
 * Trên máy tính nút nằm ngay trong thẻ khâu hiện tại.
 */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'sticky',
        bottom: 0,
        zIndex: 2,
        mx: -2,
        px: 2,
        py: 1.25,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 -6px 16px rgba(62,42,14,.06)',
      }}
    >
      <Stack spacing={1}>{children}</Stack>
    </Box>
  )
}

export function TabLabel({ text, count, active }: { text: string; count: number; active: boolean }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <span>{text}</span>
      <Box
        component="span"
        sx={{
          minWidth: 20,
          px: 0.75,
          borderRadius: 99,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: '20px',
          textAlign: 'center',
          bgcolor: active ? 'primary.main' : 'action.selected',
          color: active ? 'primary.contrastText' : 'text.secondary',
        }}
      >
        {count}
      </Box>
    </Stack>
  )
}

/** Bộ lọc dạng pill: nhãn + số đếm mờ, chọn thì tô màu chính. */
export function FilterPill({
  label,
  count,
  selected,
  onClick,
}: {
  label: string
  count: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <Chip
      size="small"
      clickable
      onClick={onClick}
      color={selected ? 'primary' : 'default'}
      variant={selected ? 'filled' : 'outlined'}
      label={
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <span>{label}</span>
          <Box component="span" sx={{ opacity: selected ? 0.8 : 0.6, fontWeight: 500 }}>
            {count}
          </Box>
        </Stack>
      }
      sx={{
        height: 30,
        borderRadius: 99,
        fontWeight: 600,
        px: 0.5,
        bgcolor: selected ? undefined : 'background.paper',
      }}
    />
  )
}
