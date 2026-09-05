import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { resolvePostLoginPath } from '../auth/homePath'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fromState =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from !== '/login'
      ? (location.state as { from: string }).from
      : null

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to={resolvePostLoginPath(user, fromState)} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const loggedIn = await login(username.trim(), password)
      toast.success('Đăng nhập thành công')
      navigate(resolvePostLoginPath(loggedIn, fromState), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="xs">
        <Paper component="form" onSubmit={onSubmit} sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <PrecisionManufacturingIcon color="primary" />
              <Box>
                <Typography variant="h6">Enshido</Typography>
                <Typography variant="body2" color="text.secondary">
                  Quản lý xưởng sản xuất
                </Typography>
              </Box>
            </Stack>

            <Typography variant="subtitle1">Đăng nhập</Typography>

            <TextField
              label="Tài khoản"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <TextField
              label="Mật khẩu"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              slotProps={{ htmlInput: { minLength: 6 } }}
            />

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Button
              type="submit"
              variant="contained"
              size="medium"
              disabled={submitting}
            >
              {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
