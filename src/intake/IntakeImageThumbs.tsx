import { useState } from 'react'
import { Stack, Typography } from '@mui/material'
import type { OrderImage } from '../api/productionOrders'
import { ImageLightbox, ZoomThumb } from '../components/ImageLightbox'

const TABLE_THUMB = 44

export function IntakeImageThumbs({ label, images }: { label: string; images: OrderImage[] }) {
  const [viewing, setViewing] = useState<number | null>(null)
  if (!images.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    )
  }
  const shown = images.slice(0, 2)
  return (
    <>
      {/* Luôn một hàng: ô bảng hẹp mà wrap thì ảnh thứ hai rơi xuống, dòng bảng cao gấp đôi. */}
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'nowrap', py: 0.25 }}>
        {shown.map((image, index) => (
          <ZoomThumb
            key={image.publicId}
            url={image.url}
            size={TABLE_THUMB}
            label={`Xem ${label} ${index + 1}/${images.length}`}
            more={index === shown.length - 1 && images.length > shown.length ? images.length - shown.length : 0}
            onClick={() => setViewing(index)}
          />
        ))}
      </Stack>
      {/* Chỉ dựng khi mở: ô này nằm trên từng dòng bảng, mỗi instance là một useMediaQuery. */}
      {viewing != null ? (
        <ImageLightbox
          images={images.map((image) => ({ id: image.publicId, url: image.url }))}
          index={viewing}
          title={label}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </>
  )
}
