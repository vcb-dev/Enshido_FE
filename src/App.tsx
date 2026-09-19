import { lazy } from 'react'
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { ProductionOrdersPage } from './pages/ProductionOrdersPage'
import { ProductionOrderDetailPage } from './pages/ProductionOrderDetailPage'
import { ProductionTicketPrintPage } from './pages/ProductionTicketPrintPage'
import { LegacyRedirect } from './components/LegacyRedirect'
import { ShipmentDetailPage } from './pages/ShipmentDetailPage'
import { ShipmentPrintPage } from './pages/ShipmentPrintPage'

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })))
const WarehousesPage = lazy(() =>
  import('./pages/WarehousesPage').then((m) => ({ default: m.WarehousesPage })),
)
const WarehouseDetailPage = lazy(() =>
  import('./pages/WarehouseDetailPage').then((m) => ({ default: m.WarehouseDetailPage })),
)
const LocationsPage = lazy(() =>
  import('./pages/LocationsPage').then((m) => ({ default: m.LocationsPage })),
)
const CatalogsPage = lazy(() =>
  import('./pages/CatalogsPage').then((m) => ({ default: m.CatalogsPage })),
)

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Đường dẫn tiếng Việt cũ — QR đã in và bookmark cũ vẫn mở được. */}
      <Route path="/don-hang/*" element={<LegacyRedirect />} />
      <Route path="/kho/*" element={<LegacyRedirect />} />
      <Route path="/cau-hinh/*" element={<LegacyRedirect />} />
      <Route path="/cau-hinh-gia" element={<LegacyRedirect />} />
      <Route element={<ProtectedRoute />}>
        {/* Phiếu in không nằm trong khung app để trang in chỉ còn nội dung phiếu. */}
        <Route path="/orders/:code/print" element={<ProductionTicketPrintPage />} />
        <Route path="/finished-goods/shipments/:code/print" element={<ShipmentPrintPage />} />
        <Route element={<AppShell />}>
          <Route path="/orders" element={<ProductionOrdersPage />} />
          <Route path="/orders/:code" element={<ProductionOrderDetailPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/warehouses" element={<WarehousesPage />} />
          <Route path="/finished-goods" element={<FinishedGoodsRedirect />} />
          <Route path="/finished-goods/shipments/:code" element={<ShipmentDetailPage />} />
          <Route path="/settings" element={<Navigate to="/settings/locations" replace />} />
          <Route path="/settings/locations" element={<LocationsPage />} />
          <Route path="/settings/catalogs" element={<CatalogsPage />} />
          <Route path="/warehouses/:code" element={<WarehouseDetailPage />} />
          <Route path="/warehouses/:code/:bin" element={<WarehouseDetailPage />} />
          <Route path="/warehouses/:code/:bin/:section" element={<WarehouseDetailPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function FinishedGoodsRedirect() {
  const [params] = useSearchParams()
  const create = params.get('create')
  const tab = params.get('tab')
  if (create || tab === 'shipments') {
    const query = new URLSearchParams()
    if (create) query.set('create', create)
    const suffix = query.toString()
    return <Navigate to={`/warehouses/thanh-pham/outbound${suffix ? `?${suffix}` : ''}`} replace />
  }
  if (tab === 'inbound') return <Navigate to="/warehouses/thanh-pham/inbound" replace />
  return <Navigate to="/warehouses/thanh-pham/stock" replace />
}
