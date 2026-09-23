import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Container, Paper, Stack, Typography } from '@mui/material'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { resolvePostLoginPath } from '../auth/homePath'
import { Form, FormTextField, LoginSkeleton } from '../components/ui'
import { InstallAppBanner } from '../components/InstallAppBanner'
import logo from '../assets/logo.png'

type LoginFormValues = {
  username: string
  password: string
}

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fromState =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from !== '/login'
      ? (location.state as { from: string }).from
      : null

  const [error, setError] = useState('')
  const form = useForm<LoginFormValues>({ defaultValues: { username: '', password: '' } })
  const submitting = form.formState.isSubmitting

  if (user) {
    return <Navigate to={resolvePostLoginPath(user, fromState)} replace />
  }

  if (loading) return <LoginSkeleton />

  async function onSubmit(values: LoginFormValues) {
    setError('')
    try {
      const loggedIn = await login(values.username.trim(), values.password)
      toast.success('Đăng nhập thành công')
      navigate(resolvePostLoginPath(loggedIn, fromState), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại')
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
        {/* Thợ thường mở link từ nhóm Zalo — nhắc ra trình duyệt thật ngay từ lúc đăng nhập. */}
        <InstallAppBanner sx={{ mb: 2 }} />
        <Paper sx={{ p: 3 }}>
          <Form form={form} onSubmit={onSubmit}>
            <Stack spacing={2}>
              <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                <Box component="img" src={logo} alt="Enshido" sx={{ width: 180, height: 'auto' }} />
                <Typography variant="body2" color="text.secondary">
                  Quản lý xưởng sản xuất
                </Typography>
              </Stack>

              <Typography variant="subtitle1">Đăng nhập</Typography>

              <FormTextField<LoginFormValues>
                name="username"
                label="Tài khoản"
                autoComplete="username"
                required
              />
              <FormTextField<LoginFormValues>
                name="password"
                label="Mật khẩu"
                type="password"
                autoComplete="current-password"
                required
                rules={{ minLength: { value: 6, message: 'Mật khẩu tối thiểu 6 ký tự' } }}
              />

              {error ? <Alert severity="error">{error}</Alert> : null}

              <Button type="submit" variant="contained" size="medium" loading={submitting} loadingPosition="start">
                {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </Button>
            </Stack>
          </Form>
        </Paper>
      </Container>
    </Box>
  )
}
