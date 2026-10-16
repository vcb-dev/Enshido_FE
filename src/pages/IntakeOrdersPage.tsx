import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Stack, Typography } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createIntakeOrderApi,
  deleteIntakeOrderApi,
  listIntakeOrdersApi,
  updateIntakeOrderApi,
  type IntakeOrder,
  type IntakeOrderStatus,
  type UpsertIntakeOrderPayload,
} from '../api/intakeOrders'
import type { OrderImage, ProductionRequestType } from '../api/productionOrders'
import {
  afterIntakeCreated,
  afterIntakeUpdated,
  removeIntakeOrderFromCaches,
} from '../intake/intakeOrderCache'
import {
  ColumnHeaderFilter,
  ColumnHeaderSearch,
  CrudDialogShell,
  DataTable,
  FormRow,
  FormSelect,
  FormTextField,
  PageHeader,
  RowActions,
  TextInput,
  type Column,
} from '../components/ui'
import {
  intakeDetailImages,
  intakeWorkflowImages,
} from '../intake/intakeImages'
import { IntakeImageThumbs } from '../intake/IntakeImageThumbs'
import { IntakeOrderDetailDialog } from '../intake/IntakeOrderDetailDialog'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'
import { useAuth } from '../auth/AuthContext'
import { can, Permission } from '../auth/permissions'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { useOperatorName } from '../hooks/useOperatorName'
import { useTableParams } from '../hooks/useTableParams'
import { INTAKE_STATUSES, INTAKE_STATUS_META } from '../intake/catalog'
import { IntakeOrderStatusChips } from '../intake/IntakeStatusChip'
import { ImageUploadField } from '../orders/ImageUploadField'
import { formatDateShort, REQUEST_TYPES, REQUEST_TYPE_META } from '../orders/catalog'
import { RequestTypeChip } from '../orders/OrderChips'
type FormValues = {
  status: IntakeOrderStatus
  requestType: ProductionRequestType | ''
  productName: string
  qty: string
  trackingCode: string
  customerCode: string
  placedBy: string
  description: string
  createdDate: string
  dueDate: string
  editReason: string
  detailImages: OrderImage[]
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

/** Mọi đơn tạo mới đều là hàng của VCB — ô khách hàng chỉ để xem. */
const CUSTOMER_NAME = 'VCB'

/** Khối field có viền trong hộp thoại tạo / sửa đơn, gom nhóm cho dễ đọc. */
function FormSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: 1.75,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
      }}
    >
      {title ? (
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}
          color="text.secondary"
        >
          {title}
        </Typography>
      ) : null}
      {children}
    </Box>
  )
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function validateDueDate(value: unknown, createdDate: string, allowPast: boolean) {
  const due = String(value ?? '').trim()
  if (!due) return 'Chọn ngày trả hàng'
  // Tạm tắt theo yêu cầu để nhập được đơn cũ; mở lại khi nhập xong dữ liệu quá khứ.
  // if (!allowPast && due < todayYmd()) return 'Không được chọn ngày trong quá khứ'
  // if (createdDate && due < createdDate) return 'Ngày trả hàng không được trước ngày tạo'
  void allowPast
  void createdDate
  return true
}

const EMPTY: FormValues = {
  status: 'PENDING_APPROVAL',
  requestType: '',
  productName: '',
  qty: '',
  trackingCode: '',
  customerCode: '',
  placedBy: '',
  description: '',
  createdDate: todayYmd(),
  dueDate: '',
  editReason: '',
  detailImages: [],
}

function imagesForSave(row: IntakeOrder | null, detailImages: OrderImage[]): OrderImage[] {
  if (!row) return detailImages
  return [...detailImages, ...intakeWorkflowImages(row.images)]
}

