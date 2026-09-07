import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { UsersPage } from './pages/UsersPage'
import { WarehousesPage } from './pages/WarehousesPage'
import { WarehouseDetailPage } from './pages/WarehouseDetailPage'
import { LocationsPage } from './pages/LocationsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/kho" element={<WarehousesPage />} />
          <Route path="/cau-hinh-gia" element={<Navigate to="/kho" replace />} />
          <Route path="/cau-hinh" element={<Navigate to="/cau-hinh/vi-tri" replace />} />
          <Route path="/cau-hinh/vi-tri" element={<LocationsPage />} />
          <Route path="/kho/:code" element={<WarehouseDetailPage />} />
          <Route path="/kho/:code/:bin" element={<WarehouseDetailPage />} />
          <Route path="/kho/:code/:bin/:section" element={<WarehouseDetailPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
