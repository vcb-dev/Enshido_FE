import { useCallback, useEffect, useMemo, useState } from 'react'
import { Divider } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { formatQty } from '../api/inventory'
import {
  listBtpOptionsApi,
  type BtpOption,
  type OrderImage,
  type ProductionOrderDetail,
  type ProductionOrderLookups,
  type ProductionRequestType,
  type ProductionSource,
  type UpsertProductionOrderPayload,
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
import { BtpPicker } from './BtpPicker'
import { REQUEST_TYPES, REQUEST_TYPE_META, SOURCES, SOURCE_HINT, SOURCE_META } from './catalog'
import { FormFreeSoloField, FormMultiFreeSoloField } from './FreeSoloFields'
import { ImageUploadField } from './ImageUploadField'

type FormValues = {
  source: ProductionSource
  btpMaterialId: string
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
  source: 'NVL',
  btpMaterialId: '',
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

/** Ô trên đơn được điền sẵn từ mã BTP. */
type BtpFilledField = 'description' | 'mainMaterial' | 'platingColor' | 'stoneColor' | 'sizeLabel'

const TITLES = { edit: 'Sửa đơn sản xuất', view: 'Đơn sản xuất' }

const digitsOnly = (value: string) => value.replace(/\D/g, '')

function todayYmd() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function ProductionOrderFormDialog({
  open,
  order,
  initialSource = 'NVL',
  lookups,
  saving,
  onClose,
  onExited,
  onSave,
}: {
  open: boolean
  /** `null` = lên đơn mới. */
  order: ProductionOrderDetail | null
  /** Loại đơn chọn từ menu "Lên đơn" — chỉ dùng khi lên đơn mới. */
  initialSource?: ProductionSource
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
  const source = form.watch('source')
  const btpMaterialId = form.watch('btpMaterialId')
  const isBtp = source === 'BTP'
  // Đã giao khâu thì phiếu xuất BTP đã theo hàng đi — không đổi loại đơn / mã BTP nữa.
  const sourceLocked = Boolean(order && order.stages.length > 0)
  // Lên đơn NVL mới thì hàng đầu không còn ô nào — bỏ luôn hàng cho form đỡ hở.
  const showSourceRow = Boolean(order) || isBtp

  const btpOptions = useQuery({
    queryKey: ['btp-options'],
    queryFn: () => listBtpOptionsApi(),
    enabled: open && isBtp,
    staleTime: 30_000,
  })
  const btpItems = useMemo(() => btpOptions.data ?? [], [btpOptions.data])
  const selectedBtp = btpItems.find((item) => item.id === btpMaterialId)
  /** SL tối đa: tồn hiện có, cộng số đơn này đang giữ nếu vẫn là mã cũ. */
  const btpMaxQty = selectedBtp
    ? Number(selectedBtp.qty) + (order?.btp?.id === selectedBtp.id ? order.qty : 0)
    : order?.btp?.id === btpMaterialId
      ? (order?.qty ?? null)
      : null

  useEffect(() => {
    if (!open) return
    form.reset(
      order
        ? {
            source: order.source,
            btpMaterialId: order.btp?.id ?? '',
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
        : { ...EMPTY, source: initialSource, receivedDate: todayYmd() },
    )
  }, [open, order, initialSource, form])

  const userOptions = (lookups?.users ?? []).map((user) => ({
    id: user.id,
    name: user.fullName,
    secondary: user.username,
  }))

  /**
   * Chọn mã BTP: chất liệu, màu xi, màu đá, size và ảnh sản phẩm lấy đúng theo mã mới.
   * Mô tả chỉ thay khi còn trống hoặc vẫn là tên mã cũ, để không mất yêu cầu đã gõ.
   * Ảnh người dùng tự thêm được giữ, ảnh của mã cũ được thay bằng ảnh của mã mới.
   */
  function applyBtp(next: BtpOption | undefined, previous: BtpOption | undefined) {
    const set = (field: BtpFilledField, value: string | null | undefined) =>
      form.setValue(field, value ?? '', {
        shouldDirty: true,
        shouldValidate: Boolean(form.formState.errors[field]),
      })
    set('mainMaterial', next?.bodyMetal)
    set('platingColor', next?.platingColor)
    set('stoneColor', next?.stoneColor)
    set('sizeLabel', next?.sizeLabel)
    const description = form.getValues('description').trim()
    if (!description || description === previous?.name) set('description', next?.name)

    const oldIds = new Set(previous?.images.map((image) => image.publicId) ?? [])
    const kept = form.getValues('productImages').filter((image) => !oldIds.has(image.publicId))
    const added = (next?.images ?? [])
      .filter((image) => !kept.some((item) => item.publicId === image.publicId))
      .map((image) => ({ ...image, kind: 'PRODUCT' as const }))
    form.setValue('productImages', [...kept, ...added], { shouldDirty: true })
  }

  function submit(values: FormValues) {
    if (!values.requestType) return
    const btp = values.source === 'BTP'
    onSave({
      source: values.source,
      btpMaterialId: btp ? values.btpMaterialId || null : null,
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
      model3dCode: btp ? '' : values.model3dCode.trim(),
      model3dUrl: btp ? null : values.model3dUrl.trim() || null,
      parentCode: values.parentCode.trim(),
      images: [...values.detailImages, ...values.productImages],
    })
  }

  const uploading = uploadingDetail || uploadingProduct

  return (
    <CrudDialogShell<FormValues>
      open={open}
      kind={order ? 'edit' : 'create'}
      titles={{ ...TITLES, create: `Lên đơn ${source}` }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitDisabled={uploading}
      maxWidth="lg"
      submitLabel={uploading ? 'Đang upload ảnh…' : order ? 'Lưu' : 'Lên đơn'}
      onClose={onClose}
      onExited={onExited ?? (() => undefined)}
    >
      {/* Lên đơn mới không hỏi lại loại đơn — đã chọn ở menu "Lên đơn" và ghi trên tiêu đề. */}
      {showSourceRow ? (
        <FormRow columns={2} sx={{ mt: 1 }}>
          {order ? (
            <FormSelect<FormValues>
              name="source"
              label="Loại đơn"
              required
              disabled={sourceLocked || Boolean(order.castingSentDate && order.source === 'NVL')}
              options={SOURCES.map((item) => ({ value: item, label: SOURCE_META[item].label }))}
              helperText={sourceLocked ? 'Đơn đã giao khâu, không đổi loại đơn được' : SOURCE_HINT[source]}
            />
        ) : null}
        {isBtp ? (
          <Controller
            control={form.control}
            name="btpMaterialId"
            rules={{
              validate: (value, values) => values.source !== 'BTP' || Boolean(value) || 'Chọn mã BTP',
            }}
            render={({ field, fieldState }) => (
              <BtpPicker
                value={field.value}
                options={btpItems}
                current={order?.btp}
                loading={btpOptions.isFetching}
                disabled={sourceLocked}
                autoFocus={!order}
                inputRef={field.ref}
                onBlur={field.onBlur}
                errorText={fieldState.error?.message}
                onChange={(id) => {
                  const previous = btpItems.find((item) => item.id === field.value)
                  field.onChange(id)
                  applyBtp(btpItems.find((item) => item.id === id), previous)
                }}
              />
            )}
          />
        ) : null}
      </FormRow>
      ) : null}

      <FormRow columns={4} sx={showSourceRow ? undefined : { mt: 1 }}>
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
          rules={{
            validate: (value, values) => {
              if (Number(value) < 1) return 'Số lượng phải từ 1'
              if (values.source === 'BTP' && btpMaxQty != null && Number(value) > btpMaxQty) {
                return `Kho BTP chỉ còn ${formatQty(String(btpMaxQty))}`
              }
              return true
            },
          }}
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

      <FormRow columns={isBtp ? 1 : 3}>
        {isBtp ? null : (
          <>
            <FormTextField<FormValues> name="model3dCode" label="Mã 3D (nếu có)" placeholder="3D-2506.0135" />
            <FormTextField<FormValues>
              name="model3dUrl"
              label="Link 3D"
              type="url"
              rules={{
                validate: (value, values) =>
                  values.source === 'BTP' ||
                  !value ||
                  /^https?:\/\//i.test(String(value)) ||
                  'Link phải bắt đầu bằng http(s)://',
              }}
            />
          </>
        )}
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
