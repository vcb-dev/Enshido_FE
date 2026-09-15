import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Stack,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createUserApi,
  listUsersApi,
  updateUserApi,
  type RoleCode,
  type UserRow,
} from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { ALL_PERMISSIONS, ROLE_LABELS, type PermissionCode } from '../auth/permissions'
import { SCREEN_GROUPS } from '../auth/screens'
import {
  DataTable,
  Form,
  FormCheckbox,
  FormRow,
  FormSelect,
  FormTextField,
  PageHeader,
  RowActions,
  SearchInput,
  type Column,
  type SelectOption,
} from '../components/ui'
import { paginate, useTableParams } from '../hooks/useTableParams'

const ROLE_OPTIONS: SelectOption<RoleCode>[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'USER', label: 'Nhân viên' },
]

export function UsersPage() {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [lockTarget, setLockTarget] = useState<UserRow | null>(null)
  const table = useTableParams({ pageSize: 25, sort: 'fullName' })
  const { params } = table

  const users = useQuery({
    queryKey: ['users'],
    queryFn: listUsersApi,
    staleTime: 60_000,
  })

  const rows = useMemo(() => {
    const all = (users.data ?? []).filter((user) => user.id !== me?.id)
    const keyword = params.search.trim().toLowerCase()
    const matched = keyword
      ? all.filter((user) =>
          [user.fullName, user.username, user.department ?? ''].some((field) =>
            field.toLowerCase().includes(keyword),
          ),
        )
      : all
    if (!params.sort) return matched
    const direction = params.dir === 'desc' ? -1 : 1
    return [...matched].sort((a, b) => {
      const left = String(a[params.sort as keyof UserRow] ?? '')
      const right = String(b[params.sort as keyof UserRow] ?? '')
      return left.localeCompare(right, 'vi') * direction
    })
  }, [users.data, me?.id, params.search, params.sort, params.dir])

  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)

  const columns = useMemo<Column<UserRow>[]>(
    () => [
      { key: 'fullName', header: 'Họ tên', sortable: true },
      { key: 'username', header: 'Tài khoản', sortable: true },
      {
        key: 'roleCode',
        header: 'Vai trò',
        sortable: true,
        render: (row) => ROLE_LABELS[row.roleCode] ?? row.roleCode,
      },
      { key: 'department', header: 'Bộ phận', sortable: true },
      {
        key: 'isActive',
        header: 'Trạng thái',
        render: (row) => (
          <Chip
            size="small"
            label={row.isActive ? 'Đang dùng' : 'Đã khóa'}
            color={row.isActive ? 'success' : 'default'}
            variant="outlined"
          />
        ),
      },
      {
        key: 'actions',
        header: 'Hành động',
        width: 100,
        align: 'center',
        cellSx: { overflow: 'visible' },
        render: (row) => (
          <RowActions
            onEdit={() => setEditing(row)}
            onLock={() => setLockTarget(row)}
            locked={!row.isActive}
          />
        ),
      },
    ],
    [],
  )

  function refreshUsers() {
    void queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  return (
    <Stack spacing={2} sx={{ flex: { md: 1 }, minHeight: { md: 0 } }}>
      <PageHeader
        title="Nhân sự"
        subtitle="Khóa tài khoản hoặc chỉnh sửa thông tin và màn hình được xem."
      />

      <DataTable
        columns={columns}
        rows={paginate(rows, page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={users.isLoading}
        errorText={users.error instanceof Error ? users.error.message : undefined}
        emptyText={params.search ? 'Không tìm thấy nhân sự phù hợp.' : 'Chưa có nhân sự.'}
        rowsLabel="nhân sự"
        sort={table.sortState}
        onSortChange={table.toggleSort}
        page={page}
        pageSize={params.pageSize}
        total={rows.length}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        toolbar={
          <>
            <SearchInput
              value={params.search}
              onChange={table.setSearch}
              placeholder="Tìm theo tên, tài khoản, bộ phận..."
            />
            <Button variant="contained" sx={{ ml: 'auto' }} onClick={() => setCreateOpen(true)}>
              Thêm nhân sự
            </Button>
          </>
        }
      />

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refreshUsers}
      />
      <EditUserDialog
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={refreshUsers}
      />
      <LockUserDialog
        user={lockTarget}
        onClose={() => setLockTarget(null)}
        onSaved={refreshUsers}
      />
    </Stack>
  )
}

type UserFormValues = {
  fullName: string
  username: string
  password: string
  roleCode: RoleCode
  department: string
  keepOpen: boolean
}

const EMPTY_USER: UserFormValues = {
  fullName: '',
  username: '',
  password: '',
  roleCode: 'USER',
  department: '',
  keepOpen: false,
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
  const form = useForm<UserFormValues>({ defaultValues: EMPTY_USER })

  useEffect(() => {
    if (open) form.reset(EMPTY_USER)
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      createUserApi({
        username: values.username.trim(),
        fullName: values.fullName.trim(),
        password: values.password,
        roleCode: values.roleCode,
        department: values.department.trim() || undefined,
      }),
    onMutate: (values) => {
      toast.success('Đã tạo nhân sự')
      if (values.keepOpen) form.reset({ ...EMPTY_USER, keepOpen: true })
      else onClose()
    },
    onSuccess: () => onCreated(),
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Form form={form} onSubmit={(values) => mutation.mutate(values)}>
        <DialogTitle>Thêm nhân sự</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <FormTextField<UserFormValues>
            name="fullName"
            label="Họ tên"
            required
            autoFocus
            sx={{ mt: 1 }}
          />
          <FormRow>
            <FormTextField<UserFormValues>
              name="username"
              label="Tài khoản"
              required
              rules={{ minLength: { value: 3, message: 'Tối thiểu 3 ký tự' } }}
            />
            <FormTextField<UserFormValues>
              name="password"
              label="Mật khẩu"
              type="password"
              required
              rules={{ minLength: { value: 6, message: 'Tối thiểu 6 ký tự' } }}
            />
          </FormRow>
          <FormRow>
            <FormSelect<UserFormValues, RoleCode>
              name="roleCode"
              label="Vai trò"
              options={ROLE_OPTIONS}
              required
            />
            <FormTextField<UserFormValues> name="department" label="Bộ phận" />
          </FormRow>
          <FormCheckbox<UserFormValues> name="keepOpen" label="Lưu xong tiếp tục thêm người khác" />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="contained">
            Lưu
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  )
}

type EditUserFormValues = {
  fullName: string
  username: string
  password: string
  roleCode: RoleCode
  department: string
}

function EditUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const isAdmin = user?.roleCode === 'ADMIN'
  const form = useForm<EditUserFormValues>({
    defaultValues: { fullName: '', username: '', password: '', roleCode: 'USER', department: '' },
  })
  const [screens, setScreens] = useState<PermissionCode[]>([])

  useEffect(() => {
    if (!user) return
    form.reset({
      fullName: user.fullName,
      username: user.username,
      password: '',
      roleCode: user.roleCode,
      department: user.department ?? '',
    })
    setScreens(isAdmin ? ALL_PERMISSIONS : ((user.allowedScreens ?? []) as PermissionCode[]))
  }, [user, isAdmin, form])

  const mutation = useMutation({
    mutationFn: (values: EditUserFormValues) =>
      updateUserApi(user!.id, {
        fullName: values.fullName.trim(),
        roleCode: values.roleCode,
        department: values.department.trim(),
        password: values.password.trim() || undefined,
        allowedScreens: isAdmin ? undefined : screens,
      }),
    onMutate: () => {
      toast.success('Đã lưu nhân sự')
      onClose()
    },
    onSuccess: () => onSaved(),
    onError: (error: Error) => toast.error(error.message),
  })

  function toggle(key: PermissionCode, checked: boolean) {
    setScreens((current) =>
      checked ? Array.from(new Set([...current, key])) : current.filter((item) => item !== key),
    )
  }

  return (
    <Dialog open={Boolean(user)} onClose={onClose} fullWidth maxWidth="sm">
      <Form form={form} onSubmit={(values) => mutation.mutate(values)}>
        <DialogTitle>Chỉnh sửa nhân sự</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <Typography variant="overline" color="text.secondary" sx={{ mt: 0.5 }}>
            Thông tin
          </Typography>
          <FormTextField<EditUserFormValues> name="fullName" label="Họ tên" required />
          <FormRow>
            <FormTextField<EditUserFormValues> name="username" label="Tài khoản" disabled />
            <FormTextField<EditUserFormValues>
              name="password"
              label="Mật khẩu mới"
              type="password"
              helperText="Để trống nếu không đổi."
              rules={{
                validate: (value) =>
                  !value || value.length >= 6 || 'Tối thiểu 6 ký tự',
              }}
            />
          </FormRow>
          <FormRow>
            <FormSelect<EditUserFormValues, RoleCode>
              name="roleCode"
              label="Vai trò"
              options={ROLE_OPTIONS}
              required
              disabled={isAdmin}
            />
            <FormTextField<EditUserFormValues> name="department" label="Bộ phận" />
          </FormRow>

          <Typography variant="overline" color="text.secondary" sx={{ mt: 1 }}>
            Màn hình được xem
          </Typography>
          {isAdmin ? (
            <Typography variant="body2" color="text.secondary">
              Tài khoản Admin luôn xem được mọi màn hình.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Tích màn hình được xem. Bỏ tích thì người này không vào được màn đó.
            </Typography>
          )}
          {SCREEN_GROUPS.map((group) => (
            <Stack key={group.label} spacing={0.25}>
              <Typography variant="subtitle2">{group.label}</Typography>
              <FormGroup>
                {group.items.map((item) => (
                  <FormControlLabel
                    key={item.key}
                    control={
                      <Checkbox
                        size="small"
                        checked={screens.includes(item.key)}
                        disabled={isAdmin}
                        onChange={(event) => toggle(item.key, event.target.checked)}
                      />
                    }
                    label={item.label}
                  />
                ))}
              </FormGroup>
            </Stack>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="contained">
            Lưu
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  )
}

function LockUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const locking = Boolean(user?.isActive)
  const mutation = useMutation({
    mutationFn: () => updateUserApi(user!.id, { isActive: !user!.isActive }),
    onMutate: () => {
      toast.success(locking ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản')
      onClose()
    },
    onSuccess: () => onSaved(),
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={Boolean(user)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{locking ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          {locking
            ? `${user?.fullName} sẽ không đăng nhập được cho đến khi mở khóa.`
            : `${user?.fullName} sẽ đăng nhập được lại.`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Hủy
        </Button>
        <Button
          color={locking ? 'error' : 'primary'}
          variant="contained"
          onClick={() => mutation.mutate()}
        >
          {locking ? 'Khóa' : 'Mở khóa'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
