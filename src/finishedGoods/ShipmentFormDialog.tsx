import { useEffect, useMemo } from 'react'
import { Alert, Box, Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useFieldArray, useWatch } from 'react-hook-form'
import { useAppForm } from '../components/ui/form/useAppForm'
import type { FinishedGoodsStockRow, ShipmentDetail, ShipmentPayload } from '../api/finishedGoods'
import { formatMoney } from '../api/inventory'
import { listOrderOptionsApi } from '../api/productionOrders'
import {
  CrudDialogShell,
  FormMoneyField,
  FormRow,
  FormSearchSelect,
  FormTextField,
  TextInput,
  TrashIcon,
} from '../components/ui'
import { STATUS_META } from '../orders/catalog'
import { FormFreeSoloField } from '../orders/FreeSoloFields'
import { gramOf, formatGram, invoiceAmount, invoiceComplete } from './invoice'

type LineValues = {
  orderCode: string
  qty: string
  /** Chỉ dùng khi đơn không tự tính được TL từ Xi. */
  weightGram: string
  materialUnitPrice: string
  laborAmount: string
  stoneAmount: string
  otherAmount: string
  note: string
}

type OrderStockInfo = {
  remaining: number
  unitCost: string
  netWeightPerUnit: string | null
  description: string
  sizeLabel: string | null
  mainMaterial: string | null
  qtyUnit: string | null
}

type FormValues = {
  shippedAt: string
  customerName: string
  paymentMethod: string
  note: string
  lines: LineValues[]
  editReason?: string
}

const EMPTY_LINE: LineValues = {
  orderCode: '',
  qty: '1',
  weightGram: '',
  materialUnitPrice: '',
  laborAmount: '',
  stoneAmount: '',
  otherAmount: '',
  note: '',
}

