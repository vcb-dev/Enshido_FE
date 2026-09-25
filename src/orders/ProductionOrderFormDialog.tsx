import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Divider, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { getInventoryLookupsApi } from '../api/inventory'
import { useOperatorName } from '../hooks/useOperatorName'
import type {
  OrderImage,
  ProductionOrderDetail,
  ProductionOrderLookups,
  ProductionRequestType,
  ProductionSource,
  UpsertProductionOrderPayload,
} from '../api/productionOrders'
import { CrudDialogShell, FormQtyField, FormRow, FormSelect, FormTextField, TextInput } from '../components/ui'
import {
  REQUEST_TYPES,
  REQUEST_TYPE_META,
  SOURCES,
  SOURCE_HINT,
  SOURCE_META,
  normalizePlatingColor,
  platingColorOptions,
} from './catalog'
import { FormFreeSoloField, FormMultiFreeSoloField } from './FreeSoloFields'
import { ImageUploadField } from './ImageUploadField'
import { finishedGoodsQtyUnitOptions } from '../warehouses/catalog'

/**
 * Lên đơn chỉ ghi thông tin cơ bản: không chọn mã kho, không xuất kho. NVL (phôi BTP, bạc, đá…)
 * xuất ở từng bước giao khâu — xem HandoverMaterialsField.
 */
type FormValues = {
  source: ProductionSource
  requestType: ProductionRequestType | ''
  receivedDate: string
  dueDate: string
  closedBy: string
  trackingCode: string
  customerName: string
  editReason: string
  qty: string
  qtyUnit: string
  btpName: string
  description: string
  size: string
  sizeLabel: string
  mainMaterial: string
  platingColor: string
  stoneTypes: string[]
  stoneColor: string
  stoneCount: string
  weight: string
  laserEngraving: string
  otherRequirements: string
  model3dCode: string
  model3dUrl: string
  detailImages: OrderImage[]
  productImages: OrderImage[]
}

const EMPTY: FormValues = {
  source: 'NVL',
  requestType: '',
  receivedDate: '',
  dueDate: '',
  closedBy: '',
  trackingCode: '',
  customerName: '',
  editReason: '',
  qty: '',
  qtyUnit: '',
  btpName: '',
  description: '',
  size: '',
  sizeLabel: '',
  mainMaterial: '',
  platingColor: '',
  stoneTypes: [],
  stoneColor: '',
  stoneCount: '',
  weight: '',
  laserEngraving: '',
  otherRequirements: '',
  model3dCode: '',
  model3dUrl: '',
  detailImages: [],
  productImages: [],
}

const TITLES = { edit: 'Sửa đơn sản xuất', view: 'Đơn sản xuất' }

const SECTION_SX = {
  p: 1.75,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,
  border: '2px solid #8b98a4',
  borderRadius: 1.5,
  mb: 1.5,
} as const

const digitsOnly = (value: string) => value.replace(/\D/g, '')

