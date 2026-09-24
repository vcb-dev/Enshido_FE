import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import {
  FG_FLOW_STATUS,
  fgFlowStatus,
  listFinishedGoodsNvlOptionsApi,
  type FinishedGoodsNvlOption,
  type FinishedGoodsStockRow,
  type UpsertReceiptPayload,
} from '../api/finishedGoods'
import { formatMoney, formatQty, moneyDigitsFromApi } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import {
  EditReasonBlock,
  Form,
  FormMoneyField,
  FormQtyField,
  FormRow,
  FormSelect,
  FormTextField,
} from '../components/ui'
import type { CrudDialogKind } from '../hooks/useCrudDialog'
import { useIsMobile } from '../hooks/useBreakpoint'
import { StockFigureGrid } from '../warehouses/StockFigureGrid'
import { finishedGoodsQtyUnitOptions, stockProfile, THANH_PHAM_WAREHOUSE } from '../warehouses/catalog'
import { validateStockName } from '../warehouses/stockName'
import { platingColorOptions } from '../orders/catalog'
import { BomLinesField } from './BomLinesField'
import { FormFgMaterialSelect, isSilverFgMaterial } from './FgMaterialSelect'

type FormValues = {
  description: string
  qtyUnit: string
  sizeLabel: string
  weight: string
  mainMaterial: string
  platingColor: string
  stockUnitPrice: string
  openingQty: string
  bomLines: Array<{ materialId: string }>
}

const EMPTY: FormValues = {
  description: '',
  qtyUnit: '',
  sizeLabel: '',
  weight: '',
  mainMaterial: '',
  platingColor: '',
  stockUnitPrice: '',
  openingQty: '0',
  bomLines: [{ materialId: '' }],
}

function formValuesFromRow(row: FinishedGoodsStockRow | null): FormValues {
  if (!row) return EMPTY
  const bomLines = (row.bomLines ?? []).map((item) => ({ materialId: item.id }))
  return {
    description: row.description,
    qtyUnit: row.qtyUnit ?? '',
    sizeLabel: row.sizeLabel ?? '',
    weight: row.weight ?? '',
    mainMaterial: row.mainMaterial ?? '',
    platingColor: row.platingColor ?? '',
    stockUnitPrice: moneyDigitsFromApi(row.unitCost),
    openingQty: row.openingQty || '0',
    bomLines: bomLines.length ? bomLines : [{ materialId: '' }],
  }
}

function todayYmd() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function FinishedGoodsStockDialog({
  open,
  kind,
  row,
  nameSuggestions,
  saving,
  onClose,
  onSaved,
}: {
  open: boolean
  kind: CrudDialogKind
  row: FinishedGoodsStockRow | null
  nameSuggestions: string[]
  saving: boolean
  onClose: () => void
  onSaved: (payload: UpsertReceiptPayload) => void
}) {
  const fullScreen = useIsMobile()
  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="lg"
    >
      {open ? (
        kind === 'view' && row ? (
          <StockView row={row} onClose={onClose} />
        ) : (
          <StockForm
            key={row?.id ?? 'create'}
            kind={kind}
            row={row}
            nameSuggestions={nameSuggestions}
            saving={saving}
            onClose={onClose}
            onSaved={onSaved}
          />
        )
      ) : null}
    </Dialog>
  )
}

