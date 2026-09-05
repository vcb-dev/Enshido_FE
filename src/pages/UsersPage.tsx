import { useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createUserApi, listUsersApi, type RoleCode } from '../api/auth'

export function UsersPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const users = useQuery({ queryKey: ['users'], queryFn: listUsersApi })

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack>
          <Typography variant="h5">Nhân sự</Typography>
          <Typography variant="body2" color="text.secondary">
            Tài khoản đăng nhập hệ thống xưởng.
          </Typography>
        </Stack>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Thêm nhân sự
        </Button>
      </Stack>

      {users.error instanceof Error ? <Alert severity="error">{users.error.message}</Alert> : null}

      <TableContainer component={Paper}>
        {users.isFetching ? <LinearProgress /> : null}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Họ tên</TableCell>
              <TableCell>Tài khoản</TableCell>
              <TableCell>Vai trò</TableCell>
              <TableCell>Bộ phận</TableCell>
              <TableCell>Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(users.data ?? []).map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.fullName}</TableCell>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.roleCode}</TableCell>
                <TableCell>{u.department ?? '—'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={u.isActive ? 'Đang dùng' : 'Ngưng'}
                    color={u.isActive ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
            {!users.isLoading && (users.data?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Chưa có nhân sự.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateUserDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false)
          void queryClient.invalidateQueries({ queryKey: ['users'] })
        }}
      />
    </Stack>
  )
}

function CreateUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [roleCode, setRoleCode] = useState<RoleCode>('USER')
  const [department, setDepartment] = useState('')

  const mutation = useMutation({
    mutationFn: createUserApi,
    onSuccess: () => {
      toast.success('Đã tạo nhân sự')
      onCreated()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate({
      username: username.trim(),
      fullName: fullName.trim(),
      password,
      roleCode,
      department: department.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={onSubmit}>
        <DialogTitle>Thêm nhân sự</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <TextField
            label="Họ tên"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            sx={{ mt: 1 }}
          />
          <TextField
            label="Tài khoản"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <TextField
            label="Mật khẩu"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <TextField
            select
            label="Vai trò"
            value={roleCode}
            onChange={(e) => setRoleCode(e.target.value as RoleCode)}
          >
            <MenuItem value="ADMIN">ADMIN</MenuItem>
            <MenuItem value="USER">USER</MenuItem>
          </TextField>
          <TextField
            label="Bộ phận"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            Lưu
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
