import { useCallback, useState } from 'react'
import type { OrderImage, StageImage } from '../api/productionOrders'

/** Nhãn và lời nhắc của ô ảnh gói đá — dùng chung ở mọi hộp thoại cấp đá. */
export const STONE_PHOTO_LABEL = 'Ảnh gói đá trên cân'
export const STONE_PHOTO_REQUIRED = 'Chụp ít nhất một ảnh gói đá trên cân'

/** Ảnh gói đá gửi API: chỉ các trường BE lưu. */
export function stonePhotosPayload(images: readonly OrderImage[] | undefined): StageImage[] {
  return (images ?? []).map((image) => ({
    url: image.url,
    publicId: image.publicId,
    width: image.width ?? null,
    height: image.height ?? null,
  }))
}

/**
 * Nhiều ô ảnh trong một hộp thoại (mỗi dòng đá một ô): gom trạng thái đang tải của từng ô theo
 * khoá để khoá nút lưu. `keys` là các dòng còn trên form — dòng đã bỏ không giữ nút bị khoá.
 */
export function useUploadingByKey() {
  const [state, setState] = useState<Record<string, boolean>>({})
  const set = useCallback((key: string, uploading: boolean) => {
    setState((current) => (current[key] === uploading ? current : { ...current, [key]: uploading }))
  }, [])
  const any = useCallback((keys: readonly string[]) => keys.some((key) => state[key]), [state])
  return { set, any }
}