function lineFromStock(orderCode: string | null | undefined, stock: FinishedGoodsStockRow[]): LineValues {
  const code = orderCode?.trim()
  if (!code) return { ...EMPTY_LINE }
  const row = stock.find((item) => item.orderCode === code)
  if (!row) return { ...EMPTY_LINE, orderCode: code }
  return {
    ...EMPTY_LINE,
    orderCode: code,
    qty: String(row.remainingQty >= 1 ? row.remainingQty : 1),
    note: row.description,
  }
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

/** Số gram: chữ số, một dấu thập phân (nhận cả dấu phẩy), tối đa 2 số lẻ. */
function gramInput(value: string) {
  const [int = '', ...rest] = value.replace(',', '.').replace(/[^\d.]/g, '').split('.')
  return rest.length ? `${int}.${rest.join('').slice(0, 2)}` : int
}

/** Tiền từ API → chuỗi chữ số cho ô nhập; giữ "0" (tiền đá 0 là đã nhập), null là ô trống. */
function moneyInput(value: string | null) {
  return value == null ? '' : String(Math.round(Number(value)))
}

const MONEY_FIELDS = [
  ['materialUnitPrice', 'Đơn giá NL'],
  ['laborAmount', 'Tiền công'],
  ['stoneAmount', 'Tiền đá'],
  ['otherAmount', 'Chi phí khác'],
] as const

function todayYmd() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Lập / sửa phiếu xuất hàng thành phẩm. Mỗi dòng là một đơn còn hàng trong kho;
 * SL không vượt tồn còn lại, chi phí hiện theo giá vốn hiện tại (chụp lại khi lưu).
 */
export function ShipmentFormDialog({
  open,
  shipment,
  stock,
  customers,
  paymentMethods,
  initialOrderCode,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  /** `null` = lập phiếu mới. */
  shipment: ShipmentDetail | null
  stock: FinishedGoodsStockRow[]
  customers: string[]
  paymentMethods: string[]
  initialOrderCode?: string | null
  saving: boolean
  onClose: () => void
  onSave: (payload: ShipmentPayload) => void
}) {
  const form = useAppForm<FormValues>({
    defaultValues: { shippedAt: '', customerName: '', paymentMethod: '', note: '', lines: [EMPTY_LINE] },
  })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const ordersQuery = useQuery({
    queryKey: ['production-order-options'],
    queryFn: () => listOrderOptionsApi(),
    staleTime: 60_000,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    form.reset(
      shipment
        ? {
            shippedAt: shipment.shippedAt,
            customerName: shipment.customerName,
            paymentMethod: shipment.paymentMethod ?? '',
            note: shipment.note ?? '',
            lines: shipment.lines.map((line) => ({
              orderCode: line.orderCode,
              qty: String(line.qty),
              weightGram: line.weightGram ?? '',
              materialUnitPrice: moneyInput(line.materialUnitPrice),
              laborAmount: moneyInput(line.laborAmount),
              stoneAmount: moneyInput(line.stoneAmount),
              otherAmount: moneyInput(line.otherAmount),
              note: line.note ?? '',
            })),
          }
        : {
            shippedAt: todayYmd(),
            customerName: '',
            paymentMethod: '',
            note: '',
            lines: [lineFromStock(initialOrderCode, stock)],
          },
    )
  }, [open, shipment, initialOrderCode, form])

  useEffect(() => {
    if (!open || shipment || !initialOrderCode) return
    const line = form.getValues('lines.0')
    if (line.orderCode !== initialOrderCode || line.note) return
    const filled = lineFromStock(initialOrderCode, stock)
    if (!filled.note && filled.qty === '1') return
    form.setValue('lines.0.qty', filled.qty)
    form.setValue('lines.0.note', filled.note)
  }, [open, shipment, initialOrderCode, stock, form])

  // Khi sửa, SL của chính phiếu này được cộng lại vào tồn khả dụng.
  const available = useMemo(() => {
    const map = new Map<string, OrderStockInfo>()
    for (const row of stock) {
      map.set(row.orderCode, {
        remaining: row.remainingQty,
        unitCost: row.unitCost,
        netWeightPerUnit: row.netWeightPerUnit ?? null,
        description: row.description,
        sizeLabel: row.sizeLabel,
        mainMaterial: row.mainMaterial,
        qtyUnit: row.qtyUnit,
      })
    }
    for (const line of shipment?.lines ?? []) {
      const current = map.get(line.orderCode)
      map.set(line.orderCode, {
        remaining: (current?.remaining ?? 0) + line.qty,
        unitCost: current?.unitCost ?? line.unitCost,
        netWeightPerUnit: current?.netWeightPerUnit ?? line.netWeightPerUnit,
        description: current?.description ?? line.description,
        sizeLabel: current?.sizeLabel ?? line.sizeLabel,
        mainMaterial: current?.mainMaterial ?? line.mainMaterial,
        qtyUnit: current?.qtyUnit ?? null,
      })
    }
    return map
  }, [stock, shipment])

  const orderOptions = useMemo(() => {
    const seen = new Set<string>()
    const items = (ordersQuery.data ?? []).map((order) => {
      seen.add(order.code)
      return {
        id: order.code,
        name: order.code,
        secondary: `${STATUS_META[order.status].label} · ${order.description}`,
      }
    })
    for (const line of shipment?.lines ?? []) {
      if (seen.has(line.orderCode)) continue
      seen.add(line.orderCode)
      items.push({
        id: line.orderCode,
        name: line.orderCode,
        secondary: line.description,
      })
    }
    if (initialOrderCode && !seen.has(initialOrderCode)) {
      items.unshift({
        id: initialOrderCode,
        name: initialOrderCode,
        secondary: available.get(initialOrderCode)?.description ?? '',
      })
    }
    return items
  }, [available, initialOrderCode, ordersQuery.data, shipment])

  function applyOrder(index: number, code: string) {
    const info = available.get(code)
    const order = ordersQuery.data?.find((item) => item.code === code)
    form.setValue(`lines.${index}.qty`, String(info && info.remaining >= 1 ? info.remaining : 1), {
      shouldDirty: true,
    })
    form.setValue(`lines.${index}.note`, info?.description || order?.description || '', {
      shouldDirty: true,
    })
  }

  const watched = useWatch({ control: form.control, name: 'lines' })
  /** TL hệ thống tự tính (chỉ); null = đơn chưa có TL sau Xi, người lập nhập tay. */
  const autoWeight = (line: LineValues | undefined) =>
    line?.orderCode ? gramOf(available.get(line.orderCode)?.netWeightPerUnit, Number(line.qty) || 0) : null
  const invoiceOf = (line: LineValues) => ({
    weightGram: autoWeight(line) ?? line.weightGram,
    materialUnitPrice: line.materialUnitPrice,
    laborAmount: line.laborAmount,
    stoneAmount: line.stoneAmount,
    otherAmount: line.otherAmount,
  })
  const totals = (watched ?? []).reduce(
    (acc, line) => {
      const qty = Number(line.qty) || 0
      const cost = Number(available.get(line.orderCode)?.unitCost ?? 0)
      return {
        qty: acc.qty + qty,
        amount: acc.amount + invoiceAmount(invoiceOf(line)),
        cost: acc.cost + qty * cost,
      }
    },
    { qty: 0, amount: 0, cost: 0 },
  )
  const incomplete = (watched ?? []).filter((line) => line.orderCode && !invoiceComplete(invoiceOf(line))).length

  // Nhiều dòng cùng một đơn thì cộng dồn SL để so với tồn.
  const overStock = Array.from(
    (watched ?? []).reduce((map, line) => {
      if (line.orderCode) map.set(line.orderCode, (map.get(line.orderCode) ?? 0) + (Number(line.qty) || 0))
      return map
    }, new Map<string, number>()),
  ).filter(([code, qty]) => qty > (available.get(code)?.remaining ?? 0))

  function submit(values: FormValues) {
    if (overStock.length) return
    onSave({
      shippedAt: shipment?.shippedAt ?? todayYmd(),
      customerName: values.customerName.trim(),
      paymentMethod: values.paymentMethod.trim() || undefined,
      note: values.note.trim() || undefined,
      lines: values.lines.map((line) => ({
        orderCode: line.orderCode,
        qty: Number(line.qty),
        weightGram: autoWeight(line) ? undefined : line.weightGram || undefined,
        materialUnitPrice: line.materialUnitPrice || undefined,
        laborAmount: line.laborAmount || undefined,
        stoneAmount: line.stoneAmount || undefined,
        otherAmount: line.otherAmount || undefined,
        note: line.note.trim() || undefined,
      })),
      editReason: values.editReason?.trim() || undefined,
    })
  }

  const title = shipment ? `Sửa phiếu xuất ${shipment.code}` : 'Lập phiếu xuất hàng'

  return (
    <CrudDialogShell<FormValues>
      open={open}
      kind={shipment ? 'edit' : 'create'}
      titles={{ create: title, edit: title, view: title }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitDisabled={overStock.length > 0}
      submitLabel={shipment ? 'Lưu' : 'Lập phiếu'}
      maxWidth="lg"
      onClose={onClose}
      onExited={() => undefined}
      editLog={shipment ? { entityType: 'fg_shipment', entityId: shipment.code } : undefined}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, mt: 1 }}>
        Hàng xuất
      </Typography>

      <Stack spacing={1}>
        {lines.fields.map((field, index) => {
          const line = watched?.[index]
          const info = line?.orderCode ? available.get(line.orderCode) : undefined
          const auto = autoWeight(line)
          return (
            <Paper key={field.id} variant="outlined" sx={{ p: 1.25 }}>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.25,
                  alignItems: 'start',
                  gridTemplateColumns: {
                    xs: '1fr 1fr',
                    md: 'minmax(0, 2fr) 72px 96px repeat(4, minmax(0, 1fr)) 40px',
                  },
                  '& > :first-of-type': { gridColumn: { xs: '1 / -1', md: 'auto' } },
                }}
              >
                <FormSearchSelect<FormValues>
                  name={`lines.${index}.orderCode`}
                  label="Mã đơn SX"
                  options={orderOptions}
                  required
                  placeholder="Chọn đơn sản xuất…"
                  noOptionsText="Không có đơn sản xuất"
                  onPicked={(code) => applyOrder(index, code)}
                />
                <FormTextField<FormValues>
                  name={`lines.${index}.qty`}
                  label="SL"
                  required
                  transform={digitsOnly}
                  slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                  rules={{
                    validate: (value) => {
                      const next = Number(value) || 0
                      if (next < 1) return 'Từ 1'
                      if (info && next > info.remaining) return `Còn ${info.remaining}`
                      return true
                    },
                  }}
                />
                {auto ? (
                  <Tooltip title="(TL sau Xi − TL đá) × 0,95">
                    <span>
                      <TextInput label="TL (g)" value={formatGram(auto)} readOnly />
                    </span>
                  </Tooltip>
                ) : (
                  <FormTextField<FormValues>
                    name={`lines.${index}.weightGram`}
                    label="TL (g)"
                    transform={gramInput}
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  />
                )}
                {MONEY_FIELDS.map(([key, label]) => (
                  <FormMoneyField<FormValues> key={key} name={`lines.${index}.${key}`} label={label} />
                ))}
                <Tooltip title="Bỏ dòng">
                  <span>
                    <IconButton
                      aria-label="Bỏ dòng"
                      color="error"
                      disabled={lines.fields.length === 1}
                      onClick={() => lines.remove(index)}
                    >
                      <TrashIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.25,
                  mt: 1,
                  alignItems: 'center',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                }}
              >
                <FormTextField<FormValues> name={`lines.${index}.note`} label="Ghi chú dòng" />
                <Typography variant="body2" sx={{ textAlign: { md: 'right' } }}>
                  Thành tiền: <b>{line ? formatMoney(String(invoiceAmount(invoiceOf(line)))) : '0'}</b>
                  <Typography component="span" variant="caption" color="text.secondary">
                    {' '}
                    · Chi phí: {info ? formatMoney(String(Math.round((Number(line?.qty) || 0) * Number(info.unitCost)))) : '—'}
                  </Typography>
                </Typography>
              </Box>
              {info ? (
                <Typography variant="caption" color="text.secondary">
                  {[
                    info.description,
                    info.sizeLabel ? `size ${info.sizeLabel}` : null,
                    info.mainMaterial,
                    `còn ${info.remaining}${info.qtyUnit ? ` ${info.qtyUnit}` : ''} trong kho`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              ) : line?.orderCode ? (
                <Typography variant="caption" color="warning.main">
                  Đơn chưa vào kho thành phẩm — không xuất được cho đến khi có tồn.
                </Typography>
              ) : null}
            </Paper>
          )
        })}
      </Stack>

      <Button size="small" onClick={() => lines.append(EMPTY_LINE)} sx={{ alignSelf: 'flex-start' }}>
        + Thêm dòng
      </Button>

      <FormRow columns={3}>
        <FormFreeSoloField<FormValues> name="customerName" label="Khách hàng" required options={customers} />
        <FormFreeSoloField<FormValues>
          name="paymentMethod"
          label="Hình thức thanh toán"
          options={paymentMethods}
        />
        <FormTextField<FormValues> name="note" label="Ghi chú phiếu" />
      </FormRow>

      {incomplete > 0 ? (
        <Alert severity="info" sx={{ py: 0 }}>
          Còn {incomplete} dòng chưa đủ TL, đơn giá NL, tiền công, tiền đá, chi phí khác — vẫn lưu được nhưng chưa in
          được. Khoản không có thì nhập 0.
        </Alert>
      ) : null}

      {overStock.map(([code, qty]) => (
        <Alert key={code} severity="error" sx={{ py: 0 }}>
          Đơn {code} xuất tổng {qty} nhưng chỉ còn {available.get(code)?.remaining ?? 0} trong kho.
        </Alert>
      ))}

      <Box sx={{ p: 1.25, bgcolor: '#f8f3eb', borderRadius: 1 }}>
        <Typography variant="body2">
          Tổng SL <b>{totals.qty}</b> · Thành tiền <b>{formatMoney(String(totals.amount))}</b> · Chi phí (giá vốn
          hiện tại) <b>{formatMoney(String(Math.round(totals.cost)))}</b>
        </Typography>
      </Box>
    </CrudDialogShell>
  )
}