function StockForm({
  kind,
  row,
  nameSuggestions,
  saving,
  onClose,
  onSaved,
}: {
  kind: CrudDialogKind
  row: FinishedGoodsStockRow | null
  nameSuggestions: string[]
  saving: boolean
  onClose: () => void
  onSaved: (payload: UpsertReceiptPayload) => void
}) {
  const profile = stockProfile(THANH_PHAM_WAREHOUSE)
  const readOnly = kind === 'view'
  const initial = useMemo(() => formValuesFromRow(row), [row])
  const form = useForm<FormValues>({ defaultValues: initial })
  const nvlOptions = useQuery({
    queryKey: ['finished-goods-nvl-options'],
    queryFn: () => listFinishedGoodsNvlOptionsApi(),
    staleTime: 60_000,
  })

  const nvlItems = useMemo(() => {
    const items = nvlOptions.data?.items ?? []
    const extra = (row?.bomLines ?? []).filter((item) => !items.some((opt) => opt.id === item.id))
    return extra.length ? [...extra, ...items] : items
  }, [nvlOptions.data?.items, row?.bomLines])

  const [editReason, setEditReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const openingQty = useWatch({ control: form.control, name: 'openingQty' })
  const stockUnitPrice = useWatch({ control: form.control, name: 'stockUnitPrice' })
  const mainMaterial = useWatch({ control: form.control, name: 'mainMaterial' })
  const platingColor = useWatch({ control: form.control, name: 'platingColor' })
  const firstNvlId = useWatch({ control: form.control, name: 'bomLines.0.materialId' })
  const showPlating = isSilverFgMaterial(mainMaterial)

  const inQty = row?.inQty ?? '0'
  const inAmount = row?.inAmount ?? '0'
  const outQty = row?.outQty ?? '0'
  const outAmount = row?.outAmount ?? '0'
  const openingAmount = String(Math.round((Number(openingQty) || 0) * (Number(stockUnitPrice) || 0)))
  const qty = String((Number(openingQty) || 0) + (Number(inQty) || 0) - (Number(outQty) || 0))
  const amount = String(
    Math.round((Number(openingAmount) || 0) + (Number(inAmount) || 0) - (Number(outAmount) || 0)),
  )

  useEffect(() => {
    setEditReason('')
    setReasonError('')
  }, [row?.id, kind])

  const filledNvlId = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (readOnly) return
    const nvl = nvlItems.find((item) => item.id === firstNvlId)
    if (firstNvlId && firstNvlId !== filledNvlId.current && nvl?.weight) {
      filledNvlId.current = firstNvlId
      form.setValue('weight', nvl.weight, { shouldDirty: true })
      return
    }
    if (firstNvlId && !form.getValues('weight') && nvl?.weight) {
      filledNvlId.current = firstNvlId
      form.setValue('weight', nvl.weight)
    }
    if (!firstNvlId && !row) {
      filledNvlId.current = undefined
      form.setValue('weight', '')
    }
  }, [firstNvlId, form, nvlItems, readOnly, row])

  function submit(values: FormValues) {
    if (readOnly) return
    if (row && !editReason.trim()) {
      setReasonError('Nhập lý do chỉnh sửa')
      return
    }
    const bomLines = values.bomLines
      .map((line) => line.materialId.trim())
      .filter(Boolean)
      .map((materialId) => ({ materialId }))
    onSaved({
      orderCode: row?.orderCode,
      description: values.description.trim(),
      mainMaterial: values.mainMaterial.trim() || undefined,
      platingColor: isSilverFgMaterial(values.mainMaterial) ? values.platingColor.trim() : '',
      stockUnitPrice: values.stockUnitPrice || '0',
      qty: row
        ? row.isOpening
          ? Number(values.openingQty) || 0
          : row.receivedQty
        : Number(values.openingQty) || 0,
      receivedAt: row ? row.receivedAt.slice(0, 10) : todayYmd(),
      sizeLabel: values.sizeLabel.trim() || undefined,
      weight: values.weight.trim() || null,
      qtyUnit: values.qtyUnit.trim() || undefined,
      bomLines,
      editReason: editReason.trim() || undefined,
    })
  }

  return (
    <Form form={form} onSubmit={submit}>
      <DialogTitle sx={{ pb: 0.5, fontWeight: 700 }}>
        {kind === 'view'
          ? `Chi tiết ${row?.description || profile.noun}`
          : row
            ? `Chỉnh sửa ${row.description || profile.noun}`
            : profile.createLabel}
      </DialogTitle>
      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          pt: 1,
          overflowX: 'hidden',
          pointerEvents: readOnly ? 'none' : undefined,
          '& .MuiFormLabel-asterisk':
            kind === 'view' ? { display: 'none' } : { color: 'error.main' },
        }}
      >
        <FormTextField<FormValues>
          name="description"
          label={profile.nameLabel}
          required
          autoFocus
          readOnly={readOnly}
          suggestions={nameSuggestions}
          helperText={row ? undefined : 'Gõ phần đầu — Tab hoặc click để nhận gợi ý'}
          sx={{ mt: 1.5 }}
          onBlur={() => {
            if (!String(form.getValues('description') ?? '').trim()) return
            void form.trigger('description')
          }}
          rules={{
            validate: (value) =>
              validateStockName(value, {
                existing: nameSuggestions,
                self: row?.description,
                label: profile.nameLabel,
              }),
          }}
        />
        <FormRow columns={3}>
          <FormSelect<FormValues>
            name="qtyUnit"
            label="Đơn vị"
            required
            placeholder="Chọn đơn vị…"
            options={finishedGoodsQtyUnitOptions(row?.qtyUnit)}
          />
          <FormTextField<FormValues> name="sizeLabel" label="Size" placeholder="7, US 10, 16cm…" />
          <FormQtyField<FormValues> name="weight" label="Trọng lượng (g)" placeholder="Nhập trọng lượng…" />
          <FormFgMaterialSelect name="mainMaterial" readOnly={readOnly} />
          {showPlating ? (
            <FormSelect<FormValues>
              name="platingColor"
              label="Màu xi"
              placeholder="Chọn màu xi…"
              clearable
              options={platingColorOptions(platingColor)}
            />
          ) : null}
          <FormMoneyField<FormValues>
            name="stockUnitPrice"
            label="Đơn giá tồn"
            slotProps={{
              htmlInput: { inputMode: 'numeric', style: { textAlign: 'right' } },
            }}
          />
        </FormRow>

        <BomLinesField options={nvlItems} loading={nvlOptions.isFetching} readOnly={readOnly} />

        <StockFigureGrid
          values={{ openingQty, openingAmount, inQty, inAmount, outQty, outAmount, qty, amount }}
          notes
          editableOpeningQty={
            readOnly || (row != null && !row.isOpening)
              ? undefined
              : {
                  value: openingQty,
                  onChange: (value) => form.setValue('openingQty', value),
                }
          }
        />
        <Typography variant="body2" sx={{ color: '#1e8449', fontWeight: 600, px: 0.25 }}>
          Tồn = Tồn đầu kỳ + Nhập − Xuất. SL {formatQty(qty)} · TT {formatMoney(amount)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.25, mt: -1 }}>
          TT đầu kỳ = SL × đơn giá tồn. Nhập / xuất / tồn kho lấy từ phiếu, không sửa tay.
        </Typography>
        {row ? (
          <EditReasonBlock
            entityType="fg_receipt"
            entityId={row.id}
            reason={editReason}
            onReasonChange={(value) => {
              setEditReason(value)
              if (value.trim()) setReasonError('')
            }}
            required={kind === 'edit'}
            error={kind === 'edit' ? reasonError : undefined}
            readOnly={kind === 'view'}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        {kind === 'view' ? (
          <Button onClick={onClose} variant="contained">
            Đóng
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" variant="contained" loading={saving} loadingPosition="start">
              {row ? 'Lưu' : profile.createLabel}
            </Button>
          </>
        )}
      </DialogActions>
    </Form>
  )
}

