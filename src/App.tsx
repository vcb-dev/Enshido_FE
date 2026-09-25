import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { useAuth } from './auth/AuthContext'
import { isWorkerOnly } from './auth/permissions'
import { LegacyRedirect } from './components/LegacyRedirect'
import { PrintSheetSkeleton } from './components/ui'

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
const ProductionOrdersPage = lazy(() =>
  import('./pages/ProductionOrdersPage').then((m) => ({ default: m.ProductionOrdersPage })),
)
const ProductionOrderDetailPage = lazy(() =>
  import('./pages/ProductionOrderDetailPage').then((m) => ({ default: m.ProductionOrderDetailPage })),
)
const OrderReferencePage = lazy(() =>
  import('./pages/OrderReferencePage').then((m) => ({ default: m.OrderReferencePage })),
)
const ProductionTicketPrintPage = lazy(() =>
  import('./pages/ProductionTicketPrintPage').then((m) => ({ default: m.ProductionTicketPrintPage })),
)
const MyTicketsPage = lazy(() =>
  import('./pages/MyTicketsPage').then((m) => ({ default: m.MyTicketsPage })),
)
const MaterialRequestsPage = lazy(() =>
  import('./pages/MaterialRequestsPage').then((m) => ({ default: m.MaterialRequestsPage })),
)
const SubTicketPage = lazy(() =>
  import('./pages/SubTicketPage').then((m) => ({ default: m.SubTicketPage })),
)
const ShipmentDetailPage = lazy(() =>
  import('./pages/ShipmentDetailPage').then((m) => ({ default: m.ShipmentDetailPage })),
)
const ShipmentPrintPage = lazy(() =>
  import('./pages/ShipmentPrintPage').then((m) => ({ default: m.ShipmentPrintPage })),
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
        <Route
          path="/orders/:code/print"
          element={
            <Suspense fallback={<PrintSheetSkeleton />}>
              <ProductionTicketPrintPage />
            </Suspense>
          }
        />
        <Route
          path="/orders/:code/tickets/:no/print"
          element={
            <Suspense fallback={<PrintSheetSkeleton />}>
              <ProductionTicketPrintPage />
            </Suspense>
          }
        />
        <Route
          path="/finished-goods/shipments/:code/print"
          element={
            <Suspense fallback={<PrintSheetSkeleton />}>
              <ShipmentPrintPage />
            </Suspense>
          }
        />
        <Route element={<AppShell />}>
          <Route path="/orders" element={<ProductionOrdersPage />} />
          {/* Thợ quét QR phiếu giấy đã in vào đây: bản chỉ-đọc, không phải màn quản lý đơn. */}
          <Route path="/orders/:code" element={<OrderDetailRoute />} />
          <Route path="/my-tickets" element={<MyTicketsPage />} />
          <Route path="/material-requests" element={<MaterialRequestsPage />} />
          <Route path="/tickets/:ticketCode" element={<SubTicketPage />} />
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

/** Thợ chỉ được xem thông tin tham khảo; người quản lý mở màn đơn đầy đủ. */
function OrderDetailRoute() {
  const { user } = useAuth()
  return isWorkerOnly(user) ? <OrderReferencePage /> : <ProductionOrderDetailPage />
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
