import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
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
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { useAppForm } from '../components/ui/form/useAppForm'
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
  extraJobOptions,
  inferStaffJobPresets,
  jobPresetsOf,
  permissionUserForForm,
  presetShowsScreenEditor,
  roleCodeForPresets,
  screenGroupsForUserEdit,
  screensAfterPresetChange,
  screensFromUserForPreset,
  staffJobLabel,
  staffJobPresetHint,
  staffJobPresetForEditForm,
  staffJobSelectOptions,
  STAFF_JOB_OPTIONS,
  workerStagesForSave,
  type StaffJobPreset,
} from '../auth/staffJobPresets'
import {
  departmentOptions,
  isWorkerPosition,
  POSITION_OPTIONS,
  positionLabel,
  SKILL_LEVELS,
} from '../auth/staffPositions'
import { STAGE_LABEL } from '../orders/catalog'
import {
  DataTable,
  FormEditReasonBlock,
  Form,
  FormRow,
  FormSelect,
  FormTextField,
  PageHeader,
  PlusIcon,
  RowActions,
  SearchInput,
  TrashIcon,
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
        key: 'position',
        header: 'Vị trí',
        sortable: true,
        render: (row) => positionLabel(row.position) || '—',
      },
      {
        key: 'skillLevel',
        header: 'Bậc tay nghề',
        sortable: true,
        render: (row) => (row.skillLevel != null ? `Bậc ${row.skillLevel}` : '—'),
      },
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
  /** Vị trí công việc (mã), '' = chưa có. Chỉ để hiển thị. */
  position: string
  /** Bậc tay nghề 1–5, chỉ khi vị trí là thợ; '' = chưa có. */
  skillLevel: number | ''
  /** Màn hình menu được tích thêm (quyền công đoạn đi theo vai trò). */
  screens: PermissionCode[]
  /** Vai trò thêm ngoài vai trò chính — mọi vai trò trừ VCB. '' = ô vừa thêm, chưa chọn. */
  extraRoles: (StaffJobPreset | '')[]
}

const roleLabelOf = (preset: StaffJobPreset) =>
  STAFF_JOB_OPTIONS.find((option) => option.value === preset)?.label ?? ''

/**
 * Danh sách tích màn hình menu — nối với field `screens` của form qua Controller. Nhóm và thứ tự
 * giống sidebar; mục vai trò bắt buộc mở (thợ đúc luôn thấy Lệnh đúc, thợ khâu luôn thấy Phiếu
 * khâu) hiện đã tích và khoá — dùng chung điều kiện với sidebar nên không lệch.
 */
function ScreenChecklist({ presets }: { presets: readonly StaffJobPreset[] }) {
  return (
    <Controller<{ screens: PermissionCode[] }, 'screens'>
      name="screens"
      render={({ field }) => {
        const value = field.value ?? []
        const toggle = (key: PermissionCode, checked: boolean) =>
          field.onChange(checked ? Array.from(new Set([...value, key])) : value.filter((item) => item !== key))
        return (
          <>
            {screenGroupsForUserEdit().map((group) => (
              <Stack key={group.label} spacing={0.25}>
                <Typography variant="subtitle2">{group.label}</Typography>
                <FormGroup>
                  {group.items.map((item) => {
                    // Bỏ chính ô này mà sidebar vẫn hiện = vai trò đã tự mở mục.
                    const without = value.filter((key) => key !== item.key)
                    const byRole = Boolean(item.menu?.(permissionUserForForm(presets, without)))
                    // Vai trò nào đã tự mở mục này (một vai trò đủ) — không có thì ghi cả danh sách.
                    const opener = presets.find((preset) => item.menu?.(permissionUserForForm([preset], without)))
                    const roleNote = opener ? roleLabelOf(opener) : presets.map(roleLabelOf).join(' + ')
                    return (
                      <FormControlLabel
                        key={item.key}
                        control={
                          <Checkbox
                            size="small"
                            checked={byRole || value.includes(item.key)}
                            disabled={byRole}
                            onChange={(event) => toggle(item.key, event.target.checked)}
                          />
                        }
                        label={<ChecklistLabel label={item.label} note={byRole ? `theo vai trò ${roleNote}` : null} />}
                      />
                    )
                  })}
                </FormGroup>
              </Stack>
            ))}
          </>
        )
      }}
    />
  )
}

