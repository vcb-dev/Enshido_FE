import { Suspense, useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import TableChartIcon from '@mui/icons-material/TableChart'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import PeopleIcon from '@mui/icons-material/People'
import TableRowsIcon from '@mui/icons-material/TableRows'
import SettingsIcon from '@mui/icons-material/Settings'
import PlaceIcon from '@mui/icons-material/Place'
import CategoryIcon from '@mui/icons-material/Category'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import PalletIcon from '@mui/icons-material/Pallet'
import SouthIcon from '@mui/icons-material/South'
import AssignmentIcon from '@mui/icons-material/Assignment'
import WhatshotIcon from '@mui/icons-material/Whatshot'
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'
import NorthIcon from '@mui/icons-material/North'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { useWaitingCount } from '../orders/subTicketActions'
import { ScanQrButton } from './ScanQrButton'
import logo from '../assets/logo.png'
import { InstallAppBanner } from './InstallAppBanner'
import { InstallAppButton } from './InstallAppButton'
import { RouteSkeleton } from './RouteSkeleton'
import { ScreenLoadingBar } from './ScreenLoadingBar'
import { prefetchStaff, prefetchWarehouseStock } from '../auth/prefetchWarehouse'
import { can, isWorkerOnly, Permission } from '../auth/permissions'
import { canSeeWarehouse, hasAnyWarehouse } from '../auth/screens'
import { WAREHOUSES, WAREHOUSE_SECTIONS, warehousePath, type WarehouseDef } from '../warehouses/catalog'

const DRAWER_WIDTH = 260

function initials(name?: string, username?: string) {
  const source = (name || username || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

export function AppShell() {
  const { user, logout, offline } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const waiting = useWaitingCount()
  const canManageUsers = can(user, Permission.USERS_MANAGE)
  const canSeeConfig =
    can(user, Permission.SCREEN_LOCATIONS) || can(user, Permission.SCREEN_CATALOGS)
  const showDashboard = can(user, Permission.SCREEN_DASHBOARD)
  const isWorker = can(user, Permission.PRODUCTION_WORKER)
  // Tài khoản chỉ làm thợ: giấu hẳn các màn quản lý, không chỉ chặn ở route.
  const workerOnly = isWorkerOnly(user)
  const warehouses = WAREHOUSES.filter((warehouse) => canSeeWarehouse(user, warehouse.code))
  const showKho = hasAnyWarehouse(user)

  // Đóng drawer sau mỗi lần điều hướng — kể cả từ breadcrumb hay tab, không chỉ
  // từ menu bên trong drawer.
  useEffect(() => setMobileOpen(false), [location.pathname])

  async function onLogout() {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <ScreenLoadingBar />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar variant="dense" sx={{ gap: 1.5 }}>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: 'none' } }}
          >
            <TableRowsIcon />
          </IconButton>
          <Typography variant="subtitle1" noWrap sx={{ flex: 1, minWidth: 0, color: 'primary.dark', fontWeight: 700 }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Hệ thống quản lý xưởng
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              Enshido
            </Box>
          </Typography>

          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            {/* Ở thanh trên cùng nên quét được phiếu giấy từ bất kỳ màn nào. */}
            <ScanQrButton compact />
            <InstallAppButton />
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'secondary.main',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {initials(user?.fullName, user?.username)}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user?.fullName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.roleLabel ?? user?.roleCode}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              loading={loggingOut}
              onClick={() => void onLogout()}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Đăng xuất
            </Button>
            <IconButton
              aria-label="Đăng xuất"
              loading={loggingOut}
              onClick={() => void onLogout()}
              sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          <DrawerNav
            canManageUsers={canManageUsers}
            canSeeConfig={canSeeConfig}
            showDashboard={showDashboard}
            isWorker={isWorker}
            workerOnly={workerOnly}
            showKho={showKho}
            warehouses={warehouses}
          />
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <DrawerNav
            canManageUsers={canManageUsers}
            canSeeConfig={canSeeConfig}
            showDashboard={showDashboard}
            isWorker={isWorker}
            workerOnly={workerOnly}
            showKho={showKho}
            warehouses={warehouses}
          />
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, md: 2 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Toolbar variant="dense" sx={{ flexShrink: 0 }} />
        <InstallAppBanner sx={{ mb: 1.5, flexShrink: 0 }} />
        {offline ? (
          <Alert severity="warning" icon={<CloudOffIcon fontSize="small" />} sx={{ mb: 1.5, flexShrink: 0 }}>
            Đang ngoại tuyến — chỉ xem được dữ liệu đã tải. Có mạng lại là tự cập nhật
            {waiting > 0 ? ` và gửi ${waiting} thao tác đang chờ` : ''}.
          </Alert>
        ) : null}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  )
}

