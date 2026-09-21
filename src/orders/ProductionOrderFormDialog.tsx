import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Divider } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { formatQty, getInventoryLookupsApi } from '../api/inventory'
import { listCatalogsApi } from '../api/catalogs'
import { useOperatorName } from '../hooks/useOperatorName'
import {
  listBtpOptionsApi,
  listFinishedProductOptionsApi,
  listNvlOptionsApi,
  type BtpOption,
  type FinishedProductOption,
  type NvlOption,
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
import { CatalogPicker, type CatalogPickerItem } from './CatalogPicker'
import {
  REQUEST_TYPES,
  REQUEST_TYPE_META,
  SOURCES,
  SOURCE_HINT,
  SOURCE_META,
  PLATING_COLORS,
  normalizePlatingColor,
  platingColorOptions,
} from './catalog'
import { FormFreeSoloField, FormMultiFreeSoloField } from './FreeSoloFields'
import { ImageUploadField } from './ImageUploadField'
import { catalogChildren, withFallback } from '../warehouses/catalog'

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
  qty: string
  qtyUnit: string
  finishedProductQty: string
  debtStatus: string
  description: string
  dueDate: string
  size: string
  sizeLabel: string
  stoneCount: string
  stoneWeight: string
  silverWeight: string
  laserEngraving: string
  otherRequirements: string
  mainMaterial: string
  platingColor: string
  btpCategory: string
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
  qty: '1',
  qtyUnit: '',
  finishedProductQty: '',
  debtStatus: '',
  description: '',
  dueDate: '',
  size: '',
  sizeLabel: '',
  stoneCount: '',
  stoneWeight: '',
  silverWeight: '',
  laserEngraving: '',
  otherRequirements: '',
  mainMaterial: '',
  platingColor: '',
  btpCategory: '',
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

function asProductImages(
  images: Array<{
    url: string
    publicId: string
    width?: number | null
    height?: number | null
    kind?: OrderImage['kind']
  }>,
): OrderImage[] {
  const preferred = images.some((image) => image.kind === 'PRODUCT')
    ? images.filter((image) => image.kind === 'PRODUCT')
    : images
  return preferred.map((image) => ({
    kind: 'PRODUCT',
    url: image.url,
    publicId: image.publicId,
    width: image.width ?? null,
    height: image.height ?? null,
  }))
}

// `rules.validate` của react-hook-form đưa xuống giá trị kiểu hợp của cả form nên nhận unknown.
function qtyOverStock(value: unknown, max: number | null) {
  const raw = value == null ? '' : String(value)
  const qty = Number(raw)
  if (!raw || qty < 1) return 'Số lượng phải từ 1'
  if (max != null && qty > max) return 'Vượt quá số lượng tồn'
  return true
}

function todayYmd() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function nameOptions(items: Array<{ name: string }> | undefined, current?: string) {
  const names = Array.from(new Set((items ?? []).map((item) => item.name.trim()).filter(Boolean)))
  const extra = current?.trim()
  if (extra && !names.includes(extra)) names.push(extra)
  return names.map((name) => ({ id: name, name }))
}

function nvlPickerOptions(items: NvlOption[]): CatalogPickerItem[] {
  return items.map((item) => ({
    id: item.id,
    label: item.sku ? `${item.sku} — ${item.name}` : item.name,
    summary: [
      `Tồn ${formatQty(item.qty)}`,
      item.materialType,
      item.bodyMetal || item.metalKind,
      item.shape,
      item.color,
      item.sizeLabel ? `size ${item.sizeLabel}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    thumb: item.images[0]?.url ?? null,
  }))
}

function finishedPickerOptions(items: FinishedProductOption[]): CatalogPickerItem[] {
  return items.map((item) => ({
    id: item.code,
    label: `${item.code} — ${item.description}`,
    summary: [
      item.remainingQty > 0 ? `Tồn ${item.remainingQty}` : 'Đã xuất hết',
      item.mainMaterial,
      item.sizeLabel ? `size ${item.sizeLabel}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    thumb: item.images.find((image) => image.kind === 'PRODUCT')?.url ?? item.images[0]?.url ?? null,
  }))
}

/** Khối thuộc tính NVL — Lên đơn mới và Lên đơn BTP dùng chung để luôn giống nhau. */
function NvlDetailFields({
  materialName,
  platingName,
  stoneColorName,
  platingValue,
  stoneTypeOptions,
  nvlMaxQty,
  allowEmptyQty,
}: {
  materialName: 'mainMaterial' | 'nvlMainMaterial'
  platingName: 'platingColor' | 'nvlPlatingColor'
  stoneColorName: 'stoneColor' | 'nvlStoneColor'
  platingValue: string
  stoneTypeOptions: string[]
  nvlMaxQty: number | null
  allowEmptyQty: boolean
}) {
  return (
    <>
      <FormRow columns={3}>
        <FormTextField<FormValues> name="size" label="Kích thước (đường kính, dài…)" readOnly />
        <FormTextField<FormValues> name={materialName} label="Chất liệu" readOnly />
        <FormSelect<FormValues>
          name={platingName}
          label="Màu sắc (xi)"
          placeholder="Chọn màu xi…"
          clearable
          options={platingColorOptions(platingValue)}
        />
      </FormRow>

      <FormRow columns={4}>
        <FormMultiFreeSoloField<FormValues>
          name="stoneTypes"
          label="Loại đá"
          options={stoneTypeOptions}
          placeholder="Chọn chất loại NVL…"
          readOnly
        />
        <FormTextField<FormValues> name={stoneColorName} label="Màu đá" readOnly />
        <FormTextField<FormValues>
          name="stoneCount"
          label="Số lượng NVL cần lên đơn"
          required={!allowEmptyQty}
          transform={digitsOnly}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          rules={{
            validate: (value) => (allowEmptyQty && !value ? true : qtyOverStock(value, nvlMaxQty)),
          }}
        />
        <FormQtyField<FormValues> name="stoneWeight" label="Trọng lượng đá (g)" />
      </FormRow>

      <FormRow columns={2}>
        <FormTextField<FormValues> name="laserEngraving" label="Nội dung khắc laser" multiline maxRows={4} />
        <FormTextField<FormValues> name="otherRequirements" label="Yêu cầu khác" multiline maxRows={4} readOnly />
      </FormRow>
    </>
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
  const btpMaterialId = useWatch({ control: form.control, name: 'btpMaterialId' })
  const finishedProductCode = useWatch({ control: form.control, name: 'finishedProductCode' })
  const nvlMaterialId = useWatch({ control: form.control, name: 'nvlMaterialId' })
  const qtyUnit = useWatch({ control: form.control, name: 'qtyUnit' })
  const platingColor = useWatch({ control: form.control, name: 'platingColor' })
  const nvlPlatingColor = useWatch({ control: form.control, name: 'nvlPlatingColor' })
  const mainMaterial = useWatch({ control: form.control, name: 'mainMaterial' })
  const finishedProductQty = useWatch({ control: form.control, name: 'finishedProductQty' })
  const stoneCount = useWatch({ control: form.control, name: 'stoneCount' })
  const btpCategory = useWatch({ control: form.control, name: 'btpCategory' })
  const productKind = useWatch({ control: form.control, name: 'productKind' })
  const stoneColor = useWatch({ control: form.control, name: 'stoneColor' })
  const isBtp = source === 'BTP'
  const isNvl = !isBtp
  // Đã giao khâu thì phiếu xuất BTP đã theo hàng đi — không đổi loại đơn / mã BTP nữa.
  const sourceLocked = Boolean(order && order.stages.length > 0)

  const btpOptions = useQuery({
    queryKey: ['btp-options'],
    queryFn: () => listBtpOptionsApi(),
    enabled: open && isBtp,
    staleTime: 60_000,
  })
  const finishedProducts = useQuery({
    queryKey: ['finished-product-options'],
    queryFn: () => listFinishedProductOptionsApi(),
    enabled: open && isNvl,
    staleTime: 60_000,
  })
  const nvlOptions = useQuery({
    queryKey: ['nvl-options'],
    queryFn: () => listNvlOptionsApi(),
    enabled: open,
    staleTime: 60_000,
  })
  const inventoryLookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    enabled: open && isBtp,
    staleTime: 5 * 60_000,
  })
  const btpCatalogs = useQuery({
    queryKey: ['catalogs', 'OTHER'],
    queryFn: () => listCatalogsApi('OTHER'),
    enabled: open && isBtp,
    staleTime: 5 * 60_000,
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
        laserEngraving: order.laserEngraving,
        otherRequirements: order.otherRequirements,
        remainingQty: 0,
        images: (order.images ?? []).map((image) => ({
          kind: image.kind,
          url: image.url,
          publicId: image.publicId,
          width: image.width ?? null,
          height: image.height ?? null,
        })),
      } satisfies FinishedProductOption,
      ...items,
    ]
  }, [finishedProducts.data, order])
  const nvlItems = useMemo(() => {
    const items = nvlOptions.data ?? []
    const current = order?.nvl
    if (!current || items.some((item) => item.id === current.id)) return items
    return [
      {
        id: current.id,
        sku: current.sku,
        name: current.name,
        unit: '',
        qty: '0',
        shape: null,
        color: null,
        materialType: null,
        bodyMetal: null,
        metalKind: null,
        sizeLabel: null,
        note: null,
        images: [],
      } satisfies NvlOption,
      ...items,
    ]
  }, [nvlOptions.data, order?.nvl])
  const finishedPickerItems = useMemo(() => finishedPickerOptions(finishedItems), [finishedItems])
  const nvlPickerItems = useMemo(() => nvlPickerOptions(nvlItems), [nvlItems])
  const selectedBtp = btpItems.find((item) => item.id === btpMaterialId)
  const selectedFinished = finishedItems.find((item) => item.code === finishedProductCode)
  const fgHeldQty =
    order?.source === 'NVL' && order.sourceOrderCode === finishedProductCode
      ? (order.finishedProductQty ?? 0)
      : 0
  const finishedMaxQty =
    selectedFinished != null ? selectedFinished.remainingQty + fgHeldQty : fgHeldQty > 0 ? fgHeldQty : null
  const selectedNvl = nvlItems.find((item) => item.id === nvlMaterialId)
  const nvlHeldQty =
    order?.nvl?.id === nvlMaterialId ? (order.stoneCount ?? 0) : 0
  const nvlMaxQty =
    selectedNvl != null
      ? Number(selectedNvl.qty) + nvlHeldQty
      : nvlHeldQty > 0
        ? nvlHeldQty
        : null
  /** SL tối đa: tồn hiện có, cộng số đơn này đang giữ nếu vẫn là mã cũ. */
  const btpMaxQty = selectedBtp
    ? Number(selectedBtp.qty) +
      (order?.btp?.id === selectedBtp.id ? (order.finishedProductQty ?? order.qty) : 0)
    : order?.btp?.id === btpMaterialId
      ? (order.finishedProductQty ?? order.qty ?? null)
      : null

  const btpCategoryOptions = useMemo(
    () =>
      nameOptions(
        withFallback(inventoryLookups.data?.btpCategories, catalogChildren(btpCatalogs.data, 'danh-muc-btp')),
        btpCategory,
      ),
    [btpCatalogs.data, btpCategory, inventoryLookups.data?.btpCategories],
  )
  const bodyMetalOptions = useMemo(
    () =>
      nameOptions(
        withFallback(inventoryLookups.data?.bodyMetals, catalogChildren(btpCatalogs.data, 'chat-lieu')),
        mainMaterial,
      ),
    [btpCatalogs.data, inventoryLookups.data?.bodyMetals, mainMaterial],
  )
  const productKindOptions = useMemo(
    () =>
      nameOptions(
        withFallback(inventoryLookups.data?.productKinds, catalogChildren(btpCatalogs.data, 'phan-loai-san-pham')),
        productKind,
      ),
    [btpCatalogs.data, inventoryLookups.data?.productKinds, productKind],
  )
  const platingSelectOptions = useMemo(
    () =>
      nameOptions(
        [
          ...PLATING_COLORS.map((name) => ({ name })),
          ...withFallback(
            inventoryLookups.data?.platingColors,
            catalogChildren(btpCatalogs.data, 'mau-xi'),
          ),
        ],
        platingColor,
      ),
    [btpCatalogs.data, inventoryLookups.data?.platingColors, platingColor],
  )
  const stoneColorOptions = useMemo(
    () => nameOptions(inventoryLookups.data?.colors, stoneColor),
    [inventoryLookups.data?.colors, stoneColor],
  )

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
            finishedProductCode: order.sourceOrderCode ?? '',
            nvlMaterialId: order.nvl?.id ?? '',
            requestType: order.requestType,
            receivedDate: order.receivedDate,
            leadTime: order.leadTime ?? '',
            closedBy: order.closedBy,
            askedUserId: order.askedUserId ?? '',
            trackingCode: order.trackingCode ?? '',
            qty: String(order.qty),
            qtyUnit: order.qtyUnit ?? '',
            finishedProductQty:
              order.finishedProductQty != null
                ? String(order.finishedProductQty)
                : order.source === 'BTP'
                  ? String(order.qty)
                  : '',
            debtStatus: order.debtStatus ?? '',
            description: order.description,
            dueDate: order.dueDate ?? '',
            size: order.size ?? '',
            sizeLabel: order.sizeLabel ?? '',
            stoneCount: order.stoneCount != null ? String(order.stoneCount) : '',
            stoneWeight: order.stoneWeight ?? '',
            silverWeight: order.silverWeight ?? '',
            laserEngraving: order.laserEngraving ?? '',
            otherRequirements: order.otherRequirements ?? '',
            mainMaterial: order.mainMaterial ?? '',
            platingColor: normalizePlatingColor(order.platingColor),
            btpCategory: order.btpCategory ?? '',
            productKind: order.productKind ?? '',
            stoneColor: order.stoneColor ?? '',
            stoneTypes: order.stoneTypes,
            model3dCode: order.model3dCode ?? '',
            model3dUrl: order.model3dUrl ?? '',
            parentCode: order.parentCode ?? '',
            detailImages: order.images.filter((image) => image.kind === 'DETAIL'),
            productImages: order.images.filter((image) => image.kind === 'PRODUCT'),
          }
        : {
            ...EMPTY,
            source: initialSource,
            receivedDate: todayYmd(),
            closedBy: operatorName,
            qty: '',
            qtyUnit: '',
            finishedProductQty: '',
          },
    )
  }, [open, order, initialSource, operatorName, form])

  useEffect(() => {
    if (!open || !finishedProductQty) return
    void form.trigger('finishedProductQty')
  }, [finishedProductQty, finishedMaxQty, btpMaxQty, form, open])

  useEffect(() => {
    if (!open || !stoneCount) return
    void form.trigger('stoneCount')
  }, [stoneCount, nvlMaxQty, form, open])

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
    form.setValue('sizeLabel', next?.sizeLabel ?? '', { shouldDirty: true })
    form.setValue('btpCategory', next?.category ?? '', { shouldDirty: true })
    form.setValue('mainMaterial', next?.bodyMetal ?? '', { shouldDirty: true })
    form.setValue('productKind', next?.productKind ?? '', { shouldDirty: true })
    form.setValue('platingColor', normalizePlatingColor(next?.platingColor), { shouldDirty: true })
    form.setValue('stoneColor', next?.stoneColor ?? '', { shouldDirty: true })
    replaceKindImages(
      'productImages',
      previous?.images.map((image) => image.publicId) ?? [],
      asProductImages(next?.images ?? []),
    )
  }

  function applyFinishedProduct(next: FinishedProductOption | undefined, previous: FinishedProductOption | undefined) {
    form.setValue('sizeLabel', next?.sizeLabel ?? '', { shouldDirty: true })
    replaceKindImages(
      'productImages',
      asProductImages(previous?.images ?? []).map((image) => image.publicId),
      asProductImages(next?.images ?? []),
    )
    if (form.getValues('finishedProductQty')) void form.trigger('finishedProductQty')
  }

  function applyNvl(next: NvlOption | undefined, previous: NvlOption | undefined) {
    form.setValue('size', next?.sizeLabel ?? '', { shouldDirty: true })
    const material = next?.bodyMetal || next?.metalKind || ''
    const color = next?.color ?? ''
    if (form.getValues('source') === 'BTP') {
      form.setValue('nvlMainMaterial', material, { shouldDirty: true })
      form.setValue('nvlStoneColor', color, { shouldDirty: true })
    } else {
      form.setValue('mainMaterial', material, { shouldDirty: true })
      form.setValue('stoneColor', color, { shouldDirty: true })
    }
    form.setValue('stoneTypes', next?.materialType ? [next.materialType] : [], { shouldDirty: true })
    const other = form.getValues('otherRequirements').trim()
    if (!other || other === (previous?.note ?? '')) {
      form.setValue('otherRequirements', next?.note ?? '', { shouldDirty: true })
    }
    replaceKindImages(
      'productImages',
      previous?.images.map((image) => image.publicId) ?? [],
      asProductImages(next?.images ?? []),
    )
    if (form.getValues('stoneCount')) void form.trigger('stoneCount')
  }

  function submit(values: FormValues) {
    if (!values.requestType) return
    const btp = values.source === 'BTP'
    return onSave({
      source: values.source,
      btpMaterialId: btp ? values.btpMaterialId || null : null,
      nvlMaterialId: values.nvlMaterialId || null,
      finishedProductCode: btp ? null : values.finishedProductCode || null,
      requestType: values.requestType,
      receivedDate: values.receivedDate,
      closedBy: values.closedBy.trim() || operatorName,
      description: values.description.trim(),
      qty: Number(values.qty) || 1,
      qtyUnit: values.qtyUnit || null,
      finishedProductQty: values.finishedProductQty ? Number(values.finishedProductQty) : null,
      leadTime: values.leadTime.trim(),
      trackingCode: values.trackingCode.trim(),
      askedUserId: null,
      debtStatus: '',
      dueDate: values.dueDate,
      size: values.size.trim(),
      sizeLabel: values.sizeLabel.trim(),
      stoneCount: values.stoneCount ? Number(values.stoneCount) : null,
      stoneWeight: values.stoneWeight || null,
      silverWeight: values.silverWeight || null,
      laserEngraving: values.laserEngraving.trim(),
      otherRequirements: values.otherRequirements.trim(),
      mainMaterial: values.mainMaterial.trim(),
      platingColor: normalizePlatingColor(values.platingColor),
      btpCategory: values.btpCategory.trim(),
      productKind: values.productKind.trim(),
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
      titles={{ ...TITLES, create: source === 'BTP' ? 'Lên đơn BTP' : 'Lên đơn mới' }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitDisabled={uploading}
      maxWidth="lg"
      submitLabel={uploading ? 'Đang upload ảnh…' : order ? 'Lưu' : 'Lên đơn'}
      onClose={onClose}
      onExited={onExited ?? (() => undefined)}
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
            <FormRow columns={3}>
              <Controller
                control={form.control}
                name="finishedProductCode"
                rules={{
                  validate: (value, values) =>
                    values.source !== 'NVL' || Boolean(value) || 'Chọn mã thành phẩm',
                }}
                render={({ field, fieldState }) => (
                  <CatalogPicker
                    value={field.value}
                    options={finishedPickerItems}
                    label="Mã thành phẩm (kho thành phẩm)"
                    placeholder="Chọn mã trong kho thành phẩm…"
                    loadingText="Đang tải kho thành phẩm…"
                    noOptionsText="Kho thành phẩm chưa có mã nào"
                    required
                    loading={finishedProducts.isFetching}
                    autoFocus={!order}
                    errorText={fieldState.error?.message}
                    inputRef={field.ref}
                    onBlur={field.onBlur}
                    onChange={(code) => {
                      const previous = finishedItems.find((item) => item.code === field.value)
                      field.onChange(code)
                      applyFinishedProduct(
                        finishedItems.find((item) => item.code === code),
                        previous,
                      )
                    }}
                  />
                )}
              />
              <FormTextField<FormValues> name="sizeLabel" label="Size thành phẩm" readOnly />
              <FormTextField<FormValues>
                name="finishedProductQty"
                label="Số lượng thành phẩm cần lên đơn"
                required
                transform={digitsOnly}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                rules={{
                  validate: (value) => qtyOverStock(value, finishedMaxQty),
                }}
              />
            </FormRow>
          </Box>

          <Box sx={SECTION_SX}>
            <Controller
              control={form.control}
              name="nvlMaterialId"
              rules={{
                validate: (value, values) =>
                  values.source !== 'NVL' || Boolean(value) || 'Chọn mã NVL',
              }}
              render={({ field, fieldState }) => (
                <CatalogPicker
                  value={field.value}
                  options={nvlPickerItems}
                  label="Mã NVL (kho NVL)"
                  placeholder="Chọn mã trong kho NVL chính…"
                  loadingText="Đang tải kho NVL…"
                  noOptionsText="Kho NVL chính chưa có mã nào"
                  required
                  loading={nvlOptions.isFetching}
                  errorText={fieldState.error?.message}
                  inputRef={field.ref}
                  onBlur={field.onBlur}
                  onChange={(id) => {
                    const previous = nvlItems.find((item) => item.id === field.value)
                    field.onChange(id)
                    applyNvl(
                      nvlItems.find((item) => item.id === id),
                      previous,
                    )
                  }}
                />
              )}
            />

            <NvlDetailFields
              materialName="mainMaterial"
              platingName="platingColor"
              stoneColorName="stoneColor"
              platingValue={platingColor}
              stoneTypeOptions={lookups?.stoneTypes ?? []}
              nvlMaxQty={nvlMaxQty}
              allowEmptyQty={false}
            />
          </Box>

          <Box sx={SECTION_SX}>
            <FormRow columns={4}>
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
                rules={{
                  validate: (value, values) =>
                    !value || !values.receivedDate || value >= values.receivedDate || 'Không được trước ngày đặt đơn',
                }}
              />
              <FormFreeSoloField<FormValues>
                name="leadTime"
                label="Thời gian cần hoàn thành"
                required
                options={lookups?.leadTimes ?? []}
              />
            </FormRow>

            <FormRow columns={order ? 3 : 2}>
              <FormTextField<FormValues> name="closedBy" label="Người lên đơn" readOnly />
              <FormTextField<FormValues> name="trackingCode" label="Mã theo dõi đơn" placeholder="V-9147" required />
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
              <FormSelect<FormValues>
                name="qtyUnit"
                label="Đơn vị"
                required
                placeholder="Chọn đơn vị…"
                options={[
                  { value: 'chiếc', label: 'Chiếc' },
                  { value: 'đôi', label: 'Đôi' },
                ]}
              />
              <FormTextField<FormValues>
                name="qty"
                label="Số lượng cần làm"
                required
                disabled={!qtyUnit}
                transform={digitsOnly}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                helperText={qtyUnit ? undefined : 'Chọn đơn vị trước'}
                rules={{
                  validate: (value, values) => {
                    if (!values.qtyUnit) return 'Chọn đơn vị trước'
                    if (Number(value) < 1) return 'Số lượng phải từ 1'
                    if (order && Number(value) < order.subTicketTotals.qty) {
                      return `Đã chia ${order.subTicketTotals.qty} sp cho phiếu con`
                    }
                    return true
                  },
                }}
              />
              <FormQtyField<FormValues>
                name="silverWeight"
                label="Tổng TL bạc (g)"
                helperText="Mốc chia gram cho phiếu con"
                rules={{
                  validate: (value) => {
                    if (!order?.subTickets.length) return true
                    if (!value) return 'Đơn đã chia phiếu con, không bỏ trống được'
                    const split = Number(order.subTicketTotals.silverWeight)
                    return (
                      Number(value) >= split ||
                      `Đã chia ${formatQty(order.subTicketTotals.silverWeight)} g cho phiếu con`
                    )
                  },
                }}
              />
            </FormRow>

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
            <FormRow columns={3}>
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
                      applyBtpCatalog(
                        btpItems.find((item) => item.id === id),
                        previous,
                      )
                      if (form.getValues('finishedProductQty')) void form.trigger('finishedProductQty')
                    }}
                  />
                )}
              />
              <FormTextField<FormValues> name="sizeLabel" label="Size" readOnly />
              <FormTextField<FormValues>
                name="finishedProductQty"
                label="Số lượng BTP cần lên đơn"
                required
                clearable
                transform={digitsOnly}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                rules={{
                  validate: (value) => qtyOverStock(value, btpMaxQty),
                }}
              />
            </FormRow>
            <FormRow columns={3}>
              <FormSearchSelect<FormValues>
                name="btpCategory"
                label="Danh mục BTP"
                options={btpCategoryOptions}
                readOnly
                placeholder="Tìm danh mục BTP…"
              />
              <FormSearchSelect<FormValues>
                name="mainMaterial"
                label="Chất liệu"
                options={bodyMetalOptions}
                readOnly
                placeholder="Tìm chất liệu…"
              />
              <FormSearchSelect<FormValues>
                name="productKind"
                label="Phân loại sản phẩm"
                options={productKindOptions}
                readOnly
                placeholder="Tìm phân loại sản phẩm…"
              />
            </FormRow>
            <FormRow columns={2}>
              <FormSearchSelect<FormValues>
                name="platingColor"
                label="Màu xi"
                options={platingSelectOptions}
                readOnly
                placeholder="Tìm màu xi…"
              />
              <FormSearchSelect<FormValues>
                name="stoneColor"
                label="Màu đá"
                options={stoneColorOptions}
                readOnly
                placeholder="Tìm màu đá…"
              />
            </FormRow>
          </Box>

          <Box sx={SECTION_SX}>
            <Controller
              control={form.control}
              name="nvlMaterialId"
              rules={{
                validate: (value, values) =>
                  values.source !== 'BTP' || Boolean(value) || 'Chọn mã NVL',
              }}
              render={({ field, fieldState }) => (
                <CatalogPicker
                  value={field.value}
                  options={nvlPickerItems}
                  label="Mã NVL (kho NVL)"
                  placeholder="Chọn mã trong kho NVL chính…"
                  loadingText="Đang tải kho NVL…"
                  noOptionsText="Kho NVL chính chưa có mã nào"
                  required
                  loading={nvlOptions.isFetching}
                  errorText={fieldState.error?.message}
                  inputRef={field.ref}
                  onBlur={field.onBlur}
                  onChange={(id) => {
                    const previous = nvlItems.find((item) => item.id === field.value)
                    field.onChange(id)
                    applyNvl(
                      nvlItems.find((item) => item.id === id),
                      previous,
                    )
                  }}
                />
              )}
            />

            <NvlDetailFields
              materialName="nvlMainMaterial"
              platingName="nvlPlatingColor"
              stoneColorName="nvlStoneColor"
              platingValue={nvlPlatingColor}
              stoneTypeOptions={lookups?.stoneTypes ?? []}
              nvlMaxQty={nvlMaxQty}
              allowEmptyQty={false}
            />
          </Box>

          <Box sx={SECTION_SX}>
            <FormRow columns={4}>
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
                rules={{
                  validate: (value, values) =>
                    !value || !values.receivedDate || value >= values.receivedDate || 'Không được trước ngày đặt đơn',
                }}
              />
              <FormFreeSoloField<FormValues>
                name="leadTime"
                label="Thời gian cần hoàn thành"
                required
                options={lookups?.leadTimes ?? []}
              />
            </FormRow>

            <FormRow columns={order ? 3 : 2}>
              <FormTextField<FormValues> name="closedBy" label="Người lên đơn" readOnly />
              <FormTextField<FormValues>
                name="trackingCode"
                label="Mã theo dõi đơn"
                placeholder="V-9147"
                required
                clearable
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

            <FormRow columns={3}>
              <FormSelect<FormValues>
                name="qtyUnit"
                label="Đơn vị"
                required
                clearable
                placeholder="Chọn đơn vị…"
                options={[
                  { value: 'chiếc', label: 'Chiếc' },
                  { value: 'đôi', label: 'Đôi' },
                ]}
              />
              <FormTextField<FormValues>
                name="qty"
                label="Số lượng cần làm"
                required
                clearable
                disabled={!qtyUnit}
                transform={digitsOnly}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                helperText={qtyUnit ? undefined : 'Chọn đơn vị trước'}
                rules={{
                  validate: (value, values) => {
                    if (!values.qtyUnit) return 'Chọn đơn vị trước'
                    if (Number(value) < 1) return 'Số lượng phải từ 1'
                    if (order && Number(value) < order.subTicketTotals.qty) {
                      return `Đã chia ${order.subTicketTotals.qty} sp cho phiếu con`
                    }
                    return true
                  },
                }}
              />
              <FormQtyField<FormValues>
                name="silverWeight"
                label="Tổng TL bạc (g)"
                helperText="Mốc chia gram cho phiếu con"
                rules={{
                  validate: (value) => {
                    if (!order?.subTickets.length) return true
                    if (!value) return 'Đơn đã chia phiếu con, không bỏ trống được'
                    const split = Number(order.subTicketTotals.silverWeight)
                    return (
                      Number(value) >= split ||
                      `Đã chia ${formatQty(order.subTicketTotals.silverWeight)} g cho phiếu con`
                    )
                  },
                }}
              />
            </FormRow>

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
