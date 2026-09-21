import { useEffect, useRef, useState } from 'react'
import {
  Box,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import { toast } from 'sonner'
import type { OrderImage, ProductionImageKind } from '../api/productionOrders'
import { cloudinaryThumb, uploadImageToCloudinary } from '../api/uploads'

type Pending = { key: string; name: string; progress: number }

const THUMB = 76

/**
 * Chọn nhiều ảnh, upload ngay lên Cloudinary và trả về danh sách ảnh đã lên.
 * Báo `onUploadingChange` để form khoá nút Lưu khi còn ảnh đang upload.
 */
export function ImageUploadField({
  label,
  kind,
  value,
  onChange,
  onUploadingChange,
  readOnly,
}: {
  label: string
  kind: ProductionImageKind
  value: OrderImage[]
  onChange: (images: OrderImage[]) => void
  onUploadingChange?: (uploading: boolean) => void
  readOnly?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending[]>([])
  // Upload chạy song song nên đọc giá trị mới nhất qua ref, tránh ghi đè lẫn nhau.
  const latest = useRef(value)
  latest.current = value

  useEffect(() => {
    onUploadingChange?.(pending.length > 0)
  }, [pending.length, onUploadingChange])

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const batch = Array.from(files).map((file, index) => ({
      file,
      key: `${Date.now()}-${index}-${file.name}`,
    }))
    setPending((prev) => [
      ...prev,
      ...batch.map(({ key, file }) => ({ key, name: file.name, progress: 0 })),
    ])

    await Promise.all(
      batch.map(async ({ file, key }) => {
        try {
          const image = await uploadImageToCloudinary(file, kind, (progress) =>
            setPending((prev) => prev.map((item) => (item.key === key ? { ...item, progress } : item))),
          )
          latest.current = [...latest.current, image]
          onChange(latest.current)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Upload ảnh thất bại')
        } finally {
          setPending((prev) => prev.filter((item) => item.key !== key))
        }
      }),
    )
  }

  function remove(publicId: string) {
    onChange(value.filter((image) => image.publicId !== publicId))
  }

  const empty = value.length === 0 && pending.length === 0
  const canAdd = !readOnly

  function openPicker() {
    inputRef.current?.click()
  }

  return (
    <Stack spacing={0.75}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {label}{' '}
        <Typography component="span" variant="caption" color="text.secondary">
          ({value.length})
        </Typography>
      </Typography>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          void handleFiles(event.target.files)
          event.target.value = ''
        }}
      />

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          alignItems: empty ? 'center' : 'flex-start',
          justifyContent: empty ? 'center' : 'flex-start',
          minHeight: empty ? 112 : THUMB,
          p: 1,
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1,
          ...(empty && canAdd
            ? {
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main', bgcolor: '#f7fafc' },
              }
            : {}),
        }}
        onClick={empty && canAdd ? openPicker : undefined}
        role={empty && canAdd ? 'button' : undefined}
        tabIndex={empty && canAdd ? 0 : undefined}
        aria-label={empty && canAdd ? `Thêm ${label}` : undefined}
        onKeyDown={
          empty && canAdd
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openPicker()
                }
              }
            : undefined
        }
      >
        {value.map((image) => (
          <Box key={image.publicId} sx={{ position: 'relative', width: THUMB, height: THUMB }}>
            <Box
              component="a"
              href={image.url}
              target="_blank"
              rel="noreferrer"
              sx={{ display: 'block', width: '100%', height: '100%' }}
            >
              <Box
                component="img"
                src={cloudinaryThumb(image.url, THUMB * 2)}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 1, border: '1px solid #d5dbe0' }}
              />
            </Box>
            {readOnly ? null : (
              <Tooltip title="Gỡ ảnh">
                <IconButton
                  size="small"
                  aria-label="Gỡ ảnh"
                  onClick={() => remove(image.publicId)}
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    p: 0.25,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'error.main', color: '#fff' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ))}

        {pending.map((item) => (
          <Stack
            key={item.key}
            spacing={0.5}
            sx={{
              width: THUMB,
              height: THUMB,
              justifyContent: 'center',
              px: 0.75,
              borderRadius: 1,
              bgcolor: '#f4f6f7',
            }}
          >
            <Typography variant="caption" noWrap color="text.secondary">
              {item.name}
            </Typography>
            <LinearProgress variant="determinate" value={item.progress} />
          </Stack>
        ))}

        {empty && canAdd ? (
          <AddIcon sx={{ fontSize: 36, color: 'text.secondary' }} />
        ) : null}

        {empty && !canAdd ? (
          <Typography variant="caption" color="text.secondary">
            Chưa có ảnh
          </Typography>
        ) : null}

        {!empty && canAdd ? (
          <Box
            component="button"
            type="button"
            aria-label={`Thêm ${label}`}
            onClick={openPicker}
            sx={{
              width: THUMB,
              height: THUMB,
              display: 'grid',
              placeItems: 'center',
              p: 0,
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'transparent',
              cursor: 'pointer',
              color: 'text.secondary',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: '#f7fafc' },
            }}
          >
            <AddIcon />
          </Box>
        ) : null}
      </Box>
    </Stack>
  )
}
