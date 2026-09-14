import { useCallback, useEffect, useState } from 'react'
import { Divider } from '@mui/material'
import { Controller, useForm } from 'react-hook-form'
import type {
  OrderImage,
  ProductionOrderDetail,
  ProductionOrderLookups,
  ProductionRequestType,
  UpsertProductionOrderPayload,
} from '../api/productionOrders'
import {
  CrudDialogShell,
  FormQtyField,
  FormRow,
  FormSearchSelect,
  FormSelect,
  FormTextField,
  TextInput,
} from '../components/ui'
import { REQUEST_TYPES, REQUEST_TYPE_META } from './catalog'
import { FormFreeSoloField, FormMultiFreeSoloField } from './FreeSoloFields'
import { ImageUploadField } from './ImageUploadField'

type FormValues = {
  requestType: ProductionRequestType | ''
  receivedDate: string
  leadTime: string
  closedBy: string
  askedUserId: string
  trackingCode: string
  qty: string
  debtStatus: string
  description: string
  dueDate: string
  size: string
  sizeLabel: string
  stoneCount: string
  stoneWeight: string
  laserEngraving: string
  otherRequirements: string
  mainMaterial: string
  platingColor: string
  stoneColor: string
  stoneTypes: string[]
  model3dCode: string
  model3dUrl: string
  parentCode: string
  detailImages: OrderImage[]
  productImages: OrderImage[]
}

const EMPTY: FormValues = {
  requestType: '',
  receivedDate: '',
  leadTime: '',
  closedBy: '',
  askedUserId: '',
  trackingCode: '',
  qty: '1',
  debtStatus: '',
  description: '',
  dueDate: '',
  size: '',
  sizeLabel: '',
  stoneCount: '',
  stoneWeight: '',
  laserEngraving: '',
  otherRequirements: '',
  mainMaterial: '',
  platingColor: '',
  stoneColor: '',
  stoneTypes: [],
  model3dCode: '',
  model3dUrl: '',
  parentCode: '',
  detailImages: [],
  productImages: [],
}

const TITLES = { create: 'Lên đơn sản xuất', edit: 'Sửa đơn sản xuất', view: 'Đơn sản xuất' }

const digitsOnly = (value: string) => value.replace(/\D/g, '')