function NavItem({
  to,
  icon,
  label,
  end,
}: {
  to: string
  icon: ReactNode
  label: string
  end?: boolean
}) {
  const queryClient = useQueryClient()
  const warehouseCode = to.match(/^\/warehouses\/([^/]+)/)?.[1]

  return (
    <ListItemButton
      component={NavLink}
      to={to}
      end={end ?? to === '/'}
      onMouseEnter={() => {
        if (warehouseCode) prefetchWarehouseStock(queryClient, [warehouseCode])
        if (to === '/users') prefetchStaff(queryClient)
      }}
      sx={{
        borderRadius: 1,
        mb: 0.5,
        position: 'relative',
        '&.active': {
          bgcolor: 'action.selected',
          color: 'primary.dark',
          fontWeight: 700,
          '& .MuiListItemIcon-root': { color: 'primary.main' },
          '&::before': {
            content: '""',
            position: 'absolute',
            left: -8,
            top: 7,
            bottom: 7,
            width: 3,
            borderRadius: 2,
            bgcolor: 'secondary.main',
          },
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </ListItemButton>
  )
}

function DrawerNav({
  canManageUsers,
  canSeeConfig,
  showDashboard,
  isWorker,
  workerOnly,
  showKho,
  warehouses,
}: {
  canManageUsers: boolean
  canSeeConfig: boolean
  showDashboard: boolean
  /** Tài khoản có quyền Thợ sản xuất — thấy màn Phiếu của tôi. */
  isWorker: boolean
  /** Tài khoản chỉ làm thợ — ẩn các màn quản lý đơn và kho. */
  workerOnly: boolean
  showKho: boolean
  warehouses: WarehouseDef[]
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          px: 2,
          py: 1.5,
          background: 'linear-gradient(180deg, #fffdfa 0%, #f5ead9 100%)',
        }}
      >
        {/* Desktop: sidebar luôn mở cạnh nội dung nên logo nhỏ lại cho đỡ chiếm chỗ. */}
        <Box component="img" src={logo} alt="Enshido" sx={{ width: { xs: 150, md: 96 }, height: 'auto' }} />
      </Box>
      <Divider />
      <List dense sx={{ px: 1, py: 1, flex: 1 }}>
        {showDashboard ? (
          <NavItem to="/" icon={<TableChartIcon fontSize="small" />} label="Tổng quan" />
        ) : null}
        {workerOnly ? null : (
          <>
            <NavItem to="/casting" icon={<WhatshotIcon fontSize="small" />} label="Lệnh đúc" />
            <NavItem to="/orders" icon={<AssignmentIcon fontSize="small" />} label="Lệnh sản xuất" />
          </>
        )}
        {isWorker ? (
          <NavItem to="/my-tickets" icon={<AssignmentIndIcon fontSize="small" />} label="Phiếu của tôi" />
        ) : null}
        {showKho ? (
          <>
            <NavItem to="/warehouses" icon={<WarehouseIcon fontSize="small" />} label="Kho" end />
            <List dense disablePadding sx={{ pl: 1.5 }}>
              {warehouses.map((w) =>
                w.sections ? (
                  <WarehouseSectionMenu key={w.code} warehouse={w} />
                ) : (
                  <NavItem
                    key={w.code}
                    to={warehousePath(w)}
                    icon={<PalletIcon fontSize="small" />}
                    label={w.shortName}
                    end
                  />
                ),
              )}
            </List>
          </>
        ) : null}
        {canSeeConfig ? <ConfigMenu /> : null}
        {canManageUsers ? (
          <NavItem to="/users" icon={<PeopleIcon fontSize="small" />} label="Nhân sự" />
        ) : null}
      </List>
    </Box>
  )
}

function ConfigMenu() {
  const { user } = useAuth()
  const location = useLocation()
  const onThis = location.pathname.startsWith('/settings')
  const [open, setOpen] = useState(onThis)
  const showLocations = can(user, Permission.SCREEN_LOCATIONS)
  const showCatalogs = can(user, Permission.SCREEN_CATALOGS)

  useEffect(() => {
    if (onThis) setOpen(true)
  }, [onThis])

  return (
    <Box>
      <ListItemButton
        selected={onThis}
        onClick={() => setOpen((v) => !v)}
        sx={{ borderRadius: 1, mb: 0.5 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Cấu hình" />
        {open ? <NorthIcon sx={{ fontSize: 12 }} /> : <SouthIcon sx={{ fontSize: 12 }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding sx={{ pl: 2 }}>
          {showLocations ? (
            <NavItem
              to="/settings/locations"
              icon={<PlaceIcon fontSize="small" />}
              label="Vị trí"
            />
          ) : null}
          {showCatalogs ? (
            <NavItem
              to="/settings/catalogs"
              icon={<CategoryIcon fontSize="small" />}
              label="Danh mục"
            />
          ) : null}
        </List>
      </Collapse>
    </Box>
  )
}

function WarehouseSectionMenu({ warehouse }: { warehouse: WarehouseDef }) {
  const location = useLocation()
  const onThis = location.pathname.startsWith(`/warehouses/${warehouse.code}`)
  const [open, setOpen] = useState(onThis)

  useEffect(() => {
    if (onThis) setOpen(true)
  }, [onThis])

  return (
    <Box>
      <ListItemButton
        selected={onThis}
        onClick={() => setOpen((v) => !v)}
        sx={{ borderRadius: 1, mb: 0.5 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <WarehouseIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={warehouse.shortName} />
        {open ? <NorthIcon sx={{ fontSize: 12 }} /> : <SouthIcon sx={{ fontSize: 12 }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding sx={{ pl: 2 }}>
          {WAREHOUSE_SECTIONS.map((s) => (
            <NavItem
              key={s.code}
              to={warehousePath(warehouse, s.code)}
              icon={<TableRowsIcon fontSize="small" />}
              label={s.name}
              end
            />
          ))}
        </List>
      </Collapse>
    </Box>
  )
}
