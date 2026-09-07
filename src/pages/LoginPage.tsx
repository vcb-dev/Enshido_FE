import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Container, Paper, Stack, Typography } from '@mui/material'
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { resolvePostLoginPath } from '../auth/homePath'
import { Form, FormTextField } from '../components/ui'

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

  if (!loading && user) {
    return <Navigate to={resolvePostLoginPath(user, fromState)} replace />
  }

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
        <Paper sx={{ p: 3 }}>
          <Form form={form} onSubmit={onSubmit}>
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

              <Button type="submit" variant="contained" size="medium" disabled={submitting}>
                {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </Button>
            </Stack>
          </Form>
        </Paper>
      </Container>
    </Box>
  )
}
