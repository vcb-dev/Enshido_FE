import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, ButtonBase, Dialog, IconButton, Skeleton, Stack, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import { cloudinaryFit, cloudinaryThumb } from '../api/uploads'
import { useIsMobile } from '../hooks/useBreakpoint'

export type LightboxImage = {
  id: string
  url: string
  /** Chú thích riêng của ảnh (vd mã đơn trên phiếu xuất); thay cho `title` ở góc trên. */
  caption?: string
}

/** Vuốt ngang quá ngưỡng này (px) thì chuyển ảnh. */
const SWIPE_PX = 50

/**
 * Xem ảnh lớn ngay trên trang — không mở tab mới. Chuyển ảnh bằng nút, phím ← → hoặc vuốt
 * trên điện thoại; Esc / bấm nền / nút × để đóng. `index` null là đóng.
 */
export function ImageLightbox({
  images,
  index,
  title,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[]
  index: number | null
  /** Tên nhóm ảnh hiện ở góc trên, vd "Ảnh sản phẩm". */
  title?: string
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const fullScreen = useIsMobile()
  const open = index != null && images.length > 0
  const current = open ? Math.min(index, images.length - 1) : 0
  const image = open ? images[current] : undefined
  const many = images.length > 1
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const touchX = useRef<number | null>(null)
  const strip = useRef<HTMLDivElement>(null)

  const go = (step: number) => onIndexChange((current + step + images.length) % images.length)

  useEffect(() => {
    if (!open || !many) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onIndexChange((current - 1 + images.length) % images.length)
      if (event.key === 'ArrowRight') onIndexChange((current + 1) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, many, current, images.length, onIndexChange])

  // Dải ảnh nhỏ dài hơn màn hình thì cuộn tới ảnh đang xem.
  useEffect(() => {
    if (!open) return
    const thumb = strip.current?.querySelector<HTMLElement>('[aria-current="true"]')
    thumb?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [open, current])

  const src = image ? cloudinaryFit(image.url, 1600) : ''

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth={false}
      aria-label={title ?? 'Xem ảnh'}
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#111418',
            color: '#fff',
            border: 'none',
            ...(fullScreen ? null : { width: 'min(1100px, calc(100vw - 64px))', height: 'calc(100dvh - 64px)' }),
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2, py: 1, flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {image?.caption ?? title}
          {many ? ` · ${current + 1}/${images.length}` : ''}
        </Typography>
        <IconButton aria-label="Đóng" onClick={onClose} sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </Stack>

      <Box
        sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', px: { xs: 0, sm: 7 } }}
        onTouchStart={(event) => {
          touchX.current = event.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(event) => {
          const start = touchX.current
          touchX.current = null
          const end = event.changedTouches[0]?.clientX
          if (!many || start == null || end == null || Math.abs(end - start) < SWIPE_PX) return
          go(end < start ? 1 : -1)
        }}
      >
        {image ? (
          <>
            {loadedUrl !== src ? (
              <Skeleton
                variant="rounded"
                sx={{
                  position: 'absolute',
                  top: 16,
                  bottom: 16,
                  left: { xs: 16, sm: 56 },
                  right: { xs: 16, sm: 56 },
                  height: 'auto',
                  bgcolor: 'rgba(255,255,255,0.08)',
                }}
              />
            ) : null}
            <Box
              key={src}
              component="img"
              src={src}
              alt=""
              onLoad={() => setLoadedUrl(src)}
              onError={() => setLoadedUrl(src)}
              sx={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                userSelect: 'none',
                opacity: loadedUrl === src ? 1 : 0,
                transition: 'opacity 150ms',
              }}
            />
          </>
        ) : null}
        {many ? (
          <>
            <NavButton side="left" label="Ảnh trước" onClick={() => go(-1)}>
              <ChevronLeftIcon fontSize="large" />
            </NavButton>
            <NavButton side="right" label="Ảnh sau" onClick={() => go(1)}>
              <ChevronRightIcon fontSize="large" />
            </NavButton>
          </>
        ) : null}
      </Box>

      {many ? (
        // Căn giữa bằng margin auto chứ không justify-content: dải dài hơn màn hình vẫn cuộn
        // được tới ảnh đầu, không bị cắt mất mép trái.
        <Box ref={strip} sx={{ overflowX: 'auto', flexShrink: 0, px: 2, py: 1.25 }}>
          <Stack direction="row" spacing={1} sx={{ width: 'max-content', mx: 'auto' }}>
            {images.map((item, itemIndex) => (
              <ButtonBase
                key={item.id}
                aria-label={`Ảnh ${itemIndex + 1}`}
                aria-current={itemIndex === current ? 'true' : undefined}
                onClick={() => onIndexChange(itemIndex)}
                sx={{
                  flexShrink: 0,
                  width: 56,
                  height: 56,
                  borderRadius: 1,
                  overflow: 'hidden',
                  outline: itemIndex === current ? '2px solid #fff' : '1px solid rgba(255,255,255,0.25)',
                  opacity: itemIndex === current ? 1 : 0.6,
                }}
              >
                <Box
                  component="img"
                  src={cloudinaryThumb(item.url, 112)}
                  alt=""
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </ButtonBase>
            ))}
          </Stack>
        </Box>
      ) : null}
    </Dialog>
  )
}

function NavButton({
  side,
  label,
  onClick,
  children,
}: {
  side: 'left' | 'right'
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <IconButton
      aria-label={label}
      onClick={onClick}
      sx={{
        position: 'absolute',
        top: '50%',
        [side]: 8,
        transform: 'translateY(-50%)',
        color: '#fff',
        bgcolor: 'rgba(0,0,0,0.35)',
        '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' },
      }}
    >
      {children}
    </IconButton>
  )
}

/**
 * Ảnh nhỏ bấm được để mở ImageLightbox. `more` > 0 thì phủ nhãn "+N" — còn ảnh không hiện
 * ở hàng này nhưng xem được khi lướt trong hộp xem ảnh.
 */
export function ZoomThumb({
  url,
  size = 96,
  label,
  more = 0,
  onClick,
  sx,
}: {
  url: string
  size?: number
  label: string
  more?: number
  onClick: () => void
  sx?: SxProps<Theme>
}) {
  return (
    <ButtonBase
      aria-label={label}
      onClick={onClick}
      sx={{
        position: 'relative',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid #d5dbe0',
        cursor: 'zoom-in',
        transition: 'border-color 120ms, box-shadow 120ms',
        '&:hover, &.Mui-focusVisible': { borderColor: 'primary.main', boxShadow: '0 2px 8px rgba(27,79,114,0.18)' },
        ...sx,
      }}
    >
      <Box
        component="img"
        src={cloudinaryThumb(url, size * 2)}
        alt=""
        loading="lazy"
        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {more > 0 ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'rgba(0,0,0,0.45)',
            color: '#fff',
            fontWeight: 700,
            fontSize: size >= 72 ? '1.1rem' : '0.8rem',
          }}
        >
          +{more}
        </Box>
      ) : null}
    </ButtonBase>
  )
}
