import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link as RouterLink } from 'react-router-dom'
import { toast } from 'sonner'
import {
  createCastingCutApi,
  deleteCastingCutApi,
  listCastingCutsApi,
  listCutSlipOptionsApi,
  listCutOrderOptionsApi,
  listRestMaterialOptionsApi,
  type CastingCut,
  type CastingCutPayload,
  type CutImage,
  type CutOrderOption,
} from '../api/castingCuts'
import { formatQty } from '../api/inventory'
import { confirmWeights, ratioWarning } from '../orders/weightSanity'
import type { OrderImage } from '../api/productionOrders'
import {
  ColumnHeaderSearch,
  DataTable,
  Form,
  FormQtyField,
  FormRow,
  PageHeader,
  RowActions,
  TextInput,
  TrashIcon,
  type Column,
} from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'
import { useTableParams } from '../hooks/useTableParams'
import { fromDateTimeInput, formatDateTime, toDateTimeInput } from '../orders/catalog'
import { ImageUploadField } from '../orders/ImageUploadField'
import { IntakeStatusChip } from '../intake/IntakeStatusChip'
import { StatusChip } from '../orders/OrderChips'
import type { IntakeOrderStatus } from '../api/intakeOrders'
import type { ProductionStatus } from '../api/productionOrders'
import { LineActions } from '../warehouses/LineActions'

type LineValues = { order: CutOrderOption | null; qty: string; weight: string; images: CutImage[] }

type FormValues = {
  castingSlipId: string
  cutAt: string
  treeWeight: string
  restWeight: string
  restMaterialId: string
  restImages: CutImage[]
  note: string
  lines: LineValues[]
}

const EMPTY_LINE: LineValues = { order: null, qty: '', weight: '', images: [] }

function emptyForm(): FormValues {
  return {
    castingSlipId: '',
    cutAt: toDateTimeInput(new Date().toISOString()),
    treeWeight: '',
    restWeight: '',
    restMaterialId: '',
    restImages: [],
    note: '',
    lines: [{ ...EMPTY_LINE }],
  }
}

const cellLeft = { textAlign: 'left', paddingLeft: '10px' } as const
const digitsOnly = (value: string) => value.replace(/\D/g, '')
const num = (value: string) => Number(value) || 0
const grams = (value: number | string) => `${formatQty(String(value))} g`

// Ô ảnh dùng chung với đơn cần `kind`; phiếu cắt không phân loại nên gắn tạm rồi bỏ khi lưu.
const asOrderImages = (images: CutImage[]): OrderImage[] => images.map((image) => ({ ...image, kind: 'PRODUCT' }))
const asCutImages = (images: OrderImage[]): CutImage[] =>
  images.map(({ url, publicId, width, height }) => ({ url, publicId, width, height }))

