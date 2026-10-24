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
  useMediaQuery,
  useTheme,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import TableRowsIcon from '@mui/icons-material/TableRows'
import SouthIcon from '@mui/icons-material/South'
import NorthIcon from '@mui/icons-material/North'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboardOutlined'
import TrendingDownIcon from '@mui/icons-material/TrendingDownOutlined'
import PostAddIcon from '@mui/icons-material/PostAddOutlined'
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturingOutlined'
import BadgeIcon from '@mui/icons-material/BadgeOutlined'
import HandymanIcon from '@mui/icons-material/HandymanOutlined'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartmentOutlined'
import ForestIcon from '@mui/icons-material/ForestOutlined'
import VerifiedIcon from '@mui/icons-material/VerifiedOutlined'
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined'
import WarehouseIcon from '@mui/icons-material/WarehouseOutlined'
import DiamondIcon from '@mui/icons-material/DiamondOutlined'
import ExtensionIcon from '@mui/icons-material/ExtensionOutlined'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasketOutlined'
import StorefrontIcon from '@mui/icons-material/StorefrontOutlined'
import ViewListIcon from '@mui/icons-material/ViewListOutlined'
import TuneIcon from '@mui/icons-material/TuneOutlined'
import PinDropIcon from '@mui/icons-material/PinDropOutlined'
import ListAltIcon from '@mui/icons-material/ListAltOutlined'
import GroupsIcon from '@mui/icons-material/GroupsOutlined'
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
import { can, Permission } from '../auth/permissions'
import { canSeeWarehouse, hasAnyWarehouse } from '../auth/screens'
import { canAccessProductionOrdersPage, canUseMyTickets, canUseQcTickets } from '../intake/intake3dAccess'
import {
  canSeeCastingCutsMenu,
  canSeeCastingOrdersMenu,
  canSeeIntakeOrdersMenu,
  canSeeLossReport,
} from '../auth/screenAccess'
import { WAREHOUSES, sectionsOf, warehousePath, type WarehouseDef } from '../warehouses/catalog'

const DRAWER_WIDTH = 260
const SIDEBAR_OPEN_KEY = 'enshido.sidebarOpen'

