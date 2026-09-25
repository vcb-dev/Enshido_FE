import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Divider } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useOperatorName } from '../hooks/useOperatorName'
import {
  listBtpOptionsApi,
  listFinishedProductOptionsApi,
  type BtpOption,
  type FinishedProductOption,
  type OrderImage,
  type ProductionOrderDetail,
  type ProductionOrderLookups,
  type ProductionRequestType,
  type ProductionSource,
  type UpsertProductionOrderPayload,
} from '../api/productionOrders'
import {
  CrudDialogShell,
  FormRow,
  FormSelect,
  FormTextField,
  TextInput,
} from '../components/ui'
import { BtpPicker } from './BtpPicker'
import { CatalogPicker, type CatalogPickerItem } from './CatalogPicker'
import {
  REQUEST_TYPES,
  REQUEST_TYPE_META,
  SOURCES,
  SOURCE_HINT,
  SOURCE_META,
  normalizePlatingColor,
  platingColorOptions,
} from './catalog'
import { FormFreeSoloField } from './FreeSoloFields'
import { ImageUploadField } from './ImageUploadField'
import { finishedGoodsQtyUnitOptions } from '../warehouses/catalog'

type FormValues = {
  source: ProductionSource
  btpMaterialId: string
  finishedProductCode: string
  nvlMaterialId: string
  requestType: ProductionRequestType | ''
  receivedDate: string
  leadTime: string
  closedBy: string
  askedUserId: string
  trackingCode: string
  customerName: string
  editReason: string
  qty: string
  qtyUnit: string
  finishedProductQty: string
  btpQty: string
  debtStatus: string
  description: string
  dueDate: string
  size: string
  sizeLabel: string
  stoneCount: string
  stoneWeight: string
  weight: string
  silverWeight: string
  laserEngraving: string
  otherRequirements: string
  mainMaterial: string
  platingColor: string
  btpCategory: string
  btpName: string
  productKind: string
  stoneColor: string
  nvlMainMaterial: string
  nvlPlatingColor: string
  nvlStoneColor: string
  stoneTypes: string[]
  model3dCode: string
  model3dUrl: string
  parentCode: string
  detailImages: OrderImage[]
  productImages: OrderImage[]
  nvlLines: NvlWorkLine[]
}

type NvlWorkLine = {
  materialId: string
  platingColor: string
  stoneCount: string
  stoneWeight: string
  laserEngraving: string
  otherRequirements: string
}

const EMPTY: FormValues = {
  source: 'NVL',
  btpMaterialId: '',
  finishedProductCode: '',
  nvlMaterialId: '',
  requestType: '',
  receivedDate: '',
  leadTime: '',
  closedBy: '',
  askedUserId: '',
  trackingCode: '',
  customerName: '',
  editReason: '',
  qty: '1',
  qtyUnit: '',
  finishedProductQty: '',
  btpQty: '',
  debtStatus: '',
  description: '',
  dueDate: '',
  size: '',
  sizeLabel: '',
  stoneCount: '',
  stoneWeight: '',
  weight: '',
  silverWeight: '',
  laserEngraving: '',
  otherRequirements: '',
  mainMaterial: '',
  platingColor: '',
  btpCategory: '',
  btpName: '',
  productKind: '',
  stoneColor: '',
  nvlMainMaterial: '',
  nvlPlatingColor: '',
  nvlStoneColor: '',
  stoneTypes: [],
  model3dCode: '',
  model3dUrl: '',
  parentCode: '',
  detailImages: [],
  productImages: [],
  nvlLines: [],
}

const TITLES = { edit: 'Sửa lệnh sản xuất', view: 'Lệnh sản xuất' }

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

function positiveQty(value: unknown) {
  const qty = Number(value == null ? '' : String(value))
  return Number.isFinite(qty) && qty >= 1 ? qty : null
}

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

