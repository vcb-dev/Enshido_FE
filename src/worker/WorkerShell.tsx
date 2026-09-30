import { Suspense, useState } from 'react'
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Divider,
  Drawer,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import LogoutIcon from '@mui/icons-material/Logout'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import { useAuth } from '../auth/AuthContext'
import { InstallAppBanner } from '../components/InstallAppBanner'
import { InstallAppButton } from '../components/InstallAppButton'
import { QrScannerDialog } from '../components/QrScannerDialog'
import { RouteSkeleton } from '../components/RouteSkeleton'
import { ScreenLoadingBar } from '../components/ScreenLoadingBar'
import { useOpenScannedPath } from '../components/ScanQrButton'
import { useWaitingCount } from '../orders/subTicketActions'

const CONTENT_MAX_WIDTH = 1180

function initials(name?: string, username?: string) {
  const parts = (name || username || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] ?? '?').slice(0, 2).toUpperCase()
}

/**
 * Khung app cho tài khoản chỉ làm thợ. Thợ chỉ có một việc (nhận và báo xong phiếu) nên bỏ
 * sidebar: máy tính dùng thanh trên gọn, điện thoại dùng thanh điều hướng dưới đáy với nút
 * quét mã ở giữa — thao tác một tay khi đang cầm phiếu giấy.
 */
export function WorkerShell() {
  const { user, logout, offline } = useAuth()
  const navigate = useNavigate()
  const openScanned = useOpenScannedPath()
  const waiting = useWaitingCount()
  const [scanning, setScanning] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function onLogout() {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  const avatar = (
    <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main', fontSize: '0.8rem', fontWeight: 700 }}>
      {initials(user?.fullName, user?.username)}
    </Avatar>
  )

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default' }}>
      <ScreenLoadingBar />
      <AppBar
        position="static"
        elevation={0}
        sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', color: 'text.primary' }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, md: 60 }, px: { xs: 2, md: 3 } }}>
          <Stack
            direction="row"
            spacing={{ xs: 1.5, md: 3 }}
            sx={{ alignItems: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH, mx: 'auto' }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box component="img" src={logo} alt="" sx={{ width: 30, height: 30, objectFit: 'contain' }} />
              <Typography sx={{ fontWeight: 800, letterSpacing: '.02em', color: 'primary.dark' }}>ENSHIDO</Typography>
            </Stack>
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, flex: 1 }}>
              <Button
                component={NavLink}
                to="/my-tickets"
                startIcon={<AssignmentIndIcon />}
                sx={{
                  color: 'text.secondary',
                  px: 1.5,
                  '&.active': { color: 'primary.dark', bgcolor: 'action.selected' },
                }}
              >
                Phiếu của tôi
              </Button>
            </Box>
            <Box sx={{ flex: { xs: 1, md: 'none' } }} />
            <Button
              variant="contained"
              startIcon={<QrCodeScannerIcon />}
              onClick={() => setScanning(true)}
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
            >
              Quét mã phiếu
            </Button>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <InstallAppButton />
            </Box>
            <ButtonBase
              onClick={(event) => setMenuAnchor(event.currentTarget)}
              aria-label="Tài khoản"
              sx={{ borderRadius: 99, display: { xs: 'none', md: 'flex' }, gap: 1, pr: 1, alignItems: 'center' }}
            >
              {avatar}
              <Box sx={{ textAlign: 'left', lineHeight: 1.15 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {user?.fullName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.roleLabel ?? 'Thợ'}
                </Typography>
              </Box>
            </ButtonBase>
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              <InstallAppButton />
            </Box>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: CONTENT_MAX_WIDTH,
            mx: 'auto',
            px: { xs: 2, md: 3 },
            pt: { xs: 2, md: 3 },
            pb: { xs: 2, md: 4 },
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <InstallAppBanner sx={{ mb: 2 }} />
          {offline ? (
            <Alert severity="warning" icon={<CloudOffIcon fontSize="small" />} sx={{ mb: 2 }}>
              Đang ngoại tuyến — chỉ xem được dữ liệu đã tải
              {waiting > 0 ? `, ${waiting} thao tác sẽ tự gửi khi có mạng` : ''}.
            </Alert>
          ) : null}
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>

      {/* Điện thoại: thanh dưới đáy, nút quét mã nổi ở giữa. */}
      <Box
        component="nav"
        sx={{
          display: { xs: 'grid', md: 'none' },
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'end',
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 1,
          pt: 0.5,
          pb: 'calc(6px + env(safe-area-inset-bottom, 0px))',
          flexShrink: 0,
        }}
      >
        <BottomItem to="/my-tickets" icon={<AssignmentIndIcon />} label="Phiếu" />
        <ButtonBase
          onClick={() => setScanning(true)}
          aria-label="Quét mã phiếu"
          sx={{
            mt: -3,
            mx: 2,
            width: 60,
            height: 60,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            boxShadow: '0 8px 20px rgba(62,42,14,.3)',
            border: '4px solid',
            borderColor: 'background.paper',
            '&:active': { transform: 'scale(.96)' },
          }}
        >
          <QrCodeScannerIcon />
        </ButtonBase>
        <ButtonBase
          onClick={() => setAccountOpen(true)}
          sx={{ flexDirection: 'column', py: 0.5, borderRadius: 2, color: 'text.secondary', gap: 0.25 }}
        >
          <Avatar sx={{ width: 24, height: 24, bgcolor: 'secondary.main', fontSize: '0.65rem', fontWeight: 700 }}>
            {initials(user?.fullName, user?.username)}
          </Avatar>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            Tài khoản
          </Typography>
        </ButtonBase>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 220, mt: 1 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {user?.fullName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            @{user?.username}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => void onLogout()} disabled={loggingOut}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Đăng xuất</ListItemText>
        </MenuItem>
      </Menu>

      <Drawer
        anchor="bottom"
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: 'env(safe-area-inset-bottom, 0px)' } } }}
      >
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1 }} />
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 2.5, py: 2 }}>
          {avatar}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {user?.fullName}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {user?.roleLabel ?? 'Thợ'} · @{user?.username}
            </Typography>
          </Box>
        </Stack>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Button
            fullWidth
            size="large"
            variant="outlined"
            color="secondary"
            startIcon={<LogoutIcon />}
            loading={loggingOut}
            onClick={() => void onLogout()}
          >
            Đăng xuất
          </Button>
        </Box>
      </Drawer>

      <QrScannerDialog
        open={scanning}
        onClose={() => setScanning(false)}
        onResult={(path) => {
          setScanning(false)
          openScanned(path)
        }}
      />
    </Box>
  )
}

function BottomItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <ButtonBase
      component={NavLink}
      to={to}
      sx={{
        flexDirection: 'column',
        py: 0.5,
        borderRadius: 2,
        color: 'text.secondary',
        gap: 0.25,
        '& svg': { fontSize: 24 },
        '&.active': { color: 'primary.main' },
      }}
    >
      {icon}
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
    </ButtonBase>
  )
}