function StockView({ row, onClose }: { row: FinishedGoodsStockRow; onClose: () => void }) {
  const profile = stockProfile(THANH_PHAM_WAREHOUSE)
  const flow = FG_FLOW_STATUS[fgFlowStatus(row)]
  const bom = row.bomLines ?? []

  return (
    <>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography component="span" variant="h6" sx={{ fontWeight: 700, display: 'block' }}>
          Chi tiết {row.description || profile.noun}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {row.orderCode}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 0.5 }}>
        <Paper variant="outlined" sx={{ p: 1.75 }}>
          <SectionTitle>Thành phẩm</SectionTitle>
          <Box
            sx={{
              display: 'grid',
              gap: 1.75,
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' },
            }}
          >
            <Fact label={profile.skuLabel} value={row.orderCode} />
            <Fact label={profile.nameLabel} value={row.description} />
            <Fact label="Đơn vị" value={row.qtyUnit} />
            <Fact label="Size" value={row.sizeLabel} />
            <Fact label="Trọng lượng (g)" value={row.weight ? formatQty(row.weight) : null} />
            <Fact label="Chất liệu" value={row.mainMaterial} />
            {isSilverFgMaterial(row.mainMaterial) ? (
              <Fact label="Màu xi" value={row.platingColor} />
            ) : null}
            <Fact label="Đơn giá tồn" value={formatMoney(row.unitCost)} />
            <Fact
              label="Trạng thái kho"
              value={<Chip size="small" variant="outlined" color={flow.color} label={flow.label} />}
            />
            <Fact
              label="Trạng thái thành phẩm"
              value={
                <Chip
                  size="small"
                  variant="outlined"
                  label={row.costWarnings > 0 ? `${row.availabilityLabel} ⚠` : row.availabilityLabel}
                />
              }
            />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.75 }}>
          <SectionTitle>NVL cấu thành</SectionTitle>
          {bom.length ? (
            <NvlViewTable lines={bom} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Chưa gắn NVL
            </Typography>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.75 }}>
          <SectionTitle>Số liệu tồn</SectionTitle>
          <StockFigureGrid
            values={{
              openingQty: row.openingQty,
              openingAmount: row.openingAmount,
              inQty: row.inQty,
              inAmount: row.inAmount,
              outQty: row.outQty,
              outAmount: row.outAmount,
              qty: row.qty,
              amount: row.amount,
            }}
            notes
          />
          <Typography variant="body2" sx={{ color: '#1e8449', fontWeight: 600, mt: 1.5 }}>
            Tồn = Tồn đầu kỳ + Nhập − Xuất. SL {formatQty(row.qty)} · TT {formatMoney(row.amount)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            TT đầu kỳ = SL × đơn giá tồn. Nhập / xuất / tồn kho lấy từ phiếu, không sửa tay.
          </Typography>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Đóng
        </Button>
      </DialogActions>
    </>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25 }}>
      {children}
    </Typography>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  const empty = value == null || value === ''
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
        {empty ? '—' : value}
      </Typography>
    </Box>
  )
}

