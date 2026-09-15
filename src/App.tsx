import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'

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
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/kho" element={<WarehousesPage />} />
          <Route path="/cau-hinh-gia" element={<Navigate to="/kho" replace />} />
          <Route path="/cau-hinh" element={<Navigate to="/cau-hinh/vi-tri" replace />} />
          <Route path="/cau-hinh/vi-tri" element={<LocationsPage />} />
          <Route path="/cau-hinh/danh-muc" element={<CatalogsPage />} />
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