function todayYmd() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function validateDueDate(value: unknown, receivedDate: string, allowPast: boolean) {
  const due = String(value ?? '')
  if (!due) return true
  if (!allowPast && due < todayYmd()) return 'Không được chọn ngày trong quá khứ'
  if (receivedDate && due < receivedDate) return 'Không được trước ngày đặt đơn'
  return true
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
      {children}
    </Typography>
  )
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
  /** Loại đơn theo tab Đơn mới / Đơn BTP — chỉ dùng khi lên đơn. */
  initialSource?: ProductionSource
  lookups: ProductionOrderLookups | undefined
  saving: boolean
  onClose: () => void
  onExited?: () => void
  onSave: (payload: UpsertProductionOrderPayload) => void | Promise<unknown>
}) {
  const form = useForm<FormValues>({ defaultValues: EMPTY, reValidateMode: 'onSubmit' })
  const operatorName = useOperatorName()
  const [uploadingDetail, setUploadingDetail] = useState(false)
  const [uploadingProduct, setUploadingProduct] = useState(false)
  const onDetailUploading = useCallback((busy: boolean) => setUploadingDetail(busy), [])
  const onProductUploading = useCallback((busy: boolean) => setUploadingProduct(busy), [])
  const source = useWatch({ control: form.control, name: 'source' })
  const platingColor = useWatch({ control: form.control, name: 'platingColor' })
  const qtyUnit = useWatch({ control: form.control, name: 'qtyUnit' })
  const isBtp = source === 'BTP'
  // Đã giao khâu thì luồng đơn đã chạy — không đổi loại đơn nữa (khớp BE).
  const sourceLocked = Boolean(order && order.stages.length > 0)
  const castingLocked = Boolean(order?.castingSentDate && order.source === 'NVL')

  const inventoryLookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    enabled: open,
    staleTime: 5 * 60_000,
  })
  const materialOptions = useMemo(
    () => (inventoryLookups.data?.bodyMetals ?? []).map((item) => item.name),
    [inventoryLookups.data?.bodyMetals],
  )
  const stoneColorOptions = useMemo(
    () => (inventoryLookups.data?.colors ?? []).map((item) => item.name),
    [inventoryLookups.data?.colors],
  )

  // Nạp form một lần mỗi lần mở. Trang chi tiết đơn tự làm mới định kỳ — nạp lại theo `order`
  // là xoá sạch những gì người dùng đang sửa dở.
  const seeded = useRef(false)
  useEffect(() => {
    if (!open) {
      seeded.current = false
      return
    }
    if (seeded.current) return
    seeded.current = true
    form.reset(
      order
        ? {
            source: order.source,
            requestType: order.requestType,
            receivedDate: order.receivedDate,
            dueDate: order.dueDate ?? '',
            closedBy: order.closedBy,
            trackingCode: order.trackingCode ?? '',
            customerName: order.customerName ?? '',
            editReason: '',
            qty: String(order.qty),
            qtyUnit: order.qtyUnit ?? '',
            btpName: order.btpName ?? '',
            description: order.description,
            size: order.size ?? '',
            sizeLabel: order.sizeLabel ?? '',
            mainMaterial: order.mainMaterial ?? '',
            platingColor: normalizePlatingColor(order.platingColor),
            stoneTypes: order.stoneTypes,
            stoneColor: order.stoneColor ?? '',
            stoneCount: order.stoneCount != null ? String(order.stoneCount) : '',
            weight: order.weight ?? '',
            laserEngraving: order.laserEngraving ?? '',
            otherRequirements: order.otherRequirements ?? '',
            model3dCode: order.model3dCode ?? '',
            model3dUrl: order.model3dUrl ?? '',
            detailImages: order.images.filter((image) => image.kind === 'DETAIL'),
            productImages: order.images.filter((image) => image.kind === 'PRODUCT'),
          }
        : {
            ...EMPTY,
            source: initialSource,
            receivedDate: todayYmd(),
            closedBy: operatorName,
          },
    )
  }, [open, order, initialSource, operatorName, form])

  function submit(values: FormValues) {
    if (!values.requestType) return
    const btp = values.source === 'BTP'
    return onSave({
      source: values.source,
      requestType: values.requestType,
      receivedDate: values.receivedDate,
      closedBy: values.closedBy.trim() || operatorName,
      description: values.description.trim(),
      qty: Number(values.qty),
      qtyUnit: values.qtyUnit || null,
      leadTime: order?.leadTime ?? '',
      trackingCode: values.trackingCode.trim(),
      customerName: values.customerName.trim(),
      editReason: values.editReason?.trim() || undefined,
      // Các ô không còn trên form: giữ nguyên giá trị cũ của đơn, không xoá.
      askedUserId: order?.askedUserId ?? null,
      debtStatus: order?.debtStatus ?? '',
      btpCategory: order?.btpCategory ?? '',
      productKind: order?.productKind ?? '',
      stoneWeight: order?.stoneWeight ?? null,
      parentCode: order?.parentCode ?? '',
      dueDate: values.dueDate,
      btpName: values.btpName.trim(),
      size: values.size.trim(),
      sizeLabel: values.sizeLabel.trim(),
      mainMaterial: values.mainMaterial.trim(),
      platingColor: normalizePlatingColor(values.platingColor),
      stoneTypes: values.stoneTypes,
      stoneColor: values.stoneColor.trim(),
      stoneCount: values.stoneCount ? Number(values.stoneCount) : null,
      weight: values.weight || null,
      laserEngraving: values.laserEngraving.trim(),
      otherRequirements: values.otherRequirements.trim(),
      model3dCode: btp ? '' : values.model3dCode.trim(),
      model3dUrl: btp ? null : values.model3dUrl.trim() || null,
      images: [...values.detailImages, ...values.productImages],
    })
  }

  const uploading = uploadingDetail || uploadingProduct

  return (
    <CrudDialogShell<FormValues>
      open={open}
      kind={order ? 'edit' : 'create'}
      titles={{ ...TITLES, create: isBtp ? 'Lên đơn BTP' : 'Lên đơn mới' }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitDisabled={uploading}
      maxWidth="lg"
      submitLabel={uploading ? 'Đang upload ảnh…' : order ? 'Lưu' : 'Lên đơn'}
      onClose={onClose}
      onExited={onExited ?? (() => undefined)}
      editLog={order ? { entityType: 'production_order', entityId: order.id } : undefined}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mt: order ? 0 : 1 }}>
        Lên đơn chỉ ghi thông tin — không xuất kho. Phôi BTP, bạc, đá… người lên đơn chọn và xuất cho thợ ở
        từng bước giao khâu.
      </Typography>

      <Box sx={SECTION_SX}>
        <SectionTitle>Thông tin đơn</SectionTitle>
        <FormRow columns={4}>
          <FormSelect<FormValues>
            name="source"
            label="Loại đơn"
            required
            disabled={sourceLocked || castingLocked}
            options={SOURCES.map((item) => ({ value: item, label: SOURCE_META[item].label }))}
            helperText={
              sourceLocked
                ? 'Đơn đã giao khâu, không đổi loại đơn được'
                : castingLocked
                  ? 'Đơn đã báo Đúc, không chuyển sang Đơn BTP được'
                  : SOURCE_HINT[source]
            }
          />
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
            required
            slotProps={{ inputLabel: { shrink: true } }}
            onBlur={() => void form.trigger('dueDate')}
            rules={{ validate: (value, values) => validateDueDate(value, values.receivedDate, Boolean(order)) }}
          />
        </FormRow>
        <FormRow columns={order ? 4 : 3}>
          <FormTextField<FormValues> name="closedBy" label="Người lên đơn" readOnly />
          <FormTextField<FormValues> name="trackingCode" label="Mã theo dõi đơn" placeholder="V-9147" required />
          <FormFreeSoloField<FormValues> name="customerName" label="Khách hàng" options={lookups?.customers ?? []} />
          {order ? (
            <TextInput
              label="Đã trả"
              value={String(order.returnedQty ?? 0)}
              readOnly
              helperText="Tự tính từ phiếu xuất hàng"
            />
          ) : null}
        </FormRow>
        <FormRow columns={3}>
          <FormTextField<FormValues>
            name="qty"
            label="Số lượng cần làm"
            required
            transform={digitsOnly}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            rules={{ validate: (value) => Number(value) >= 1 || 'Số lượng phải từ 1' }}
          />
          <FormSelect<FormValues>
            name="qtyUnit"
            label="Đơn vị"
            clearable
            options={finishedGoodsQtyUnitOptions(qtyUnit)}
          />
          <FormTextField<FormValues> name="btpName" label="Tên sản phẩm" />
        </FormRow>
        <FormTextField<FormValues> name="description" label="Mô tả sản phẩm" multiline minRows={2} maxRows={8} />
      </Box>

      <Box sx={SECTION_SX}>
        <SectionTitle>Thông tin sản phẩm</SectionTitle>
        <FormRow columns={4}>
          <FormTextField<FormValues> name="sizeLabel" label="Size" />
          <FormTextField<FormValues> name="size" label="Kích thước (đường kính, dài…)" />
          <FormFreeSoloField<FormValues> name="mainMaterial" label="Chất liệu" options={materialOptions} />
          <FormSelect<FormValues>
            name="platingColor"
            label="Màu sắc (xi)"
            placeholder="Chọn màu xi…"
            clearable
            options={platingColorOptions(platingColor)}
          />
        </FormRow>
        <FormRow columns={4}>
          <FormMultiFreeSoloField<FormValues>
            name="stoneTypes"
            label="Loại đá"
            options={lookups?.stoneTypes ?? []}
            placeholder="Chọn hoặc gõ loại đá…"
          />
          <FormFreeSoloField<FormValues> name="stoneColor" label="Màu đá" options={stoneColorOptions} />
          <FormTextField<FormValues>
            name="stoneCount"
            label="Số lượng đá (viên)"
            transform={digitsOnly}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
          <FormQtyField<FormValues> name="weight" label="Trọng lượng (g)" />
        </FormRow>
        <FormRow columns={2}>
          <FormTextField<FormValues> name="laserEngraving" label="Nội dung khắc laser" multiline maxRows={4} />
          <FormTextField<FormValues> name="otherRequirements" label="Yêu cầu khác" multiline maxRows={4} />
        </FormRow>
        {isBtp ? null : (
          <FormRow columns={2}>
            <FormTextField<FormValues> name="model3dCode" label="Mã 3D" />
            <FormTextField<FormValues> name="model3dUrl" label="Link file 3D" placeholder="https://…" />
          </FormRow>
        )}
      </Box>

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
