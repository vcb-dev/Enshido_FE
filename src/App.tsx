import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { UsersPage } from './pages/UsersPage'
import { WarehousesPage } from './pages/WarehousesPage'
import { WarehouseDetailPage } from './pages/WarehouseDetailPage'
import { LocationsPage } from './pages/LocationsPage'
import { ProductionOrdersPage } from './pages/ProductionOrdersPage'
import { ProductionOrderDetailPage } from './pages/ProductionOrderDetailPage'
import { ProductionTicketPrintPage } from './pages/ProductionTicketPrintPage'
import { LegacyRedirect } from './components/LegacyRedirect'
import { FinishedGoodsPage } from './pages/FinishedGoodsPage'
import { ShipmentDetailPage } from './pages/ShipmentDetailPage'
import { ShipmentPrintPage } from './pages/ShipmentPrintPage'

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
          <Route path="/finished-goods" element={<FinishedGoodsPage />} />
          <Route path="/finished-goods/shipments/:code" element={<ShipmentDetailPage />} />
          <Route path="/settings" element={<Navigate to="/settings/locations" replace />} />
          <Route path="/settings/locations" element={<LocationsPage />} />
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
