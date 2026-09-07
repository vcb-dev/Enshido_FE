import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { createUserApi, listUsersApi, type RoleCode, type UserRow } from '../api/auth'
import {
  DataTable,
  Form,
  FormCheckbox,
  FormRow,
  FormSelect,
  FormTextField,
  SearchInput,
  type Column,
  type SelectOption,
} from '../components/ui'
import { paginate, useTableParams } from '../hooks/useTableParams'

const ROLE_OPTIONS: SelectOption<RoleCode>[] = [
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'USER', label: 'USER' },
]

const COLUMNS: Column<UserRow>[] = [
  { key: 'fullName', header: 'Họ tên', sortable: true },
  { key: 'username', header: 'Tài khoản', sortable: true },
  { key: 'roleCode', header: 'Vai trò', sortable: true },
  { key: 'department', header: 'Bộ phận', sortable: true },
  {
    key: 'isActive',
    header: 'Trạng thái',
    render: (row) => (
      <Chip
        size="small"
        label={row.isActive ? 'Đang dùng' : 'Ngưng'}
        color={row.isActive ? 'success' : 'default'}
        variant="outlined"
      />
    ),
  },
]

export function UsersPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const table = useTableParams({ pageSize: 25, sort: 'fullName' })
  const { params } = table

  // API /users chưa nhận tham số lọc nên lọc & phân trang tại client.
  // Khi backend hỗ trợ, chỉ cần đổi thành listUsersApi(params) — queryKey đã có sẵn params.
  const users = useQuery({ queryKey: ['users', params], queryFn: listUsersApi })

  const rows = useMemo(() => {
    const all = users.data ?? []
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
  }, [users.data, params.search, params.sort, params.dir])

  // Giữ trang hợp lệ khi bộ lọc thu hẹp kết quả.
  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)

  return (
    <Stack spacing={2} sx={{ minHeight: 0, flex: 1 }}>
      <Stack>
        <Typography variant="h5">Nhân sự</Typography>
        <Typography variant="body2" color="text.secondary">
          Tài khoản đăng nhập hệ thống xưởng.
        </Typography>
      </Stack>

      <DataTable
        columns={COLUMNS}
        rows={paginate(rows, page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={users.isFetching}
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
            <Button variant="contained" sx={{ ml: 'auto' }} onClick={() => setOpen(true)}>
              Thêm nhân sự
            </Button>
          </>
        }
      />

      <CreateUserDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ['users'] })}
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
  /** Chỉ dùng cho giao diện: giữ hộp thoại mở để nhập tiếp người sau. */
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
    onSuccess: (_data, values) => {
      toast.success('Đã tạo nhân sự')
      onCreated()
      if (values.keepOpen) form.reset({ ...EMPTY_USER, keepOpen: true })
      else onClose()
    },
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
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            Lưu
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  )
}
