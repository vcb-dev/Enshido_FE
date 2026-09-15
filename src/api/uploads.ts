import { apiFetch } from './auth'
import type { OrderImage, ProductionImageKind } from './productionOrders'

type CloudinarySignature = {
  cloudName: string
  apiKey: string
  timestamp: number
  folder: string
  signature: string
}

type CloudinaryUploadResponse = {
  secure_url: string
  public_id: string
  width?: number
  height?: number
  error?: { message?: string }
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/**
 * Upload ảnh thẳng lên Cloudinary bằng chữ ký do backend cấp — file không đi
 * qua server của mình. Dùng XHR thay vì fetch để có tiến độ upload.
 */
export async function uploadImageToCloudinary(
  file: File,
  kind: ProductionImageKind,
  onProgress?: (percent: number) => void,
): Promise<OrderImage> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} không phải file ảnh`)
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} lớn hơn 10MB`)

  const sig = await apiFetch<CloudinarySignature>('/uploads/cloudinary-signature', {
    method: 'POST',
    body: '{}',
  })

  const form = new FormData()
  form.append('file', file)
  form.append('api_key', sig.apiKey)
  form.append('timestamp', String(sig.timestamp))
  form.append('folder', sig.folder)
  form.append('signature', sig.signature)

  const body = await new Promise<CloudinaryUploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText) as CloudinaryUploadResponse
        if (xhr.status >= 200 && xhr.status < 300) resolve(parsed)
        else reject(new Error(parsed.error?.message ?? `Upload ảnh lỗi HTTP ${xhr.status}`))
      } catch {
        reject(new Error(`Upload ảnh lỗi HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Mất kết nối khi upload ảnh'))
    xhr.send(form)
  })

  return {
    kind,
    url: body.secure_url,
    publicId: body.public_id,
    width: body.width ?? null,
    height: body.height ?? null,
  }
}

/** Ảnh thu nhỏ qua transform của Cloudinary, tránh tải ảnh gốc cho bảng / phiếu. */
export function cloudinaryThumb(url: string, width: number, height = width) {
  const marker = '/image/upload/'
  const index = url.indexOf(marker)
  if (index < 0) return url
  const at = index + marker.length
  return `${url.slice(0, at)}c_fill,w_${width},h_${height},q_auto,f_auto/${url.slice(at)}`
}

/** Ảnh vừa khung, giữ tỉ lệ — dùng cho phiếu in và xem ảnh lớn. */
export function cloudinaryFit(url: string, width: number) {
  const marker = '/image/upload/'
  const index = url.indexOf(marker)
  if (index < 0) return url
  const at = index + marker.length
  return `${url.slice(0, at)}c_limit,w_${width},q_auto,f_auto/${url.slice(at)}`
}