/** Bước 10: thủ kho cắt cây thông sau đúc, chia phôi cho từng đơn. */
export function CastingCutsPage() {
  const queryClient = useQueryClient()
  const table = useTableParams({ pageSize: 25, filters: { search: '' } })
  const { params } = table
  const search = params.search.trim()
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<CastingCut | null>(null)

  const list = useQuery({
    queryKey: ['casting-cuts', params.page, params.pageSize, search],
    queryFn: () => listCastingCutsApi({ search, page: params.page, pageSize: params.pageSize }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['casting-cuts'] })
    void queryClient.invalidateQueries({ queryKey: ['production-orders'] })
    void queryClient.invalidateQueries({ queryKey: ['production-order'] })
  }

  const columns = useMemo<Column<CastingCut>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã phiếu',
        width: 110,
        align: 'left',
        headSx: cellLeft,
        cellSx: { ...cellLeft, fontWeight: 700 },
        filter: (
          <ColumnHeaderSearch
            value={params.search}
            onChange={(value) => table.setFilter({ search: value })}
            placeholder="Mã phiếu / đơn / lệnh đúc…"
          />
        ),
      },
      {
        key: 'cutAt',
        header: 'Thời gian cắt',
        width: 140,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => formatDateTime(row.cutAt),
      },
      {
        key: 'castingOrder',
        header: 'Phiếu đúc',
        width: 110,
        align: 'left',
        headSx: cellLeft,
        cellSx: cellLeft,
        render: (row) => row.castingSlip?.code ?? row.castingOrder?.code ?? '—',
      },
      {
        key: 'orders',
        header: 'Đơn nhận phôi',
        align: 'left',
        headSx: cellLeft,
        cellSx: { ...cellLeft, whiteSpace: 'pre-line' },
        render: (row) =>
          row.lines.map((line) => `${line.order.code} · ${line.qty} sp · ${grams(line.weight)}`).join('\n'),
      },
      { key: 'treeWeight', header: 'TL cây', width: 100, render: (row) => grams(row.treeWeight) },
      { key: 'restWeight', header: 'Còn lại → NVL', width: 120, render: (row) => grams(row.restWeight) },
      {
        key: 'lossWeight',
        header: 'Hao hụt cắt',
        width: 110,
        render: (row) => grams(row.lossWeight),
      },
      {
        key: 'actions',
        header: 'Hành động',
        width: 120,
        align: 'center',
        render: (row) => (
          <Stack direction="row" sx={{ justifyContent: 'center' }}>
            <RowActions titles={{ view: 'Xem chi tiết' }} onView={() => setViewing(row)} />
            <Tooltip title="In phiếu cắt">
              <IconButton size="small" component={RouterLink} to={`/casting-cuts/${row.code}/print`} target="_blank">
                <PrintIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [params.search, table.setFilter],
  )

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: { md: 1 }, minHeight: { md: 0 }, height: { md: '100%' }, overflow: { xs: 'visible', md: 'hidden' } }}
    >
      <PageHeader
        title="Phiếu cắt cây cũ"
        subtitle="Lịch sử phiếu đã lập trước khi chuyển việc cân phôi vào bước xác nhận đúc."
        compactSubtitle
      />
      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={list.isLoading && !list.data}
        errorText={list.error instanceof Error ? list.error.message : undefined}
        emptyText={search ? 'Không có phiếu cắt khớp tìm kiếm.' : 'Không có phiếu cắt cũ.'}
        variant="grid"
        fixedLayout
        minWidth={900}
        showIndex
        indexOffset={(params.page - 1) * params.pageSize}
        page={params.page}
        pageSize={params.pageSize}
        total={list.data?.total ?? 0}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        rowsLabel="phiếu"
        sx={{ flex: { md: 1 } }}
      />
      <CastingCutFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(cut) => {
          setCreating(false)
          refresh()
          setViewing(cut)
        }}
      />
      <CastingCutViewDialog
        cut={viewing}
        onClose={() => setViewing(null)}
        onDeleted={() => {
          setViewing(null)
          refresh()
        }}
      />
    </Stack>
  )
}

function CastingCutFormDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: (cut: CastingCut) => void
}) {
  const fullScreen = useIsMobile()
  const form = useForm<FormValues>({ defaultValues: emptyForm() })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const watchedLines = useWatch({ control: form.control, name: 'lines' }) ?? []
  const treeWeight = useWatch({ control: form.control, name: 'treeWeight' })
  const restWeight = useWatch({ control: form.control, name: 'restWeight' })
  const restImages = useWatch({ control: form.control, name: 'restImages' }) ?? []
  // Mỗi ô ảnh báo riêng đang upload hay không; còn ô nào đang tải thì khoá nút Lưu.
  const [uploadingKeys, setUploadingKeys] = useState<Record<string, boolean>>({})
  const uploading = Object.values(uploadingKeys).some(Boolean)
  const markUploading = (key: string) => (value: boolean) =>
    setUploadingKeys((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))

  const slipOptions = useQuery({
    queryKey: ['casting-cut-slip-options'],
    queryFn: listCutSlipOptionsApi,
    enabled: open,
    staleTime: 0,
  })

  /** Chọn phiếu đúc: điền TL cây sau đúc và một dòng phôi cho mỗi đơn trong lô. */
  function pickSlip(id: string) {
    form.setValue('castingSlipId', id)
    const slip = (slipOptions.data ?? []).find((item) => item.id === id)
    if (!slip) return
    if (slip.castTreeWeight) form.setValue('treeWeight', slip.castTreeWeight)
    lines.replace(
      slip.orders.map((order) => ({ ...EMPTY_LINE, order, qty: String(order.qty) })),
    )
  }
  const restMaterials = useQuery({
    queryKey: ['casting-cut-rest-materials'],
    queryFn: listRestMaterialOptionsApi,
    enabled: open,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!open) return
    form.reset(emptyForm())
    setUploadingKeys({})
  }, [open, form])

  const blanks = watchedLines.reduce((sum, line) => sum + num(line?.weight ?? ''), 0)
  const loss = num(treeWeight) - blanks - num(restWeight)
  const overWeight = num(treeWeight) > 0 && loss < 0
  // Mọi dòng là đơn tạo đã đúc xong: TL cây không vượt TL cây sau đúc thủ kho đã xác nhận (khớp BE).
  const castLimit = useMemo(() => {
    const orders = watchedLines.map((line) => line?.order).filter(Boolean) as CutOrderOption[]
    if (!orders.length || orders.some((order) => order.kind !== 'intake')) return null
    const bySlip = new Map<string, number>()
    for (const order of orders) {
      if (!order.castingSlipCode || order.castTreeWeight == null) return null
      bySlip.set(order.castingSlipCode, Number(order.castTreeWeight))
    }
    return [...bySlip.values()].reduce((sum, value) => sum + value, 0)
  }, [watchedLines])

  const save = useMutation({
    mutationFn: createCastingCutApi,
    onSuccess: (cut) => {
      toast.success(`Đã lưu phiếu cắt ${cut.code}`)
      onSaved(cut)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function submit(values: FormValues) {
    if (overWeight) return
    const tree = num(values.treeWeight)
    if (
      !confirmWeights([
        ratioWarning(blanks + num(values.restWeight), 'Phôi + phần còn lại', tree, 'TL cây', {
          min: 0.5,
          max: 1,
          note: 'hao hụt cắt trên 50%',
        }),
      ])
    ) {
      return
    }
    const missingImage = values.lines.find((line) => line.images.length === 0)
    if (missingImage) {
      toast.error(`Chụp ảnh cân phôi của đơn ${missingImage.order?.code ?? ''}`.trim())
      return
    }
    if (num(values.restWeight) > 0 && values.restImages.length === 0) {
      toast.error('Chụp ảnh cân phần còn lại của cây')
      return
    }
    const cutAt = fromDateTimeInput(values.cutAt)
    if (!cutAt) {
      form.setError('cutAt', { message: 'Nhập thời gian cắt' })
      return
    }
    const payload: CastingCutPayload = {
      castingOrderId: null,
      castingSlipId: values.castingSlipId || null,
      cutAt,
      treeWeight: values.treeWeight,
      restWeight: values.restWeight || '0',
      restMaterialId: values.restMaterialId || null,
      restImages: values.restImages,
      note: values.note.trim() || null,
      lines: values.lines.map((line) => ({
        ...(line.order!.kind === 'intake'
          ? { intakeOrderId: line.order!.id }
          : { orderId: line.order!.id }),
        qty: Number(line.qty),
        weight: line.weight,
        images: line.images,
      })),
    }
    save.mutate(payload)
  }

  const takenIds = new Set(watchedLines.map((line) => line?.order?.id).filter(Boolean))
  const busy = save.isPending || uploading
  const restDefaultLabel = restMaterials.data ? `${restMaterials.data.defaultName} (mặc định)` : 'Mặc định'

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle>Cắt cây thông</DialogTitle>
      <Form form={form} onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <DialogContent dividers>
          <Stack spacing={2}>
            <FormRow columns={3}>
              <TextInput
                select
                label="Phiếu đúc (lệnh đúc)"
                value={form.watch('castingSlipId')}
                onChange={(event) => pickSlip(event.target.value)}
                helperText={
                  slipOptions.data && !slipOptions.data.length
                    ? 'Chưa có phiếu đúc nào Đúc xong chờ cắt'
                    : 'Phiếu thủ kho đã xác nhận Đúc xong'
                }
              >
                <MenuItem value="">Không chọn</MenuItem>
                {(slipOptions.data ?? []).map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.code} · {item.orders.map((order) => order.code).join(', ')}
                    {item.castTreeWeight ? ` · cây ${formatQty(item.castTreeWeight)} g` : ''}
                  </MenuItem>
                ))}
              </TextInput>
              <TextInput
                label="Thời gian cắt"
                type="datetime-local"
                required
                slotProps={{ inputLabel: { shrink: true } }}
                {...form.register('cutAt', { required: 'Nhập thời gian cắt' })}
                errorText={form.formState.errors.cutAt?.message}
              />
              <FormQtyField<FormValues>
                name="treeWeight"
                label="TL cây thông sau đúc (g)"
                required
                helperText={castLimit != null ? `Tối đa ${formatQty(String(castLimit))} g (TL cây sau đúc)` : undefined}
                rules={{
                  validate: (value) => {
                    if (!(num(String(value)) > 0)) return 'TL cây phải lớn hơn 0'
                    if (castLimit != null && num(String(value)) > castLimit) {
                      return `Không vượt TL cây sau đúc (${formatQty(String(castLimit))} g)`
                    }
                    return true
                  },
                }}
              />
            </FormRow>

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Phôi theo đơn
            </Typography>
            {lines.fields.map((field, index) => {
              const line = watchedLines[index]
              return (
                <Paper key={field.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <OrderPicker
                          value={line?.order ?? null}
                          takenIds={takenIds}
                          errorText={form.formState.errors.lines?.[index]?.order?.message}
                          onChange={(order) => {
                            form.setValue(`lines.${index}.order`, order, { shouldValidate: true })
                            if (order && !form.getValues(`lines.${index}.qty`)) {
                              form.setValue(`lines.${index}.qty`, String(order.qty))
                            }
                            // Đơn tạo đã Đúc xong: gợi ý TL cây từ ô "sau đúc" thủ kho đã xác nhận.
                            if (order?.castTreeWeight && !form.getValues('treeWeight')) {
                              form.setValue('treeWeight', order.castTreeWeight)
                            }
                          }}
                        />
                        <input
                          type="hidden"
                          {...form.register(`lines.${index}.order`, {
                            validate: (value) => Boolean(value) || 'Chọn đơn nhận phôi',
                          })}
                        />
                      </Box>
                      <Box sx={{ pt: '8px' }}>
                        <LineActions
                          addLabel="Thêm đơn"
                          removeLabel="Bỏ đơn"
                          onAdd={() => lines.insert(index + 1, { ...EMPTY_LINE }, { shouldFocus: false })}
                          onRemove={() => {
                            if (lines.fields.length <= 1) {
                              form.setValue('lines', [{ ...EMPTY_LINE }])
                              return
                            }
                            lines.remove(index)
                          }}
                          removeDisabled={lines.fields.length <= 1 && !line?.order}
                        />
                      </Box>
                    </Stack>
                    {line?.order ? (
                      <Typography variant="body2" color="text.secondary">
                        {line.order.model3dCode ? `${line.order.model3dCode} · ` : ''}
                        {line.order.description} · đơn {line.order.qty} {line.order.qtyUnit ?? 'sp'}
                      </Typography>
                    ) : null}
                    <FormRow columns={2}>
                      <FormQtyField<FormValues>
                        name={`lines.${index}.qty`}
                        label="Số lượng phôi"
                        required
                        transform={digitsOnly}
                        rules={{ validate: (value) => num(String(value)) >= 1 || 'Số lượng phải từ 1' }}
                      />
                      <FormQtyField<FormValues>
                        name={`lines.${index}.weight`}
                        label="TL phôi (g)"
                        required
                        rules={{ validate: (value) => num(String(value)) > 0 || 'TL phôi phải lớn hơn 0' }}
                      />
                    </FormRow>
                    <ImageUploadField
                      label="Ảnh cân phôi"
                      kind="PRODUCT"
                      value={asOrderImages(line?.images ?? [])}
                      onChange={(images) => form.setValue(`lines.${index}.images`, asCutImages(images))}
                      onUploadingChange={markUploading(field.id)}
                    />
                  </Stack>
                </Paper>
              )
            })}

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Phần còn lại của cây → kho NVL chính
            </Typography>
            <FormRow columns={2}>
              <FormQtyField<FormValues> name="restWeight" label="TL phần còn lại (g)" />
              <TextInput
                select
                label="Nhập vào mã NVL"
                value={form.watch('restMaterialId')}
                onChange={(event) => form.setValue('restMaterialId', event.target.value)}
              >
                <MenuItem value="">{restDefaultLabel}</MenuItem>
                {(restMaterials.data?.items ?? [])
                  .filter((item) => item.name !== restMaterials.data?.defaultName)
                  .map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.sku ? `${item.sku} · ` : ''}
                      {item.name}
                    </MenuItem>
                  ))}
              </TextInput>
            </FormRow>
            <ImageUploadField
              label="Ảnh cân phần còn lại"
              kind="PRODUCT"
              value={asOrderImages(restImages)}
              onChange={(images) => form.setValue('restImages', asCutImages(images))}
              onUploadingChange={markUploading('rest')}
            />
            <TextInput label="Ghi chú" multiline minRows={2} {...form.register('note')} />

            <Alert severity={overWeight ? 'error' : 'info'}>
              Cây {grams(num(treeWeight))} = phôi {grams(blanks)} + còn lại {grams(num(restWeight))} + hao hụt cắt{' '}
              <b>{grams(Math.max(loss, 0))}</b>
              {overWeight ? ' — tổng phôi và phần còn lại đang vượt TL cây.' : ''}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || overWeight}
            startIcon={save.isPending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {uploading ? 'Đang tải ảnh…' : save.isPending ? 'Đang lưu…' : 'Lưu phiếu cắt'}
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  )
}

