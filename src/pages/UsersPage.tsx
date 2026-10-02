import { useEffect, useMemo, useRef, useState } from 'react'
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
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createUserApi,
  listUsersApi,
  updateUserApi,
  type UserRow,
} from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import type { PermissionCode } from '../auth/permissions'
import {
  allowedScreensForSave,
  defaultEditScreensForPreset,
  inferStaffJobPreset,
  presetShowsScreenEditor,
  roleAndScreensForPreset,
  screenGroupsForUserEdit,
  screensFromUserForPreset,
  staffJobLabel,
  staffJobPresetHint,
  staffJobPresetForEditForm,
  staffJobSelectOptions,
  type StaffJobPreset,
} from '../auth/staffJobPresets'
import { STAGE_LABEL } from '../orders/catalog'
import {
  DataTable,
  EditReasonBlock,
  Form,
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

function toStaffJobSelect(
  options: { value: StaffJobPreset; label: string }[],
): SelectOption<StaffJobPreset>[] {
  return options.map((option) => ({ value: option.value, label: option.label }))
}

const STAFF_JOB_FORM_SELECT = toStaffJobSelect(staffJobSelectOptions())

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
    placeholderData: keepPreviousData,
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

  const takenUsernames = useMemo(() => {
    const set = new Set<string>()
    for (const row of users.data ?? []) {
      set.add(row.username.trim().toLowerCase())
    }
    return set
  }, [users.data])

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
        render: (row) => staffJobLabel(row),
      },
      { key: 'department', header: 'Bộ phận', sortable: true },
      {
        key: 'workerStages',
        header: 'Khâu thợ',
        render: (row) =>
          row.workerStages?.length ? row.workerStages.map((stage) => STAGE_LABEL[stage]).join(', ') : '—',
      },
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
        takenUsernames={takenUsernames}
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
  staffJob: StaffJobPreset
  department: string
}

const EMPTY_USER: UserFormValues = {
  fullName: '',
  username: '',
  password: '',
  staffJob: 'kcs',
  department: '',
}

const USERNAME_TAKEN_MESSAGE = 'Tài khoản đã tồn tại'
const PASSWORD_MIN_MESSAGE = 'Tối thiểu 6 ký tự'