function finishedPickerOptions(items: FinishedProductOption[]): CatalogPickerItem[] {
  return items.map((item) => ({
    id: item.code,
    label: `${item.code} — ${item.description}`,
    summary: [
      item.mainMaterial,
      item.sizeLabel ? `size ${item.sizeLabel}` : null,
      item.bomLines.length ? `${item.bomLines.length} NVL` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    thumb: item.images.find((image) => image.kind === 'PRODUCT')?.url ?? item.images[0]?.url ?? null,
  }))
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
  const form = useForm<FormValues>({
    defaultValues: EMPTY,
    reValidateMode: 'onSubmit',
  })
  const operatorName = useOperatorName()
  const [uploadingDetail, setUploadingDetail] = useState(false)
  const [uploadingProduct, setUploadingProduct] = useState(false)
  const onDetailUploading = useCallback((busy: boolean) => setUploadingDetail(busy), [])
  const onProductUploading = useCallback((busy: boolean) => setUploadingProduct(busy), [])
  const source = useWatch({ control: form.control, name: 'source' })
  const finishedProductCode = useWatch({ control: form.control, name: 'finishedProductCode' })
  const qtyUnit = useWatch({ control: form.control, name: 'qtyUnit' })
  const platingColor = useWatch({ control: form.control, name: 'platingColor' })
  const isBtp = source === 'BTP'
  const isNvl = !isBtp
  // Đã giao khâu thì không đổi loại đơn / mã sản phẩm nữa.
  const sourceLocked = Boolean(order && order.stages.length > 0)

  const btpOptions = useQuery({
    queryKey: ['btp-options'],
    queryFn: () => listBtpOptionsApi(),
    enabled: open && (isBtp || isNvl),
    staleTime: 60_000,
  })
  const finishedProducts = useQuery({
    queryKey: ['finished-product-options'],
    queryFn: () => listFinishedProductOptionsApi(),
    enabled: open,
    staleTime: 60_000,
  })
  const btpItems = useMemo(() => btpOptions.data ?? [], [btpOptions.data])
  const finishedItems = useMemo(() => {
    const items = finishedProducts.data ?? []
    const code = order?.sourceOrderCode
    if (!code || items.some((item) => item.code === code)) return items
    return [
      {
        code,
        description: order.description,
        requestType: order.requestType,
        qty: order.qty,
        size: order.size,
        sizeLabel: order.sizeLabel,
        mainMaterial: order.mainMaterial,
        platingColor: order.platingColor,
        stoneColor: order.stoneColor,
        stoneTypes: order.stoneTypes,
        stoneCount: order.stoneCount,
        stoneWeight: order.stoneWeight,
        weight: order.weight,
        laserEngraving: order.laserEngraving,
        otherRequirements: order.otherRequirements,
        remainingQty: 0,
        qtyUnit: order.qtyUnit ?? null,
        images: (order.images ?? []).map((image) => ({
          kind: image.kind,
          url: image.url,
          publicId: image.publicId,
          width: image.width ?? null,
          height: image.height ?? null,
        })),
        bomLines: [],
      } satisfies FinishedProductOption,
      ...items,
    ]
  }, [finishedProducts.data, order])
  const finishedPickerItems = useMemo(() => finishedPickerOptions(finishedItems), [finishedItems])
  const selectedFinished = finishedItems.find((item) => item.code === finishedProductCode)

  // Nạp form một lần mỗi lần mở. Trang chi tiết đơn tự làm mới định kỳ (thợ nhận phiếu ở máy
  // khác…) — nạp lại theo `order` là xoá sạch những gì người dùng đang sửa dở.
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
            btpMaterialId: order.btp?.id ?? '',
            finishedProductCode: order.source === 'BTP' ? (order.sourceOrderCode ?? '') : '',
            nvlMaterialId: '',
            requestType: order.requestType,
            receivedDate: order.receivedDate,
            leadTime: order.leadTime ?? '',
            closedBy: order.closedBy,
            askedUserId: order.askedUserId ?? '',
            trackingCode: order.trackingCode ?? '',
            customerName: order.customerName ?? '',
            editReason: '',
            qty: String(order.qty),
            qtyUnit: order.qtyUnit ?? '',
            finishedProductQty:
              order.finishedProductQty != null
                ? String(order.finishedProductQty)
                : order.source === 'BTP'
                  ? String(order.qty)
                  : '',
            btpQty:
              order.source === 'BTP'
                ? String(order.finishedProductQty ?? order.qty)
                : '',
            debtStatus: order.debtStatus ?? '',
            description: order.description,
            dueDate: order.dueDate ?? '',
            size: order.size ?? '',
            sizeLabel: order.sizeLabel ?? '',
            stoneCount: order.stoneCount != null ? String(order.stoneCount) : '',
            stoneWeight: order.stoneWeight ?? '',
            weight: order.weight ?? '',
            silverWeight: order.silverWeight ?? '',
            laserEngraving: order.laserEngraving ?? '',
            otherRequirements: order.otherRequirements ?? '',
            mainMaterial: order.mainMaterial ?? '',
            platingColor: normalizePlatingColor(order.platingColor),
            btpCategory: order.btpCategory ?? '',
            btpName: order.btpName ?? order.btp?.name ?? '',
            productKind: order.productKind ?? '',
            stoneColor: order.stoneColor ?? '',
            stoneTypes: order.stoneTypes,
            model3dCode: order.model3dCode ?? '',
            model3dUrl: order.model3dUrl ?? '',
            parentCode: order.parentCode ?? '',
            detailImages: order.images.filter((image) => image.kind === 'DETAIL'),
            productImages: order.images.filter((image) => image.kind === 'PRODUCT'),
            nvlLines: (order.nvlLines ?? []).map((line) => ({
              materialId: line.materialId,
              platingColor: normalizePlatingColor(line.platingColor),
              stoneCount: line.qty != null ? String(line.qty) : '',
              stoneWeight: line.stoneWeight ?? '',
              laserEngraving: line.laserEngraving ?? '',
              otherRequirements: line.otherRequirements ?? '',
            })),
          }
        : {
            ...EMPTY,
            source: initialSource,
            receivedDate: todayYmd(),
            closedBy: operatorName,
            qty: '',
            qtyUnit: '',
            finishedProductQty: '',
            btpQty: '',
          },
    )
  }, [open, order, initialSource, operatorName, form])

  useEffect(() => {
    if (!open || !order || (order.source !== 'NVL' && order.source !== 'BTP')) return
    if (form.getValues('btpMaterialId')) return
    const sku = order.trackingCode?.trim()
    if (!sku) return
    const match = btpItems.find((item) => item.sku === sku)
    if (match) form.setValue('btpMaterialId', match.id, { shouldDirty: false })
  }, [open, order, btpItems, form])

  function replaceKindImages(
    field: 'detailImages' | 'productImages',
    previousIds: string[],
    next: OrderImage[],
  ) {
    const oldIds = new Set(previousIds)
    const kept = form.getValues(field).filter((image) => !oldIds.has(image.publicId))
    const added = next.filter((image) => !kept.some((item) => item.publicId === image.publicId))
    form.setValue(field, [...kept, ...added], { shouldDirty: true })
  }

  function applyBtpCatalog(next: BtpOption | undefined, previous: BtpOption | undefined) {
    form.setValue('btpName', next?.name ?? '', { shouldDirty: true })
    form.setValue('btpCategory', next?.category ?? '', { shouldDirty: true })
    form.setValue('mainMaterial', next?.bodyMetal ?? '', { shouldDirty: true })
    form.setValue('productKind', next?.productKind ?? '', { shouldDirty: true })
    form.setValue('platingColor', normalizePlatingColor(next?.platingColor), { shouldDirty: true })
    form.setValue('stoneColor', next?.stoneColor ?? '', { shouldDirty: true })
    replaceKindImages(
      'productImages',
      [...(previous?.images ?? []), ...(next?.images ?? [])].map((image) => image.publicId),
      [],
    )
  }

  /** Đơn BTP: thành phẩm chỉ điền size / đơn vị — BTP và NVL người dùng chọn tay. */
  function applyBtpFinishedProduct(next: FinishedProductOption | undefined) {
    form.setValue('sizeLabel', next?.sizeLabel ?? '', { shouldDirty: true })
    form.setValue('qtyUnit', next?.qtyUnit ?? '', { shouldDirty: true })
    form.setValue(
      'weight',
      next?.weight || next?.bomLines.find((line) => line.weight)?.weight || '',
      { shouldDirty: true },
    )
  }

  function submit(values: FormValues) {
    if (!values.requestType) return
    const btp = values.source === 'BTP'
    const nvl = values.source === 'NVL'
    const btpProduct =
      nvl || btp ? btpItems.find((item) => item.id === values.btpMaterialId) : undefined
    const trackingCode =
      nvl || btp
        ? (btpProduct?.sku?.trim() || values.trackingCode.trim())
        : values.trackingCode.trim()
    return onSave({
      source: values.source,
      btpMaterialId: btp || nvl ? values.btpMaterialId || null : null,
      nvlMaterialId: null,
      finishedProductCode: btp ? values.finishedProductCode || null : null,
      requestType: values.requestType,
      receivedDate: values.receivedDate,
      closedBy: values.closedBy.trim() || operatorName,
      description: values.description.trim(),
      qty: Number(values.finishedProductQty) || Number(values.qty) || 1,
      qtyUnit: values.qtyUnit || null,
      finishedProductQty: values.finishedProductQty ? Number(values.finishedProductQty) : null,
      btpQty: null,
      leadTime: '',
      trackingCode,
      customerName: values.customerName.trim(),
      editReason: values.editReason?.trim() || undefined,
      askedUserId: null,
      debtStatus: '',
      dueDate: values.dueDate,
      size: nvl ? values.sizeLabel.trim() : values.size.trim(),
      sizeLabel: values.sizeLabel.trim(),
      stoneCount: null,
      stoneWeight: null,
      weight: null,
      silverWeight: nvl || btp ? (order?.silverWeight ?? null) : values.silverWeight || null,
      laserEngraving: values.laserEngraving.trim(),
      otherRequirements: values.otherRequirements.trim(),
      mainMaterial: values.mainMaterial.trim(),
      platingColor: normalizePlatingColor(values.platingColor),
      btpCategory: values.btpCategory.trim(),
      btpName: values.btpName.trim(),
      productKind: values.productKind.trim(),
      stoneColor: values.stoneColor.trim(),
      stoneTypes: [],
      model3dCode: nvl ? values.model3dCode.trim() : '',
      model3dUrl: btp ? null : values.model3dUrl.trim() || null,
      parentCode: values.parentCode.trim(),
      images: [...values.detailImages, ...values.productImages],
      nvlLines: undefined,
    })
  }

  const uploading = uploadingDetail || uploadingProduct

  return (
    <CrudDialogShell<FormValues>
      open={open}
      kind={order ? 'edit' : 'create'}
      titles={{ ...TITLES, create: source === 'BTP' ? 'Lên đơn BTP' : 'Lên đơn mới' }}
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

      {isNvl ? (
        <>
          <Box sx={{ ...SECTION_SX, mt: order ? undefined : 1 }}>
            <FormTextField<FormValues>
              name="model3dCode"
              label="Mã sản xuất"
              required
              autoFocus={!order}
              rules={{
                validate: (value, values) =>
                  values.source !== 'NVL' || Boolean(String(value ?? '').trim()) || 'Nhập mã sản xuất',
              }}
            />
            <FormTextField<FormValues> name="btpName" label="Tên thành phẩm" />
            <FormRow columns={3}>
              <FormTextField<FormValues> name="sizeLabel" label="Size" />
              <FormSelect<FormValues>
                name="qtyUnit"
                label="Đơn vị thành phẩm"
                required
                placeholder="Chọn đơn vị…"
                options={finishedGoodsQtyUnitOptions(qtyUnit)}
              />
              <FormTextField<FormValues>
                name="finishedProductQty"
                label="Số lượng thành phẩm cần lên đơn"
                required
                transform={digitsOnly}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                rules={{
                  validate: (value) => {
                    const qty = positiveQty(value)
                    return qty != null ? true : 'Số lượng phải từ 1'
                  },
                }}
              />
            </FormRow>
            <FormRow columns={2}>
              <FormTextField<FormValues> name="stoneColor" label="Màu đá" />
              <FormSelect<FormValues>
                name="platingColor"
                label="Màu xi"
                placeholder="Chọn màu xi…"
                clearable
                options={platingColorOptions(platingColor)}
              />
            </FormRow>
            <FormRow columns={2}>
              <FormTextField<FormValues> name="laserEngraving" label="Nội dung khắc laser" multiline maxRows={4} />
              <FormTextField<FormValues> name="otherRequirements" label="Yêu cầu khác" multiline maxRows={4} />
            </FormRow>
          </Box>

          <Box sx={SECTION_SX}>
            <FormRow columns={3}>
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
                rules={{
                  validate: (value, values) => validateDueDate(value, values.receivedDate, Boolean(order)),
                }}
              />
            </FormRow>

            <FormRow columns={order ? 3 : 2}>
              <FormTextField<FormValues> name="closedBy" label="Người lên đơn" readOnly />
              <Controller
                control={form.control}
                name="btpMaterialId"
                rules={{
                  validate: (value, values) =>
                    values.source !== 'NVL' || Boolean(value) || 'Chọn mã sản phẩm',
                }}
                render={({ field, fieldState }) => (
                  <BtpPicker
                    value={field.value}
                    options={btpItems}
                    current={order?.btp ?? undefined}
                    loading={btpOptions.isFetching}
                    label="Mã sản phẩm"
                    errorText={fieldState.error?.message}
                    inputRef={field.ref}
                    onBlur={field.onBlur}
                    onChange={(id) => {
                      field.onChange(id)
                      const sku = btpItems.find((item) => item.id === id)?.sku?.trim()
                      if (sku) form.setValue('trackingCode', sku, { shouldDirty: true })
                    }}
                  />
                )}
              />
              {order ? (
                <TextInput
                  label="Đã trả"
                  value={String(order.returnedQty ?? 0)}
                  readOnly
                  helperText="Tự tính từ phiếu xuất hàng"
                />
              ) : null}
            </FormRow>

            <FormFreeSoloField<FormValues>
              name="customerName"
              label="Khách hàng"
              options={lookups?.customers ?? []}
            />

            <FormTextField<FormValues>
              name="description"
              label="Mô tả sản phẩm"
              multiline
              minRows={2}
              maxRows={8}
            />
          </Box>
        </>
      ) : (
        <>
          <Box sx={{ ...SECTION_SX, mt: order ? undefined : 1 }}>
            <Controller
              control={form.control}
              name="finishedProductCode"
              rules={{
                validate: (value, values) =>
                  values.source !== 'BTP' || Boolean(order) || Boolean(value) || 'Chọn mã thành phẩm',
              }}
              render={({ field, fieldState }) => (
                <CatalogPicker
                  value={field.value}
                  options={finishedPickerItems}
                  label="Mã thành phẩm (kho thành phẩm)"
                  placeholder="Chọn mã trong kho thành phẩm…"
                  loadingText="Đang tải kho thành phẩm…"
                  noOptionsText="Kho thành phẩm chưa có mã nào"
                  required={!order}
                  loading={finishedProducts.isFetching}
                  autoFocus={!order}
                  errorText={fieldState.error?.message}
                  inputRef={field.ref}
                  onBlur={field.onBlur}
                  onChange={(code) => {
                    field.onChange(code)
                    applyBtpFinishedProduct(finishedItems.find((item) => item.code === code))
                  }}
                />
              )}
            />
            <FormRow columns={3}>
              <FormTextField<FormValues> name="sizeLabel" label="Size" readOnly />
              <FormSelect<FormValues>
                name="qtyUnit"
                label="Đơn vị"
                required
                placeholder="Chọn đơn vị…"
                options={finishedGoodsQtyUnitOptions(qtyUnit || selectedFinished?.qtyUnit)}
              />
              <FormTextField<FormValues>
                name="finishedProductQty"
                label="Số lượng thành phẩm cần lên đơn"
                required
                transform={digitsOnly}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                rules={{
                  validate: (value) => {
                    if (order && Number(value) < order.subTicketTotals.qty) {
                      return `Đã chia ${order.subTicketTotals.qty} sp cho phiếu con`
                    }
                    const qty = positiveQty(value)
                    if (qty == null) return 'Số lượng phải từ 1'
                    return true
                  },
                }}
              />
            </FormRow>
            <FormRow columns={2}>
              <FormTextField<FormValues> name="stoneColor" label="Màu đá" />
              <FormSelect<FormValues>
                name="platingColor"
                label="Màu xi"
                placeholder="Chọn màu xi…"
                clearable
                options={platingColorOptions(platingColor)}
              />
            </FormRow>
            <FormRow columns={2}>
              <FormTextField<FormValues> name="laserEngraving" label="Nội dung khắc laser" multiline maxRows={4} />
              <FormTextField<FormValues> name="otherRequirements" label="Yêu cầu khác" multiline maxRows={4} />
            </FormRow>
          </Box>

          <Box sx={SECTION_SX}>
            <FormRow columns={3}>
              <FormSelect<FormValues>
                name="requestType"
                label="Yêu cầu làm hàng"
                required
                clearable
                options={REQUEST_TYPES.map((type) => ({ value: type, label: REQUEST_TYPE_META[type].label }))}
              />
              <FormTextField<FormValues>
                name="receivedDate"
                label="Ngày đặt đơn"
                type="date"
                required
                clearable
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <FormTextField<FormValues>
                name="dueDate"
                label="Ngày cần trả"
                type="date"
                required
                clearable
                slotProps={{ inputLabel: { shrink: true } }}
                onBlur={() => void form.trigger('dueDate')}
                rules={{
                  validate: (value, values) => validateDueDate(value, values.receivedDate, Boolean(order)),
                }}
              />
            </FormRow>

            <FormRow columns={order ? 3 : 2}>
              <FormTextField<FormValues> name="closedBy" label="Người lên đơn" readOnly />
              <Controller
                control={form.control}
                name="btpMaterialId"
                rules={{
                  validate: (value, values) =>
                    values.source !== 'BTP' || Boolean(value) || 'Chọn mã sản phẩm',
                }}
                render={({ field, fieldState }) => (
                  <BtpPicker
                    value={field.value}
                    options={btpItems}
                    current={order?.btp ?? undefined}
                    loading={btpOptions.isFetching}
                    disabled={sourceLocked}
                    label="Mã sản phẩm"
                    errorText={fieldState.error?.message}
                    inputRef={field.ref}
                    onBlur={field.onBlur}
                    onChange={(id) => {
                      const previous = btpItems.find((item) => item.id === field.value)
                      field.onChange(id)
                      applyBtpCatalog(
                        btpItems.find((item) => item.id === id),
                        previous,
                      )
                      const sku = btpItems.find((item) => item.id === id)?.sku?.trim()
                      if (sku) form.setValue('trackingCode', sku, { shouldDirty: true })
                    }}
                  />
                )}
              />
              {order ? (
                <TextInput
                  label="Đã trả"
                  value={String(order.returnedQty ?? 0)}
                  readOnly
                  helperText="Tự tính từ phiếu xuất hàng"
                />
              ) : null}
            </FormRow>

            <FormFreeSoloField<FormValues>
              name="customerName"
              label="Khách hàng"
              options={lookups?.customers ?? []}
            />

            <FormTextField<FormValues>
              name="description"
              label="Mô tả sản phẩm"
              multiline
              minRows={2}
              maxRows={8}
              clearable
            />
          </Box>
        </>
      )}

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