function ChecklistLabel({ label, note }: { label: string; note: string | null }) {
  return (
    <>
      {label}
      {note ? (
        <Typography component="span" variant="caption" color="text.secondary">
          {' '}
          · {note}
        </Typography>
      ) : null}
    </>
  )
}

/**
 * Vai trò thêm: một người kiêm nhiều vai trò (Thủ kho + QC, QC + Thợ nguội, Admin + Thợ xi, …). Mỗi
 * lần bấm "+ Thêm vai trò" thêm một ô chọn; ô chỉ liệt kê vai trò chưa có (khác vai trò chính và
 * các ô khác). Khách VCB bị khoá riêng nên không thêm được và không có ô này.
 */
function ExtraJobRoles({ primary }: { primary: StaffJobPreset }) {
  const { getValues, setValue } = useFormContext<{ extraRoles: (StaffJobPreset | '')[] }>()
  // Đổi vai trò chính sang vai trò đang nằm ở ô thêm thì bỏ ô đó, khỏi trùng.
  useEffect(() => {
    const rows = getValues('extraRoles') ?? []
    if (rows.includes(primary)) {
      setValue(
        'extraRoles',
        rows.filter((row) => row !== primary),
      )
    }
  }, [primary, getValues, setValue])
  if (primary === 'vcb') return null
  return (
    <Controller<{ extraRoles: (StaffJobPreset | '')[] }, 'extraRoles'>
      name="extraRoles"
      rules={{
        validate: (value) => !(value ?? []).includes('') || 'Chọn vai trò cho ô vừa thêm hoặc xoá ô đó',
      }}
      render={({ field, fieldState }) => {
        const rows = field.value ?? []
        const taken = [primary, ...rows.filter((row): row is StaffJobPreset => row !== '')]
        const remaining = extraJobOptions(taken)
        const setRow = (index: number, next: StaffJobPreset) =>
          field.onChange(rows.map((row, i) => (i === index ? next : row)))
        return (
          <Stack spacing={1}>
            {rows.map((row, index) => (
              <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <TextField
                  select
                  size="small"
                  fullWidth
                  label={`Vai trò thêm ${index + 1}`}
                  value={row}
                  error={Boolean(fieldState.error) && row === ''}
                  helperText={row ? staffJobPresetHint(row) : undefined}
                  onChange={(event) => setRow(index, event.target.value as StaffJobPreset)}
                >
                  {staffJobSelectOptions()
                    .filter((option) => option.value !== 'vcb' && (option.value === row || !taken.includes(option.value)))
                    .map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                </TextField>
                <IconButton
                  aria-label="Xoá vai trò thêm"
                  onClick={() => field.onChange(rows.filter((_, i) => i !== index))}
                >
                  <TrashIcon />
                </IconButton>
              </Stack>
            ))}
            {fieldState.error ? (
              <Typography variant="caption" color="error">
                {fieldState.error.message}
              </Typography>
            ) : null}
            {remaining.length > 0 && !rows.includes('') ? (
              <Button
                size="small"
                startIcon={<PlusIcon />}
                onClick={() => field.onChange([...rows, ''])}
                sx={{ alignSelf: 'flex-start' }}
              >
                Thêm vai trò
              </Button>
            ) : null}
          </Stack>
        )
      }}
    />
  )
}

/**
 * Màn đang tích đi theo danh sách vai trò: thêm / bỏ vai trò thì thêm / bỏ màn mặc định của vai
 * trò đó, màn đã tích tay giữ nguyên. `baseline` là danh sách vai trò lúc mở form (đặt bởi dialog).
 */
function useScreensFollowPresets(
  setScreens: (updater: (current: PermissionCode[]) => PermissionCode[]) => void,
  presets: readonly StaffJobPreset[],
  baseline: RefObject<readonly StaffJobPreset[]>,
) {
  const key = presets.join('|')
  useEffect(() => {
    const before = baseline.current ?? []
    if (before.join('|') === key) return
    baseline.current = presets
    setScreens((current) => screensAfterPresetChange(current, before, presets))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi danh sách vai trò đổi
  }, [key])
}

const EMPTY_USER: UserFormValues = {
  fullName: '',
  username: '',
  password: '',
  staffJob: 'kcs',
  department: '',
  position: '',
  skillLevel: '',
  screens: [],
  extraRoles: [],
}

/** Vị trí công việc + bậc tay nghề (chỉ khi vị trí là thợ). Chỉ để hiển thị, không đổi quyền. */
function PositionFields() {
  const form = useFormContext<UserFormValues>()
  const position = useWatch({ control: form.control, name: 'position' })
  const worker = isWorkerPosition(position)
  return (
    <FormRow>
      <FormSelect<UserFormValues>
        name="position"
        label="Vị trí"
        options={[...POSITION_OPTIONS]}
        clearable
        helperText="Chỉ để hiển thị, không đổi quyền — quyền theo Vai trò"
      />
      {worker ? (
        <FormSelect<UserFormValues, number>
          name="skillLevel"
          label="Bậc tay nghề"
          options={SKILL_LEVELS.map((level) => ({ value: level, label: `Bậc ${level}` }))}
          clearable
        />
      ) : null}
    </FormRow>
  )
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
  const form = useAppForm<UserFormValues>({
    defaultValues: EMPTY_USER,
  })
  const staffJob = useWatch({ control: form.control, name: 'staffJob' })
  const extraRoles = useWatch({ control: form.control, name: 'extraRoles' })
  const presets = useMemo(() => jobPresetsOf(staffJob, extraRoles ?? []), [staffJob, extraRoles])
  const presetsBaseline = useRef<readonly StaffJobPreset[]>(['kcs'])
  useEffect(() => {
    if (open) {
      presetsBaseline.current = ['kcs']
      form.reset(
        { ...EMPTY_USER, screens: defaultEditScreensForPreset('kcs') },
        { keepErrors: false, keepDirty: false, keepTouched: false },
      )
    }
  }, [open, form])
  useScreensFollowPresets(
    (update) => form.setValue('screens', update(form.getValues('screens') ?? [])),
    presets,
    presetsBaseline,
  )

  const usernameRules = useMemo(
    () => ({
      minLength: { value: 3, message: 'Tối thiểu 3 ký tự' },
      validate: (value: unknown) => {
        const username = String(value ?? '').trim().toLowerCase()
        if (!username) return true
        return takenUsernames.has(username) ? USERNAME_TAKEN_MESSAGE : true
      },
    }),
    [takenUsernames],
  )

  const passwordRules = useMemo(
    () => ({
      minLength: { value: 6, message: PASSWORD_MIN_MESSAGE },
      validate: (value: unknown) =>
        !value || String(value).length >= 6 ? true : PASSWORD_MIN_MESSAGE,
    }),
    [],
  )

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      const picked = jobPresetsOf(values.staffJob, values.extraRoles)
      return createUserApi({
        username: values.username.trim(),
        fullName: values.fullName.trim(),
        password: values.password,
        roleCode: roleCodeForPresets(picked),
        department: values.department.trim() || undefined,
        position: values.position || undefined,
        skillLevel: isWorkerPosition(values.position) && values.skillLevel !== '' ? values.skillLevel : undefined,
        allowedScreens: allowedScreensForSave(picked, values.screens),
        workerStages: workerStagesForSave(picked),
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
            />
            <FormTextField<UserFormValues>
              name="password"
              label="Mật khẩu"
              type="password"
              required
              rules={passwordRules}
            />
          </FormRow>
          <FormRow>
            <FormSelect<UserFormValues, StaffJobPreset>
              name="staffJob"
              label="Vai trò"
              options={STAFF_JOB_FORM_SELECT}
              required
            />
            <FormSelect<UserFormValues> name="department" label="Bộ phận" options={departmentOptions(null)} clearable />
          </FormRow>
          <PositionFields />
          <Typography variant="body2" color="text.secondary">
            {staffJobPresetHint(staffJob)}
          </Typography>
          <ExtraJobRoles primary={staffJob} />
          {presetShowsScreenEditor(presets) ? (
            <>
              <ScreenChecklist presets={presets} />
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

type EditUserFormValues = UserFormValues & { editReason: string }

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
  const form = useAppForm<EditUserFormValues>({
    defaultValues: { ...EMPTY_USER, editReason: '' },
  })
  const staffJob = useWatch({ control: form.control, name: 'staffJob' })
  const extraRoles = useWatch({ control: form.control, name: 'extraRoles' })
  const presets = useMemo(() => jobPresetsOf(staffJob, extraRoles ?? []), [staffJob, extraRoles])
  const presetsBaseline = useRef<readonly StaffJobPreset[]>([])
  useEffect(() => {
    if (!user) return
    // Vai trò đầu danh sách là vai trò chính, còn lại mở ra thành vai trò thêm.
    const [first, ...rest] = inferStaffJobPresets(user)
    const primary = staffJobPresetForEditForm(first)
    const loaded = jobPresetsOf(primary, rest)
    presetsBaseline.current = loaded
    form.reset({
      fullName: user.fullName,
      username: user.username,
      password: '',
      staffJob: primary,
      department: user.department ?? '',
      position: user.position ?? '',
      skillLevel: user.skillLevel ?? '',
      screens: isAdmin ? [] : screensFromUserForPreset(user, loaded),
      extraRoles: rest,
      editReason: '',
    })
  }, [user, isAdmin, form])
  useScreensFollowPresets(
    (update) => {
      if (!user || isAdmin) return
      form.setValue('screens', update(form.getValues('screens') ?? []))
    },
    presets,
    presetsBaseline,
  )

  const mutation = useMutation({
    mutationFn: (values: EditUserFormValues) => {
      const targetId = user?.id
      if (!targetId) throw new Error('Không tìm thấy nhân sự')
      const picked = jobPresetsOf(values.staffJob, values.extraRoles)
      return updateUserApi(targetId, {
        fullName: values.fullName.trim(),
        // Role Admin không đổi được ở đây (BE giữ nguyên); Admin vẫn lưu được vai trò kiêm.
        roleCode: isAdmin ? undefined : roleCodeForPresets(picked),
        department: values.department.trim(),
        position: values.position,
        skillLevel: isWorkerPosition(values.position) && values.skillLevel !== '' ? values.skillLevel : null,
        password: values.password.trim() || undefined,
        allowedScreens: allowedScreensForSave(picked, values.screens),
        workerStages: workerStagesForSave(picked),
        editReason: values.editReason.trim(),
      })
    },
    onSuccess: () => {
      toast.success('Đã lưu nhân sự')
      onSaved()
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={Boolean(user)} onClose={onClose} fullWidth maxWidth="sm">
      <Form
        form={form}
        onSubmit={(values) => mutation.mutate(values)}
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
                  !value || String(value).length >= 6 || 'Tối thiểu 6 ký tự',
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
            <FormSelect<EditUserFormValues>
              name="department"
              label="Bộ phận"
              options={departmentOptions(user?.department)}
              clearable
            />
          </FormRow>
          <PositionFields />
          {isAdmin ? (
            <Typography variant="body2" color="text.secondary">
              Tài khoản Admin luôn xem được mọi màn hình.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {staffJobPresetHint(staffJob)}
            </Typography>
          )}
          <ExtraJobRoles primary={staffJob} />
          {!isAdmin && presetShowsScreenEditor(presets) ? (
            <>
              <Typography variant="overline" color="text.secondary" sx={{ mt: 1 }}>
                Màn hình được xem
              </Typography>
              <ScreenChecklist presets={presets} />
            </>
          ) : null}
          {user ? (
            <FormEditReasonBlock<EditUserFormValues> name="editReason" entityType="user" entityId={user.id} required />
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