function dash(value: string | null | undefined) {
  const text = value?.trim()
  return text ? text : '—'
}

const NVL_COLS = [
  { key: 'sku', label: 'Mã' },
  { key: 'name', label: 'Tên' },
  { key: 'shape', label: 'Hình dạng' },
  { key: 'color', label: 'Màu sắc' },
  { key: 'type', label: 'Chất loại' },
  { key: 'metal', label: 'Chất liệu' },
  { key: 'qty', label: 'Tồn' },
  { key: 'unit', label: 'Đơn vị' },
  { key: 'size', label: 'Size' },
] as const

function NvlViewTable({ lines }: { lines: FinishedGoodsNvlOption[] }) {
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ '& th': { fontWeight: 700, whiteSpace: 'nowrap', bgcolor: '#f4f6f8' } }}>
        <TableHead>
          <TableRow>
            {NVL_COLS.map((col) => (
              <TableCell key={col.key} align={col.key === 'qty' ? 'right' : 'left'}>
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id} hover>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {line.imageUrl ? (
                    <Box
                      component="img"
                      src={cloudinaryThumb(line.imageUrl, 64)}
                      alt=""
                      sx={{
                        width: 32,
                        height: 32,
                        objectFit: 'cover',
                        borderRadius: 0.5,
                        border: '1px solid #ded3c3',
                      }}
                    />
                  ) : null}
                  <span>{dash(line.sku)}</span>
                </Stack>
              </TableCell>
              <TableCell sx={{ minWidth: 160 }}>{line.name}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{dash(line.shape)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{dash(line.color)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{dash(line.materialType)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{dash(line.bodyMetal || line.metalKind)}</TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatQty(line.qty)}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{dash(line.unit)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{dash(line.sizeLabel)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