function CreateUserDialog({
  open,
  takenUsernames,
  onClose,
  onCreated,
}: {
  open: boolean
  takenUsernames: ReadonlySet<string>
  onClose: () => void
  onCreated: () => void
}) {
  const form = useForm<UserFormValues>({
    defaultValues: EMPTY_USER,
    // Chỉ Tài khoản / Mật khẩu validate khi blur (trigger tay). mode onBlur + autoFocus Họ tên
    // khiến dialog vừa mở đã blur và báo lỗi required.
    reValidateMode: 'onBlur',
  })
  const [screens, setScreens] = useState<PermissionCode[]>([])
  const staffJob = useWatch({ control: form.control, name: 'staffJob' })
  useEffect(() => {
    if (open) {
      form.reset(EMPTY_USER, { keepErrors: false, keepDirty: false, keepTouched: false })
      setScreens(defaultEditScreensForPreset('kcs'))
    }
  }, [open, form])

  const usernameRules = useMemo(
    () => ({
      minLength: { value: 3, message: 'Tối thiểu 3 ký tự' },
      validate: (value: string) => {
        const username = value.trim().toLowerCase()
        if (!username) return true
        return takenUsernames.has(username) ? USERNAME_TAKEN_MESSAGE : true
      },
    }),
    [takenUsernames],
  )

  const passwordRules = useMemo(
    () => ({
      minLength: { value: 6, message: PASSWORD_MIN_MESSAGE },
      validate: (value: string) =>
        !value || value.length >= 6 ? true : PASSWORD_MIN_MESSAGE,
    }),
    [],
  )

  useEffect(() => {
    if (!open) return
    setScreens(defaultEditScreensForPreset(staffJob))
  }, [staffJob, open])

  const toggle = (key: PermissionCode, checked: boolean) =>
    setScreens((prev) => (checked ? [...prev, key] : prev.filter((item) => item !== key)))

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      const mapped = roleAndScreensForPreset(values.staffJob)
      return createUserApi({
        username: values.username.trim(),
        fullName: values.fullName.trim(),
        password: values.password,
        roleCode: mapped.roleCode,
        department: values.department.trim() || undefined,
        allowedScreens: allowedScreensForSave(values.staffJob, screens),
        workerStages: [],
      })
    },
    onSuccess: () => {
      toast.success('Đã tạo nhân sự')
      onCreated()
      onClose()
    },
    onError: (error: Error) => {
      const message = error.message || 'Không tạo được nhân sự'
      if (message.includes('tồn tại')) {
        form.setError('username', { type: 'server', message: USERNAME_TAKEN_MESSAGE })
        return
      }
      toast.error(message)
    },
  })

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Form
        form={form}
        onSubmit={(values) => mutation.mutate(values)}
      >
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
              rules={usernameRules}
              onBlur={() => void form.trigger('username')}
            />
            <FormTextField<UserFormValues>
              name="password"
              label="Mật khẩu"
              type="password"
              required
              rules={passwordRules}
              onBlur={() => void form.trigger('password')}
            />
          </FormRow>
          <FormRow>
            <FormSelect<UserFormValues, StaffJobPreset>
              name="staffJob"
              label="Vai trò"
              options={STAFF_JOB_FORM_SELECT}
              required
            />
            <FormTextField<UserFormValues> name="department" label="Bộ phận" />
          </FormRow>
          <Typography variant="body2" color="text.secondary">
            {staffJobPresetHint(staffJob)}
          </Typography>
          {presetShowsScreenEditor(staffJob) ? (
            <>
              <Typography variant="body2" color="text.secondary">
                Tích thêm màn hình menu (kho, cấu hình…). Quyền công đoạn đã gắn theo vai trò ở trên.
              </Typography>
              {screenGroupsForUserEdit().map((group) => (
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
                            onChange={(event) => toggle(item.key, event.target.checked)}
                          />
                        }
                        label={item.label}
                      />
                    ))}
                  </FormGroup>
                </Stack>
              ))}
            </>
          ) : null}
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
  staffJob: StaffJobPreset
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
    defaultValues: { fullName: '', username: '', password: '', staffJob: 'kcs', department: '' },
  })
  const [screens, setScreens] = useState<PermissionCode[]>([])
  const [editReason, setEditReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const staffJob = useWatch({ control: form.control, name: 'staffJob' })
  const staffJobLoaded = useRef<StaffJobPreset | null>(null)
  useEffect(() => {
    if (!user) return
    staffJobLoaded.current = null
    const preset = inferStaffJobPreset(user)
    const formPreset = staffJobPresetForEditForm(preset)
    form.reset({
      fullName: user.fullName,
      username: user.username,
      password: '',
      staffJob: formPreset,
      department: user.department ?? '',
    })
    setScreens(isAdmin ? [] : screensFromUserForPreset(user, formPreset))
    setEditReason('')
    setReasonError('')
  }, [user, isAdmin, form])

  useEffect(() => {
    if (!user || isAdmin) return
    if (staffJobLoaded.current === null) {
      staffJobLoaded.current = staffJob
      return
    }
    if (staffJobLoaded.current === staffJob) return
    staffJobLoaded.current = staffJob
    setScreens(defaultEditScreensForPreset(staffJob))
  }, [staffJob, user, isAdmin])

  const mutation = useMutation({
    mutationFn: (values: EditUserFormValues) => {
      const targetId = user?.id
      if (!targetId) throw new Error('Không tìm thấy nhân sự')
      const mapped = roleAndScreensForPreset(values.staffJob)
      return updateUserApi(targetId, {
        fullName: values.fullName.trim(),
        roleCode: isAdmin ? undefined : mapped.roleCode,
        department: values.department.trim(),
        password: values.password.trim() || undefined,
        allowedScreens: isAdmin
          ? undefined
          : allowedScreensForSave(values.staffJob, screens),
        workerStages: [],
        editReason: editReason.trim(),
      })
    },
    onSuccess: () => {
      toast.success('Đã lưu nhân sự')
      onSaved()
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function toggle(key: PermissionCode, checked: boolean) {
    setScreens((current) =>
      checked ? Array.from(new Set([...current, key])) : current.filter((item) => item !== key),
    )
  }

  return (
    <Dialog open={Boolean(user)} onClose={onClose} fullWidth maxWidth="sm">
      <Form
        form={form}
        onSubmit={(values) => {
          if (!editReason.trim()) {
            setReasonError('Nhập lý do chỉnh sửa')
            return
          }
          mutation.mutate(values)
        }}
      >
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
            <FormSelect<EditUserFormValues, StaffJobPreset>
              name="staffJob"
              label="Vai trò"
              options={STAFF_JOB_FORM_SELECT}
              required
              disabled={isAdmin}
            />
            <FormTextField<EditUserFormValues> name="department" label="Bộ phận" />
          </FormRow>
          {isAdmin ? (
            <Typography variant="body2" color="text.secondary">
              Tài khoản Admin luôn xem được mọi màn hình.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {staffJobPresetHint(staffJob)}
            </Typography>
          )}
          {!isAdmin && presetShowsScreenEditor(staffJob) ? (
            <>
              <Typography variant="overline" color="text.secondary" sx={{ mt: 1 }}>
                Màn hình được xem
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tích thêm màn hình menu. Quyền công đoạn đã gắn theo vai trò.
              </Typography>
              {screenGroupsForUserEdit().map((group) => (
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
                            onChange={(event) => toggle(item.key, event.target.checked)}
                          />
                        }
                        label={item.label}
                      />
                    ))}
                  </FormGroup>
                </Stack>
              ))}
            </>
          ) : null}
          {user ? (
          <EditReasonBlock
            entityType="user"
            entityId={user.id}
            reason={editReason}
            onReasonChange={(value) => {
              setEditReason(value)
              if (value.trim()) setReasonError('')
            }}
            required
            error={reasonError}
          />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="contained" disabled={!user}>
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
    mutationFn: () => {
      const targetId = user?.id
      if (!targetId) throw new Error('Không tìm thấy nhân sự')
      return updateUserApi(targetId, { isActive: !user!.isActive })
    },
    onSuccess: () => {
      toast.success(locking ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản')
      onSaved()
      onClose()
    },
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