function OrderPicker({
  value,
  takenIds,
  errorText,
  onChange,
}: {
  value: CutOrderOption | null
  takenIds: Set<string | undefined>
  errorText?: string
  onChange: (order: CutOrderOption | null) => void
}) {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 250)
    return () => clearTimeout(timer)
  }, [input])
  const options = useQuery({
    queryKey: ['casting-cut-order-options', search],
    queryFn: () => listCutOrderOptionsApi(search),
    staleTime: 10_000,
  })
  const items = (options.data ?? []).filter((item) => item.id === value?.id || !takenIds.has(item.id))

  return (
    <Autocomplete
      forcePopupIcon
      options={items}
      value={value}
      loading={options.isFetching}
      onInputChange={(_, next, reason) => {
        if (reason === 'input') setInput(next)
      }}
      onChange={(_, next) => onChange(next)}
      filterOptions={(list) => list}
      getOptionLabel={(option) => option.code}
      isOptionEqualToValue={(option, next) => option.id === next.id}
      noOptionsText={options.isFetching ? 'Đang tìm…' : 'Không có đơn nào chờ cắt (đơn tạo phải Đúc xong)'}
      renderOption={(props, option) => {
        const { key, ...rest } = props
        return (
          <li key={key} {...rest}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Box component="span" sx={{ fontWeight: 700 }}>
                {option.code}
              </Box>
              {option.kind === 'intake' ? (
                <IntakeStatusChip status={option.status as IntakeOrderStatus} />
              ) : (
                <StatusChip status={option.status as ProductionStatus} />
              )}
              <Box component="span" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {option.model3dCode ? `${option.model3dCode} · ` : ''}
                {option.description}
              </Box>
            </Stack>
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Đơn"
          required
          placeholder="Tìm mã đơn / mã sản phẩm…"
          error={Boolean(errorText)}
          helperText={errorText}
        />
      )}
    />
  )
}

