import { useEffect, useState, type ReactNode } from 'react'
import {
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
import TableChartIcon from '@mui/icons-material/TableChart'
import PeopleIcon from '@mui/icons-material/People'
import TableRowsIcon from '@mui/icons-material/TableRows'
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import PalletIcon from '@mui/icons-material/Pallet'
import SellIcon from '@mui/icons-material/Sell'
import SouthIcon from '@mui/icons-material/South'
import NorthIcon from '@mui/icons-material/North'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { can, Permission } from '../auth/permissions'
import { BIN_SECTIONS, extraBinSections, WAREHOUSES, warehousePath, type StockBin } from '../warehouses/catalog'

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
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const canManageUsers = can(user, Permission.USERS_MANAGE)

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
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
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            Hệ thống quản lý xưởng
          </Typography>

          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'primary.main',
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
            <Button variant="outlined" onClick={() => void onLogout()}>
              Đăng xuất
            </Button>
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
          <DrawerNav canManageUsers={canManageUsers} />
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
          <DrawerNav canManageUsers={canManageUsers} />
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Toolbar variant="dense" sx={{ flexShrink: 0 }} />
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <Outlet />
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
  return (
    <ListItemButton
      component={NavLink}
      to={to}
      end={end ?? to === '/'}
      sx={{
        borderRadius: 1,
        mb: 0.5,
        '&.active': {
          bgcolor: 'action.selected',
          color: 'primary.main',
          '& .MuiListItemIcon-root': { color: 'primary.main' },
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </ListItemButton>
  )
}

function DrawerNav({ canManageUsers }: { canManageUsers: boolean }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ gap: 1, px: 2 }}>
        <PrecisionManufacturingIcon color="primary" fontSize="small" />
        <Box>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
            Enshido
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Xưởng sản xuất
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List dense sx={{ px: 1, py: 1, flex: 1 }}>
        <NavItem to="/" icon={<TableChartIcon fontSize="small" />} label="Tổng quan" />
        <NavItem to="/kho" icon={<WarehouseIcon fontSize="small" />} label="Kho" end />
        <List dense disablePadding sx={{ pl: 1.5 }}>
          {WAREHOUSES.map((w) =>
            w.bins?.length ? (
              <NvlChinhMenu key={w.code} warehouse={w} />
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
        <NavItem
          to="/cau-hinh-gia"
          icon={<SellIcon fontSize="small" />}
          label="Cấu hình giá sản phẩm"
        />
        {canManageUsers ? (
          <NavItem to="/users" icon={<PeopleIcon fontSize="small" />} label="Nhân sự" />
        ) : null}
      </List>
    </Box>
  )
}

function NvlChinhMenu({ warehouse }: { warehouse: (typeof WAREHOUSES)[number] }) {
  const location = useLocation()
  const onThis = location.pathname.startsWith(`/kho/${warehouse.code}`)
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
          {warehouse.bins?.map((b) => (
            <BinMenu key={b.code} warehouse={warehouse} bin={b} />
          ))}
        </List>
      </Collapse>
    </Box>
  )
}

function BinMenu({
  warehouse,
  bin,
}: {
  warehouse: (typeof WAREHOUSES)[number]
  bin: StockBin
}) {
  const location = useLocation()
  const onThis = location.pathname.startsWith(`/kho/${warehouse.code}/${bin.code}`)
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
          <PalletIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={bin.name} />
        {open ? <NorthIcon sx={{ fontSize: 12 }} /> : <SouthIcon sx={{ fontSize: 12 }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding sx={{ pl: 2 }}>
          {BIN_SECTIONS.map((s) => (
            <NavItem
              key={s.code}
              to={warehousePath(warehouse, bin.code, s.code)}
              icon={<TableRowsIcon fontSize="small" />}
              label={s.name}
              end
            />
          ))}
          {extraBinSections(bin.code).map((s) => (
            <NavItem
              key={s.code}
              to={warehousePath(warehouse, bin.code, s.code)}
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
