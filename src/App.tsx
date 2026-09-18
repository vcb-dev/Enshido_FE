import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { ProductionOrdersPage } from './pages/ProductionOrdersPage'
import { ProductionOrderDetailPage } from './pages/ProductionOrderDetailPage'
import { OrderReferencePage } from './pages/OrderReferencePage'
import { useAuth } from './auth/AuthContext'
import { isWorkerOnly } from './auth/permissions'
import { ProductionTicketPrintPage } from './pages/ProductionTicketPrintPage'
import { MyTicketsPage } from './pages/MyTicketsPage'
import { SubTicketPage } from './pages/SubTicketPage'
import { LegacyRedirect } from './components/LegacyRedirect'
import { FinishedGoodsPage } from './pages/FinishedGoodsPage'
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
        <Route path="/orders/:code/tickets/:no/print" element={<ProductionTicketPrintPage />} />
        <Route path="/finished-goods/shipments/:code/print" element={<ShipmentPrintPage />} />
        <Route element={<AppShell />}>
          <Route path="/orders" element={<ProductionOrdersPage />} />
          {/* Thợ quét QR phiếu giấy đã in vào đây: bản chỉ-đọc, không phải màn quản lý đơn. */}
          <Route path="/orders/:code" element={<OrderDetailRoute />} />
          <Route path="/my-tickets" element={<MyTicketsPage />} />
          <Route path="/tickets/:ticketCode" element={<SubTicketPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/warehouses" element={<WarehousesPage />} />
          <Route path="/finished-goods" element={<FinishedGoodsPage />} />
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

/** Thợ chỉ được xem thông tin tham khảo; người quản lý mở màn đơn đầy đủ. */
function OrderDetailRoute() {
  const { user } = useAuth()
  return isWorkerOnly(user) ? <OrderReferencePage /> : <ProductionOrderDetailPage />
}
