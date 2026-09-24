import { useEffect, useMemo } from 'react'
import { Alert, Box, Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { FinishedGoodsStockRow, ShipmentDetail, ShipmentPayload } from '../api/finishedGoods'
import { formatMoney, moneyDigitsFromApi } from '../api/inventory'
import { listOrderOptionsApi } from '../api/productionOrders'
import {
  CrudDialogShell,
  FormMoneyField,
  FormRow,
  FormSearchSelect,
  FormTextField,
  TrashIcon,
} from '../components/ui'
import { STATUS_META } from '../orders/catalog'
import { FormFreeSoloField } from '../orders/FreeSoloFields'

type LineValues = { orderCode: string; qty: string; unitPrice: string; note: string }

type OrderStockInfo = {
  remaining: number
  unitCost: string
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

const EMPTY_LINE: LineValues = { orderCode: '', qty: '1', unitPrice: '', note: '' }

function lineFromStock(orderCode: string | null | undefined, stock: FinishedGoodsStockRow[]): LineValues {
  const code = orderCode?.trim()
  if (!code) return { ...EMPTY_LINE }
  const row = stock.find((item) => item.orderCode === code)
  if (!row) return { ...EMPTY_LINE, orderCode: code }
  return {
    orderCode: code,
    qty: String(row.remainingQty >= 1 ? row.remainingQty : 1),
    unitPrice: moneyDigitsFromApi(row.unitCost),
    note: row.description,
  }
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

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
  const form = useForm<FormValues>({
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
              unitPrice: moneyDigitsFromApi(line.unitPrice),
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
    if (line.orderCode !== initialOrderCode || line.unitPrice) return
    const filled = lineFromStock(initialOrderCode, stock)
    if (!filled.unitPrice && filled.qty === '1') return
    form.setValue('lines.0.qty', filled.qty)
    form.setValue('lines.0.unitPrice', filled.unitPrice)
    form.setValue('lines.0.note', filled.note)
  }, [open, shipment, initialOrderCode, stock, form])

  // Khi sửa, SL của chính phiếu này được cộng lại vào tồn khả dụng.
  const available = useMemo(() => {
    const map = new Map<string, OrderStockInfo>()
    for (const row of stock) {
      map.set(row.orderCode, {
        remaining: row.remainingQty,
        unitCost: row.unitCost,
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
    form.setValue(`lines.${index}.unitPrice`, info ? moneyDigitsFromApi(info.unitCost) : '', {
      shouldDirty: true,
    })
    form.setValue(`lines.${index}.note`, info?.description || order?.description || '', {
      shouldDirty: true,
    })
  }

  const watched = useWatch({ control: form.control, name: 'lines' })
  const totals = (watched ?? []).reduce(
    (acc, line) => {
      const qty = Number(line.qty) || 0
      const cost = Number(available.get(line.orderCode)?.unitCost ?? 0)
      return {
        qty: acc.qty + qty,
        amount: acc.amount + qty * (Number(line.unitPrice) || 0),
        cost: acc.cost + qty * cost,
      }
    },
    { qty: 0, amount: 0, cost: 0 },
  )

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
        unitPrice: line.unitPrice,
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
          const qty = Number(line?.qty) || 0
          return (
            <Paper key={field.id} variant="outlined" sx={{ p: 1.25 }}>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.25,
                  alignItems: 'start',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2.2fr) 90px 160px minmax(0, 1fr) 150px 40px' },
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
                <FormMoneyField<FormValues> name={`lines.${index}.unitPrice`} label="Đơn giá bán" required />
                <FormTextField<FormValues> name={`lines.${index}.note`} label="Ghi chú dòng" />
                <Box sx={{ pt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Thành tiền: <b>{formatMoney(String(qty * (Number(line?.unitPrice) || 0)))}</b>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Chi phí: {info ? formatMoney(String(qty * Number(info.unitCost))) : '—'}
                  </Typography>
                </Box>
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