function readSidebarOpen() {
  try {
    return localStorage.getItem(SIDEBAR_OPEN_KEY) !== '0'
  } catch {
    return true
  }
}

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
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  // Desktop: sidebar đóng/mở được, nhớ lựa chọn giữa các lần vào lại.
  const [desktopOpen, setDesktopOpen] = useState(readSidebarOpen)
  const [loggingOut, setLoggingOut] = useState(false)
  const waiting = useWaitingCount()
  const canManageUsers = can(user, Permission.USERS_MANAGE)
  const canSeeConfig =
    can(user, Permission.SCREEN_LOCATIONS) || can(user, Permission.SCREEN_CATALOGS)
  const showDashboard = can(user, Permission.SCREEN_DASHBOARD)
  const showLossReport = canSeeLossReport(user)
  const showMyTickets = canUseMyTickets(user)
  const showQcTickets = canUseQcTickets(user)
  const showIntakeOrders = canSeeIntakeOrdersMenu(user)
  const showProductionOrders = canAccessProductionOrdersPage(user)
  const showCastingOrders = canSeeCastingOrdersMenu(user)
  const showCastingCuts = canSeeCastingCutsMenu(user)
  const warehouses = WAREHOUSES.filter((warehouse) => canSeeWarehouse(user, warehouse.code))
  const showKho = hasAnyWarehouse(user)

  // Đóng drawer sau mỗi lần điều hướng — kể cả từ breadcrumb hay tab, không chỉ
  // từ menu bên trong drawer.
  useEffect(() => setMobileOpen(false), [location.pathname])

  function toggleSidebar() {
    if (!isDesktop) {
      setMobileOpen(true)
      return
    }
    setDesktopOpen((open) => {
      try {
        localStorage.setItem(SIDEBAR_OPEN_KEY, open ? '0' : '1')
      } catch {
        // Không lưu được thì chỉ mất ghi nhớ, vẫn đóng/mở bình thường.
      }
      return !open
    })
  }

  const sidebarWidth = desktopOpen ? DRAWER_WIDTH : 0
  const slide = theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: desktopOpen
      ? theme.transitions.duration.enteringScreen
      : theme.transitions.duration.leavingScreen,
  })

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
          width: { md: `calc(100% - ${sidebarWidth}px)` },
          ml: { md: `${sidebarWidth}px` },
          transition: slide,
        }}
      >
        <Toolbar variant="dense" sx={{ gap: 1.5 }}>
          <IconButton
            edge="start"
            aria-label={isDesktop && desktopOpen ? 'Thu gọn menu' : 'Mở menu'}
            onClick={toggleSidebar}
          >
            {isDesktop && desktopOpen ? <MenuOpenIcon /> : <TableRowsIcon />}
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

      <Box
        component="nav"
        sx={{ width: { md: sidebarWidth }, flexShrink: { md: 0 }, transition: slide }}
      >
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
            showLossReport={showLossReport}
            showMyTickets={showMyTickets}
            showQcTickets={showQcTickets}
            showIntakeOrders={showIntakeOrders}
            showProductionOrders={showProductionOrders}
            showCastingOrders={showCastingOrders}
            showCastingCuts={showCastingCuts}
            showKho={showKho}
            warehouses={warehouses}
          />
        </Drawer>
        <Drawer
          variant="persistent"
          open={desktopOpen}
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
            showLossReport={showLossReport}
            showMyTickets={showMyTickets}
            showQcTickets={showQcTickets}
            showIntakeOrders={showIntakeOrders}
            showProductionOrders={showProductionOrders}
            showCastingOrders={showCastingOrders}
            showCastingCuts={showCastingCuts}
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
  showLossReport,
  showMyTickets,
  showQcTickets,
  showIntakeOrders,
  showProductionOrders,
  showCastingOrders,
  showCastingCuts,
  showKho,
  warehouses,
}: {
  canManageUsers: boolean
  canSeeConfig: boolean
  showDashboard: boolean
  showLossReport: boolean
  showMyTickets: boolean
  showQcTickets: boolean
  showIntakeOrders: boolean
  showProductionOrders: boolean
  showCastingOrders: boolean
  showCastingCuts: boolean
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
        {/* Desktop: sidebar nằm cạnh nội dung nên logo nhỏ lại cho đỡ chiếm chỗ. */}
        <Box component="img" src={logo} alt="Enshido" sx={{ width: { xs: 150, md: 96 }, height: 'auto' }} />
      </Box>
      <Divider />
      <List dense sx={{ px: 1, py: 1, flex: 1 }}>
        {showDashboard ? (
          <NavItem to="/" icon={<SpaceDashboardIcon fontSize="small" />} label="Tổng quan" />
        ) : null}
        {showLossReport ? (
          <NavItem to="/loss-report" icon={<TrendingDownIcon fontSize="small" />} label="Báo cáo hao hụt" />
        ) : null}
        {showIntakeOrders ? (
          <NavItem to="/intake-orders" icon={<PostAddIcon fontSize="small" />} label="Tạo đơn" />
        ) : null}
        {showProductionOrders ? (
          <NavItem to="/orders" icon={<PrecisionManufacturingIcon fontSize="small" />} label="Lệnh sản xuất" />
        ) : null}
        <MyTicketsMenu
          items={[
            showMyTickets
              ? { to: '/my-tickets', icon: <HandymanIcon fontSize="small" />, label: 'Phiếu khâu' }
              : null,
            showCastingOrders
              ? { to: '/casting', icon: <LocalFireDepartmentIcon fontSize="small" />, label: 'Lệnh đúc' }
              : null,
            showCastingCuts
              ? { to: '/casting-cuts', icon: <ForestIcon fontSize="small" />, label: 'Cắt cây thông' }
              : null,
            showQcTickets
              ? { to: '/qc-tickets', icon: <VerifiedIcon fontSize="small" />, label: 'Phiếu QC' }
              : null,
          ]}
        />
        {showKho ? (
          <>
            <NavItem to="/warehouses" icon={<Inventory2Icon fontSize="small" />} label="Kho" end />
            <List dense disablePadding sx={{ pl: 1.5 }}>
              {warehouses.map((w) =>
                w.sections ? (
                  <WarehouseSectionMenu key={w.code} warehouse={w} />
                ) : (
                  <NavItem
                    key={w.code}
                    to={warehousePath(w)}
                    icon={warehouseIcon(w.code)}
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
          <NavItem to="/users" icon={<GroupsIcon fontSize="small" />} label="Nhân sự" />
        ) : null}
      </List>
    </Box>
  )
}

/** Icon riêng cho từng kho trên sidebar; kho mới chưa khai thì dùng icon kho chung. */
function warehouseIcon(code: string) {
  switch (code) {
    case 'nvl-chinh':
      return <DiamondIcon fontSize="small" />
    case 'btp-cho-vao-da':
      return <ExtensionIcon fontSize="small" />
    case 'nvl-tieu-hao':
      return <ShoppingBasketIcon fontSize="small" />
    case 'thanh-pham':
      return <StorefrontIcon fontSize="small" />
    default:
      return <WarehouseIcon fontSize="small" />
  }
}

type MenuLink = { to: string; icon: ReactNode; label: string }

/** Đang ở trang `to` hoặc trang con của nó (`/casting` không tính `/casting-cuts`). */
function isOnPath(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`)
}

/**
 * Nhóm "Phiếu của tôi": phiếu khâu, lệnh đúc, cắt cây thông, phiếu QC — mục nào có quyền mới hiện.
 * Chỉ còn một mục thì hiện thẳng mục đó, không cần nhóm.
 */
function MyTicketsMenu({ items }: { items: (MenuLink | null)[] }) {
  const location = useLocation()
  const links = items.filter((item): item is MenuLink => item !== null)
  const onThis = links.some((link) => isOnPath(location.pathname, link.to))
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (onThis) setOpen(true)
  }, [onThis])

  if (links.length === 0) return null
  if (links.length === 1) {
    const [link] = links
    return <NavItem to={link.to} icon={link.icon} label={link.to === '/my-tickets' ? 'Phiếu của tôi' : link.label} />
  }
  return (
    <Box>
      <ListItemButton
        selected={onThis && !open}
        onClick={() => setOpen((v) => !v)}
        sx={{ borderRadius: 1, mb: 0.5 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <BadgeIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Phiếu của tôi" />
        {open ? <NorthIcon sx={{ fontSize: 12 }} /> : <SouthIcon sx={{ fontSize: 12 }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding sx={{ pl: 2 }}>
          {links.map((link) => (
            <NavItem key={link.to} to={link.to} icon={link.icon} label={link.label} />
          ))}
        </List>
      </Collapse>
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
          <TuneIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Cấu hình" />
        {open ? <NorthIcon sx={{ fontSize: 12 }} /> : <SouthIcon sx={{ fontSize: 12 }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding sx={{ pl: 2 }}>
          {showLocations ? (
            <NavItem
              to="/settings/locations"
              icon={<PinDropIcon fontSize="small" />}
              label="Vị trí"
            />
          ) : null}
          {showCatalogs ? (
            <NavItem
              to="/settings/catalogs"
              icon={<ListAltIcon fontSize="small" />}
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
          {warehouseIcon(warehouse.code)}
        </ListItemIcon>
        <ListItemText primary={warehouse.shortName} />
        {open ? <NorthIcon sx={{ fontSize: 12 }} /> : <SouthIcon sx={{ fontSize: 12 }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding sx={{ pl: 2 }}>
          {sectionsOf(warehouse).map((s) => (
            <NavItem
              key={s.code}
              to={warehousePath(warehouse, s.code)}
              icon={<ViewListIcon fontSize="small" />}
              label={s.name}
              end
            />
          ))}
        </List>
      </Collapse>
    </Box>
  )
}