function todayYmd() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function ProductionOrderFormDialog({
  open,
  order,
  lookups,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  /** `null` = lên đơn mới. */
  order: ProductionOrderDetail | null
  lookups: ProductionOrderLookups | undefined
  saving: boolean
  onClose: () => void
  onExited?: () => void
  onSave: (payload: UpsertProductionOrderPayload) => void
}) {
  const form = useForm<FormValues>({ defaultValues: EMPTY })
  const [uploadingDetail, setUploadingDetail] = useState(false)
  const [uploadingProduct, setUploadingProduct] = useState(false)
  const onDetailUploading = useCallback((busy: boolean) => setUploadingDetail(busy), [])
  const onProductUploading = useCallback((busy: boolean) => setUploadingProduct(busy), [])

  useEffect(() => {
    if (!open) return
    form.reset(
      order
        ? {
            requestType: order.requestType,
            receivedDate: order.receivedDate,
            leadTime: order.leadTime ?? '',
            closedBy: order.closedBy,
            askedUserId: order.askedUserId ?? '',
            trackingCode: order.trackingCode ?? '',
            qty: String(order.qty),
            debtStatus: order.debtStatus ?? '',
            description: order.description,
            dueDate: order.dueDate ?? '',
            size: order.size ?? '',
            sizeLabel: order.sizeLabel ?? '',
            stoneCount: order.stoneCount != null ? String(order.stoneCount) : '',
            stoneWeight: order.stoneWeight ?? '',
            laserEngraving: order.laserEngraving ?? '',
            otherRequirements: order.otherRequirements ?? '',
            mainMaterial: order.mainMaterial ?? '',
            platingColor: order.platingColor ?? '',
            stoneColor: order.stoneColor ?? '',
            stoneTypes: order.stoneTypes,
            model3dCode: order.model3dCode ?? '',
            model3dUrl: order.model3dUrl ?? '',
            parentCode: order.parentCode ?? '',
            detailImages: order.images.filter((image) => image.kind === 'DETAIL'),
            productImages: order.images.filter((image) => image.kind === 'PRODUCT'),
          }
        : { ...EMPTY, receivedDate: todayYmd() },
    )
  }, [open, order, form])

  const userOptions = (lookups?.users ?? []).map((user) => ({
    id: user.id,
    name: user.fullName,
    secondary: user.username,
  }))

  function submit(values: FormValues) {
    if (!values.requestType) return
    onSave({
      requestType: values.requestType,
      receivedDate: values.receivedDate,
      closedBy: values.closedBy.trim(),
      description: values.description.trim(),
      qty: Number(values.qty) || 1,
      leadTime: values.leadTime.trim(),
      trackingCode: values.trackingCode.trim(),
      askedUserId: values.askedUserId || null,
      debtStatus: values.debtStatus.trim(),
      dueDate: values.dueDate || null,
      size: values.size.trim(),
      sizeLabel: values.sizeLabel.trim(),
      stoneCount: values.stoneCount ? Number(values.stoneCount) : null,
      stoneWeight: values.stoneWeight || null,
      laserEngraving: values.laserEngraving.trim(),
      otherRequirements: values.otherRequirements.trim(),
      mainMaterial: values.mainMaterial.trim(),
      platingColor: values.platingColor.trim(),
      stoneColor: values.stoneColor.trim(),
      stoneTypes: values.stoneTypes,
      model3dCode: values.model3dCode.trim(),
      model3dUrl: values.model3dUrl.trim() || null,
      parentCode: values.parentCode.trim(),
      images: [...values.detailImages, ...values.productImages],
    })
  }

  const uploading = uploadingDetail || uploadingProduct

  return (
    <CrudDialogShell<FormValues>
      open={open}
      kind={order ? 'edit' : 'create'}
      titles={TITLES}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitDisabled={uploading}
      maxWidth="lg"
      submitLabel={uploading ? 'Đang upload ảnh…' : order ? 'Lưu' : 'Lên đơn'}
      onClose={onClose}
      onExited={onExited ?? (() => undefined)}
    >
      <FormRow columns={4} sx={{ mt: 1 }}>
        <FormSelect<FormValues>
          name="requestType"
          label="Yêu cầu làm hàng"
          required
          options={REQUEST_TYPES.map((type) => ({ value: type, label: REQUEST_TYPE_META[type].label }))}
        />
        <FormTextField<FormValues>
          name="receivedDate"
          label="Ngày đặt đơn"
          type="date"
          required
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormTextField<FormValues>
          name="dueDate"
          label="Ngày cần trả"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          rules={{
            validate: (value, values) =>
              !value || !values.receivedDate || value >= values.receivedDate || 'Không được trước ngày đặt đơn',
          }}
        />
        <FormFreeSoloField<FormValues>
          name="leadTime"
          label="Thời gian cần hoàn thành"
          options={lookups?.leadTimes ?? []}
        />
      </FormRow>

      <FormRow columns={3}>
        <FormFreeSoloField<FormValues>
          name="closedBy"
          label="Người chốt"
          required
          options={lookups?.closers ?? []}
        />
        <FormSearchSelect<FormValues>
          name="askedUserId"
          label="Người được hỏi"
          options={userOptions}
          allowClear
          displayValue={order?.askedUserName ?? undefined}
          placeholder="Tìm tài khoản…"
        />
        <FormTextField<FormValues> name="trackingCode" label="Mã theo dõi đơn" placeholder="V-9147" />
      </FormRow>

      <FormRow columns={3}>
        <FormTextField<FormValues>
          name="qty"
          label="Số lượng"
          required
          transform={digitsOnly}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          rules={{ validate: (value) => Number(value) >= 1 || 'Số lượng phải từ 1' }}
        />
        <TextInput
          label="Đã trả"
          value={String(order?.returnedQty ?? 0)}
          readOnly
          helperText="Tự tính từ phiếu xuất hàng"
        />
        <FormFreeSoloField<FormValues>
          name="debtStatus"
          label="Công nợ"
          options={lookups?.debtStatuses ?? []}
        />
      </FormRow>

      <FormTextField<FormValues>
        name="description"
        label="Mô tả / Yêu cầu sản phẩm"
        required
        multiline
        minRows={3}
        maxRows={10}
      />

      <FormRow columns={4}>
        <FormTextField<FormValues> name="sizeLabel" label="Size" placeholder="7, US 10…" />
        <FormTextField<FormValues> name="size" label="Kích thước (đường kính, dài…)" />
        <FormTextField<FormValues> name="mainMaterial" label="Chất liệu" placeholder="S925" />
        <FormTextField<FormValues> name="platingColor" label="Màu sắc (xi)" />
      </FormRow>

      <FormRow columns={4}>
        <FormMultiFreeSoloField<FormValues>
          name="stoneTypes"
          label="Loại đá"
          options={lookups?.stoneTypes ?? []}
          placeholder="Chọn hoặc gõ loại đá"
        />
        <FormTextField<FormValues> name="stoneColor" label="Màu đá" />
        <FormTextField<FormValues>
          name="stoneCount"
          label="Số lượng đá (viên)"
          transform={digitsOnly}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
        <FormQtyField<FormValues> name="stoneWeight" label="Trọng lượng đá (g)" />
      </FormRow>

      <FormRow columns={2}>
        <FormTextField<FormValues> name="laserEngraving" label="Nội dung khắc laser" multiline maxRows={4} />
        <FormTextField<FormValues> name="otherRequirements" label="Yêu cầu khác" multiline maxRows={4} />
      </FormRow>

      <FormRow columns={3}>
        <FormTextField<FormValues> name="model3dCode" label="Mã 3D (nếu có)" placeholder="3D-2506.0135" />
        <FormTextField<FormValues>
          name="model3dUrl"
          label="Link 3D"
          type="url"
          rules={{
            validate: (value) =>
              !value || /^https?:\/\//i.test(String(value)) || 'Link phải bắt đầu bằng http(s)://',
          }}
        />
        <FormTextField<FormValues>
          name="parentCode"
          label="Đơn mẹ (mã SX)"
          placeholder="A012"
          transform={(value) => value.toUpperCase()}
        />
      </FormRow>

      <Divider />

      <FormRow columns={2}>
        <Controller
          control={form.control}
          name="detailImages"
          render={({ field }) => (
            <ImageUploadField
              label="Ảnh chi tiết đơn hàng"
              kind="DETAIL"
              value={field.value}
              onChange={field.onChange}
              onUploadingChange={onDetailUploading}
            />
          )}
        />
        <Controller
          control={form.control}
          name="productImages"
          render={({ field }) => (
            <ImageUploadField
              label="Ảnh sản phẩm"
              kind="PRODUCT"
              value={field.value}
              onChange={field.onChange}
              onUploadingChange={onProductUploading}
            />
          )}
        />
      </FormRow>
    </CrudDialogShell>
  )
}
