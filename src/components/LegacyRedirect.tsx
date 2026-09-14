import { Navigate, useLocation } from 'react-router-dom'
import { LEGACY_SECTION_CODES } from '../warehouses/catalog'

/**
 * Đổi đường dẫn tiếng Việt cũ (/don-hang, /kho, /cau-hinh) sang đường dẫn hiện tại.
 * Giữ để mã QR đã in trên phiếu và bookmark cũ vẫn mở đúng trang.
 */
export function legacyPathToCurrent(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  const [root, ...rest] = parts

  if (root === 'don-hang') {
    const [code, action] = rest
    if (!code) return '/orders'
    return action === 'in-phieu' ? `/orders/${code}/print` : `/orders/${code}`
  }
  if (root === 'kho') {
    const [code, ...segments] = rest
    if (!code) return '/warehouses'
    const mapped = segments.map((segment) => LEGACY_SECTION_CODES[segment] ?? segment)
    return ['/warehouses', code, ...mapped].join('/')
  }
  if (root === 'cau-hinh') return '/settings/locations'
  if (root === 'cau-hinh-gia') return '/warehouses'
  return '/'
}

export function LegacyRedirect() {
  const location = useLocation()
  return <Navigate to={`${legacyPathToCurrent(location.pathname)}${location.search}`} replace />
}
