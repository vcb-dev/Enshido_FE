import { useState } from 'react'
import { Box } from '@mui/material'
import type { StageImage } from '../api/productionOrders'
import { ImageLightbox, ZoomThumb } from '../components/ImageLightbox'

/** Ảnh làm chứng QC chụp lúc nhận lại khâu — thu nhỏ, bấm để xem lớn. */
export function KcsImages({
  images,
  size = 48,
  title = 'Ảnh QC',
}: {
  images?: StageImage[]
  size?: number
  /** Tên bộ ảnh — ảnh QC làm chứng, hoặc ảnh gói đá thủ kho chụp lúc cấp. */
  title?: string
}) {
  const [viewing, setViewing] = useState<number | null>(null)
  if (!images?.length) return null
  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
        {images.map((image, index) => (
          <ZoomThumb
            key={image.publicId}
            url={image.url}
            size={size}
            label={`${title} ${index + 1}/${images.length}`}
            onClick={() => setViewing(index)}
          />
        ))}
      </Box>
      <ImageLightbox
        images={images.map((image) => ({ id: image.publicId, url: image.url }))}
        index={viewing}
        title={title}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
    </>
  )
}