function CastingCutViewDialog({
  cut,
  onClose,
  onDeleted,
}: {
  cut: CastingCut | null
  onClose: () => void
  onDeleted: () => void
}) {
  const fullScreen = useIsMobile()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  useEffect(() => {
    setConfirming(false)
    setReason('')
  }, [cut?.id])

  const remove = useMutation({
    mutationFn: () => deleteCastingCutApi(cut!.code, reason.trim()),
    onSuccess: () => {
      toast.success(`Đã xoá phiếu cắt ${cut?.code}`)
      onDeleted()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={Boolean(cut)} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle>Phiếu cắt {cut?.code}</DialogTitle>
      {cut ? (
        <DialogContent dividers>
          <Stack spacing={2}>
            <FormRow columns={3}>
              <TextInput label="Thời gian cắt" value={formatDateTime(cut.cutAt)} readOnly />
              <TextInput label="Người cắt" value={cut.cutByName} readOnly />
              <TextInput label="Phiếu đúc" value={cut.castingSlip?.code ?? cut.castingOrder?.code ?? '—'} readOnly />
              <TextInput label="TL cây sau đúc" value={grams(cut.treeWeight)} readOnly />
              <TextInput label="Tổng phôi" value={grams(cut.blankWeight)} readOnly />
              <TextInput label="Hao hụt cắt" value={grams(cut.lossWeight)} readOnly />
            </FormRow>
            {cut.lines.map((line) => (
              <Paper key={line.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography
                      component={RouterLink}
                      to={`/orders/${line.order.code}`}
                      sx={{ fontWeight: 700, color: 'primary.main' }}
                    >
                      {line.order.code}
                    </Typography>
                    {line.order.intakeCode ? (
                      <Typography variant="body2" color="text.secondary">
                        (đơn {line.order.intakeCode})
                      </Typography>
                    ) : null}
                    <StatusChip status={line.order.status} />
                    <Typography variant="body2" color="text.secondary">
                      {line.order.model3dCode ? `${line.order.model3dCode} · ` : ''}
                      {line.order.description}
                    </Typography>
                  </Stack>
                  <Typography variant="body2">
                    {line.qty} phôi · {grams(line.weight)} → kho BTP ({line.btpMaterial.sku ?? ''} {line.btpMaterial.name})
                  </Typography>
                  <ImageUploadField label="Ảnh cân phôi" kind="PRODUCT" value={asOrderImages(line.images)} onChange={() => {}} readOnly />
                </Stack>
              </Paper>
            ))}
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Phần còn lại: {grams(cut.restWeight)}
                  {cut.restMaterial ? ` → kho NVL chính (${cut.restMaterial.sku ?? ''} ${cut.restMaterial.name})` : ''}
                </Typography>
                {cut.restImages.length ? (
                  <ImageUploadField label="Ảnh cân phần còn lại" kind="PRODUCT" value={asOrderImages(cut.restImages)} onChange={() => {}} readOnly />
                ) : null}
              </Stack>
            </Paper>
            {cut.note ? <TextInput label="Ghi chú" value={cut.note} multiline readOnly /> : null}
            {confirming ? (
              <Alert severity="warning">
                <Stack spacing={1}>
                  <span>
                    Xoá phiếu sẽ hoàn các phiếu nhập kho BTP / NVL và trả đơn về trạng thái trước khi cắt.
                  </span>
                  <TextField
                    size="small"
                    label="Lý do xoá"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    autoFocus
                  />
                </Stack>
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
      ) : null}
      <DialogActions>
        {cut?.deletable ? (
          confirming ? (
            <Button
              color="error"
              variant="contained"
              disabled={!reason.trim() || remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? 'Đang xoá…' : 'Xác nhận xoá'}
            </Button>
          ) : (
            <Button color="error" startIcon={<TrashIcon />} onClick={() => setConfirming(true)}>
              Xoá phiếu
            </Button>
          )
        ) : null}
        <Box sx={{ flex: 1 }} />
        {cut ? (
          <Button startIcon={<PrintIcon />} component={RouterLink} to={`/casting-cuts/${cut.code}/print`} target="_blank">
            In phiếu
          </Button>
        ) : null}
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  )
}