export function IntakeOrdersPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const dialog = useCrudDialog<IntakeOrder>()
  const openedFromLink = useRef(false)
  const operatorName = useOperatorName()
  const { user } = useAuth()
  const canCreate = can(user, Permission.INTAKE_CREATE)
  const canApprove = can(user, Permission.INTAKE_APPROVE)
  const table = useTableParams({
    pageSize: 25,
    filters: { status: '' as IntakeOrderStatus | '', search: '' },
  })
  const { params } = table
  const [deleteTarget, setDeleteTarget] = useState<IntakeOrder | null>(null)
  const [viewTarget, setViewTarget] = useState<IntakeOrder | null>(null)

  const list = useQuery({
    queryKey: ['intake-orders', params.page, params.pageSize, params.status, params.search],
    queryFn: () =>
      listIntakeOrdersApi({
        status: params.status,
        search: params.search,
        page: params.page,
        pageSize: params.pageSize,
        // Lệnh bù chỉ hiện ở Lệnh sản xuất (dưới đơn gốc), không phải một đơn đặt hàng mới.
        rootsOnly: true,
      }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })

  useEffect(() => {
    const openEditId = (location.state as { openEditId?: string } | null)?.openEditId
    if (!openEditId || openedFromLink.current) return
    const row = list.data?.items.find((item) => item.id === openEditId)
    if (!row) return
    openedFromLink.current = true
    dialog.openEdit(row)
    navigate(location.pathname, { replace: true, state: null })
  }, [dialog, list.data?.items, location.pathname, location.state, navigate])

  const create = useMutation({
    mutationFn: createIntakeOrderApi,
    onSuccess: (order) => {
      dialog.close()
      toast.success('Đã tạo đơn')
      afterIntakeCreated(queryClient, order)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const update = useMutation({
    mutationFn: ({ id, ...payload }: UpsertIntakeOrderPayload & { id: string }) =>
      updateIntakeOrderApi(id, payload),
    onSuccess: (order) => {
      dialog.close()
      toast.success('Đã lưu đơn')
      afterIntakeUpdated(queryClient, order)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: deleteIntakeOrderApi,
    onSuccess: (_void, id) => {
      setDeleteTarget(null)
      toast.success('Đã xóa đơn')
      removeIntakeOrderFromCaches(queryClient, id)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo<Column<IntakeOrder>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã đơn hàng',
        width: 100,
        render: (row) => row.code,
        filter: (
          <ColumnHeaderSearch
            value={params.search}
            onChange={(search) => table.setFilter({ search })}
            placeholder="Tìm mã đơn, mã SP…"
          />
        ),
      },
      {
        key: 'createdDate',
        header: 'Ngày tạo',
        width: 110,
        render: (row) => formatDateShort(row.createdDate ?? row.createdAt),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        width: 170,
        filter: (
          <ColumnHeaderFilter
            valueId={params.status}
            onChange={(status) => table.setFilter({ status: status as IntakeOrderStatus | '' })}
            options={INTAKE_STATUSES.map((status) => ({
              id: status,
              // Đơn đã cắt cây hiện trạng thái thật của lệnh SX — lọc chung một nhóm.
              name: status === 'WAIT_COOLING' ? 'Đã vào sản xuất' : INTAKE_STATUS_META[status].label,
            }))}
          />
        ),
        render: (row) => <IntakeOrderStatusChips order={row} />,
      },
      {
        key: 'productName',
        header: 'Tên sản phẩm',
        width: 160,
        ellipsis: true,
        render: (row) => row.productName?.trim() || '—',
      },
      {
        key: 'requestType',
        header: 'Loại đơn hàng',
        width: 140,
        render: (row) => <RequestTypeChip type={row.requestType} />,
      },
      { key: 'qty', header: 'SL lên đơn', width: 100, align: 'right', render: (row) => row.qty },
      {
        key: 'dueDate',
        header: 'Thời gian trả hàng',
        width: 130,
        render: (row) => (row.dueDate ? formatDateShort(row.dueDate) : '—'),
      },
      {
        key: 'trackingCode',
        header: 'Mã sản phẩm',
        width: 120,
        ellipsis: true,
        render: (row) => row.trackingCode?.trim() || '—',
      },
      {
        key: 'customerCode',
        header: 'Mã của khách',
        width: 120,
        ellipsis: true,
        render: (row) => row.customerCode?.trim() || '—',
      },
      {
        key: 'customerName',
        header: 'Khách hàng',
        width: 110,
        ellipsis: true,
        render: (row) => row.customerName?.trim() || '—',
      },
      {
        key: 'placedBy',
        header: 'Người đặt đơn',
        width: 120,
        ellipsis: true,
        render: (row) => row.placedBy,
      },
      {
        key: 'description',
        header: 'Yêu cầu khác',
        width: 260,
        ellipsis: true,
        render: (row) => row.description || '—',
      },
      {
        key: 'detailImages',
        header: 'Ảnh chi tiết',
        width: 120,
        render: (row) => (
          <IntakeImageThumbs
            label="Ảnh chi tiết"
            images={intakeDetailImages(row.images)}
          />
        ),
      },
      {
        key: 'actions',
        header: 'Hành động',
        width: 140,
        align: 'center',
        card: 'actions',
        render: (row) => (
          <RowActions
            titles={{
              view: 'Xem chi tiết',
              edit: 'Chỉnh sửa',
              delete:
                row.status === 'PENDING_APPROVAL' ? 'Xóa' : 'Chỉ xóa được đơn chờ duyệt',
            }}
            onView={() => setViewTarget(row)}
            onEdit={canCreate || canApprove ? () => dialog.openEdit(row) : undefined}
            onDelete={canApprove ? () => setDeleteTarget(row) : undefined}
            deleteDisabled={row.status !== 'PENDING_APPROVAL'}
          />
        ),
      },
    ],
    [dialog.openEdit, params.search, params.status, table],
  )

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: { md: 1 }, minHeight: { md: 0 }, height: { md: '100%' }, overflow: { xs: 'visible', md: 'hidden' } }}
    >
      <PageHeader
        title="Tạo đơn"
        subtitle="Phiếu đặt hàng — ảnh, số lượng, hạn trả và mã sản phẩm"
        compactSubtitle
      />

      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={list.isLoading && !list.data}
        errorText={list.error instanceof Error ? list.error.message : undefined}
        emptyText={
          params.search || params.status
            ? 'Không có đơn khớp bộ lọc.'
            : 'Chưa có đơn. Bấm Tạo đơn mới.'
        }
        variant="grid"
        fixedLayout
        minWidth={1730}
        cardBreakpoint={false}
        showIndex
        indexOffset={(params.page - 1) * params.pageSize}
        page={params.page}
        pageSize={params.pageSize}
        total={list.data?.total ?? 0}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        rowsLabel="đơn"
        sx={{ flex: { md: 1 } }}
        toolbar={
          canCreate ? (
            <Button variant="contained" sx={{ ml: 'auto' }} onClick={() => dialog.openCreate()}>
              Tạo đơn mới
            </Button>
          ) : undefined
        }
      />

      <IntakeOrderFormDialog
        open={dialog.open}
        row={dialog.row}
        operatorName={operatorName}
        saving={create.isPending || update.isPending}
        onClose={dialog.close}
        onExited={dialog.clear}
        onSave={(payload) =>
          dialog.row
            ? update.mutateAsync({ id: dialog.row.id, ...payload })
            : create.mutateAsync(payload)
        }
      />

      <IntakeOrderDetailDialog order={viewTarget} onClose={() => setViewTarget(null)} />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="Xóa đơn"
        description={
          deleteTarget
            ? `Xóa đơn ${deleteTarget.code}? Chỉ xóa được đơn đang chờ duyệt.`
            : ''
        }
        deleting={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </Stack>
  )
}

function IntakeOrderFormDialog({
  open,
  row,
  operatorName,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  row: IntakeOrder | null
  operatorName: string
  saving: boolean
  onClose: () => void
  onExited: () => void
  onSave: (payload: UpsertIntakeOrderPayload) => void | Promise<unknown>
}) {
  const form = useForm<FormValues>({ defaultValues: EMPTY, reValidateMode: 'onSubmit' })
  const [uploadingDetail, setUploadingDetail] = useState(false)
  const onDetailUploading = useCallback((busy: boolean) => setUploadingDetail(busy), [])

  useEffect(() => {
    if (!open) return
    if (row) {
      form.reset({
        status: row.status,
        requestType: row.requestType,
        productName: row.productName ?? '',
        qty: String(row.qty),
        trackingCode: row.trackingCode ?? '',
        customerCode: row.customerCode ?? '',
        placedBy: row.placedBy,
        description: row.description,
        createdDate: row.createdDate,
        dueDate: row.dueDate ?? '',
        editReason: '',
        detailImages: intakeDetailImages(row.images),
      })
    } else {
      // Ngày tạo mặc định là hôm nay, sửa được trên form để nhập đơn cũ.
      form.reset({ ...EMPTY, createdDate: todayYmd(), placedBy: operatorName })
    }
  }, [open, row, operatorName, form])

  function submit(values: FormValues) {
    if (!values.requestType) return
    const qty = Number(values.qty)
    if (!(qty >= 1)) return
    return onSave({
      requestType: values.requestType,
      productName: values.productName.trim(),
      qty,
      trackingCode: values.trackingCode.trim() || null,
      customerCode: values.customerCode.trim() || null,
      placedBy: values.placedBy.trim(),
      description: values.description.trim(),
      createdDate: values.createdDate,
      dueDate: values.dueDate.trim(),
      images: imagesForSave(row, values.detailImages),
      editReason: values.editReason?.trim() || undefined,
    })
  }

  const uploading = uploadingDetail

  return (
    <CrudDialogShell<FormValues>
      open={open}
      kind={row ? 'edit' : 'create'}
      titles={{ create: 'Tạo đơn mới', edit: 'Sửa đơn', view: 'Đơn' }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitDisabled={uploading}
      maxWidth="md"
      submitLabel={uploading ? 'Đang upload ảnh…' : row ? 'Lưu' : 'Tạo đơn'}
      onClose={onClose}
      onExited={onExited}
      editLog={row ? { entityType: 'intake_order_form', entityId: row.id } : undefined}
    >
      {row ? (
        // Trạng thái chỉ đổi qua nút thao tác của từng bước, form sửa không nhảy bước được.
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Trạng thái:
          </Typography>
          <IntakeOrderStatusChips order={row} />
        </Stack>
      ) : null}

      <FormSection title="Sản phẩm">
        <FormRow columns={2}>
          <FormSelect<FormValues>
            name="requestType"
            label="Loại đơn hàng"
            required
            clearable
            options={REQUEST_TYPES.map((type) => ({
              value: type,
              label: REQUEST_TYPE_META[type].label,
            }))}
          />
          <FormTextField<FormValues>
            name="productName"
            label="Tên sản phẩm"
            required
            autoFocus={!row}
          />
        </FormRow>

        <FormRow columns={4}>
          <FormTextField<FormValues>
            name="qty"
            label="Số lượng cần lên đơn"
            required
            transform={digitsOnly}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            rules={{ validate: (v) => (Number(v) >= 1 ? true : 'Số lượng phải từ 1') }}
          />
          <FormTextField<FormValues>
            name="createdDate"
            label="Ngày tạo đơn"
            type="date"
            required
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormTextField<FormValues>
            name="dueDate"
            label="Thời gian cần trả hàng"
            type="date"
            required
            slotProps={{ inputLabel: { shrink: true } }}
            onBlur={() => void form.trigger('dueDate')}
            rules={{
              validate: (value, values) =>
                validateDueDate(value, values.createdDate, Boolean(row)),
            }}
          />
          <FormTextField<FormValues> name="trackingCode" label="Mã sản phẩm" clearable />
        </FormRow>

        <FormTextField<FormValues>
          name="description"
          label="Yêu cầu khác"
          multiline
          minRows={3}
          maxRows={10}
        />
      </FormSection>

      <FormSection title="Khách hàng">
        <FormRow columns={3}>
          <FormTextField<FormValues> name="customerCode" label="Mã của khách" clearable />
          {/* Khách cố định VCB, server tự gán — không để trong form để khỏi lưu theo giá trị cũ. */}
          <TextInput label="Khách hàng" value={row?.customerName?.trim() || CUSTOMER_NAME} readOnly />
          <FormTextField<FormValues> name="placedBy" label="Người đặt đơn" required clearable />
        </FormRow>
      </FormSection>

      <FormSection>
        <Controller
          control={form.control}
          name="detailImages"
          render={({ field }) => (
            <ImageUploadField
              label="Ảnh chi tiết"
              kind="DETAIL"
              value={field.value}
              onChange={field.onChange}
              onUploadingChange={onDetailUploading}
            />
          )}
        />
      </FormSection>
    </CrudDialogShell>
  )
}
