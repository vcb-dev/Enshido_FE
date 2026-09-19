import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import {
  listFinishedGoodsOrderOptionsApi,
  type FinishedGoodsReceiptRow,
  type FinishedGoodsStockRow,
  type UpsertReceiptPayload,
} from '../api/finishedGoods'
import { formatMoney } from '../api/inventory'
import {
  CrudDialogShell,
  FormQtyField,
  FormRow,
  FormSearchSelect,
  FormSelect,
  FormTextField,
  TextInput,
} from '../components/ui'
import type { CrudDialogKind } from '../hooks/useCrudDialog'
import { useOperatorName } from '../hooks/useOperatorName'
import { stockProfile, THANH_PHAM_WAREHOUSE } from '../warehouses/catalog'

type FormValues = {
  orderCode: string
  qtyUnit: string
  qty: string
  receivedAt: string
}

function todayYmd() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function unitPriceOf(row: FinishedGoodsStockRow | FinishedGoodsReceiptRow | null) {
  if (!row) return ''
  if ('unitPrice' in row) return row.unitPrice
  return row.unitCost
}

export function ReceiveFormDialog({
  open,
  kind = 'create',
  row,
  saving,
  onClose,
  onSaved,
}: {
  open: boolean
  kind?: CrudDialogKind
  row: FinishedGoodsStockRow | FinishedGoodsReceiptRow | null
  saving: boolean
  onClose: () => void
  onSaved: (payload: UpsertReceiptPayload) => void
}) {
  const profile = stockProfile(THANH_PHAM_WAREHOUSE)
  const operatorName = useOperatorName()
  const readOnly = kind === 'view'
  const form = useForm<FormValues>({
    defaultValues: {
      orderCode: '',
      qtyUnit: '',
      qty: '',
      receivedAt: todayYmd(),
    },
  })
  const options = useQuery({
    queryKey: ['finished-goods-order-options'],
    queryFn: () => listFinishedGoodsOrderOptionsApi(),
    enabled: open && !row,
    staleTime: 15_000,
  })
  const orderCode = useWatch({ control: form.control, name: 'orderCode' })
  const qty = useWatch({ control: form.control, name: 'qty' })

  useEffect(() => {
    if (!open) return
    form.reset(
      row
        ? {
            orderCode: row.orderCode,
            qtyUnit: row.qtyUnit ?? '',
            qty: String('receivedQty' in row ? row.receivedQty : row.qty),
            receivedAt: row.receivedAt.slice(0, 10),
          }
        : {
            orderCode: '',
            qtyUnit: '',
            qty: '',
            receivedAt: todayYmd(),
          },
    )
  }, [form, open, row])

  useEffect(() => {
    if (!open || row) return
    const item = options.data?.items.find((option) => option.code === orderCode)
    if (!item) {
      if (!orderCode) {
        form.setValue('qtyUnit', '')
        form.setValue('qty', '')
      }
      return
    }
    form.setValue('qtyUnit', item.qtyUnit ?? '')
    form.setValue('qty', String(item.qty))
  }, [form, open, options.data?.items, orderCode, row])

  const selected = options.data?.items.find((item) => item.code === orderCode)
  const orderOptions = useMemo(() => {
    if (row) {
      return [{ id: row.orderCode, name: row.description || row.orderCode, secondary: row.orderCode }]
    }
    return (options.data?.items ?? []).map((item) => ({
      id: item.code,
      name: item.description || item.code,
      secondary: item.code,
    }))
  }, [options.data?.items, row])

  const unitPrice = unitPriceOf(row)
  const amount = useMemo(() => {
    const q = Number(qty)
    const p = Number(unitPrice)
    if (Number.isFinite(q) && Number.isFinite(p) && p) return String(Math.round(q * p))
    return ''
  }, [qty, unitPrice])

  function submit(values: FormValues) {
    if (kind === 'view') return
    const item = options.data?.items.find((option) => option.code === values.orderCode)
    onSaved({
      orderCode: values.orderCode,
      qty: Number(values.qty),
      receivedAt: values.receivedAt,
      sizeLabel: (row?.sizeLabel ?? item?.sizeLabel)?.trim() || undefined,
      qtyUnit: values.qtyUnit.trim() || undefined,
    })
  }

  return (
    <CrudDialogShell<FormValues>
      open={open}
      kind={kind}
      titles={{
        create: profile.inboundLabel,
        edit: `Chỉnh sửa ${profile.noun}`,
        view: `Chi tiết ${profile.noun}`,
      }}
      form={form}
      onSubmit={submit}
      saving={saving}
      submitLabel={kind === 'create' ? profile.inboundLabel : undefined}
      onClose={onClose}
      onExited={() => undefined}
    >
      <FormRow columns={3} sx={{ mt: 1 }}>
        <FormTextField<FormValues>
          name="receivedAt"
          label="Ngày nhập"
          type="date"
          required
          readOnly={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormSelect<FormValues>
          name="qtyUnit"
          label="Đơn vị tính"
          required
          readOnly={readOnly}
          placeholder="Chọn đơn vị…"
          options={[
            { value: 'gram', label: 'Gram' },
            { value: 'viên', label: 'Viên' },
          ]}
        />
        <TextInput label="Người nhập" value={row?.receivedByName || operatorName || '—'} readOnly />
      </FormRow>

      <FormRow>
        <FormSearchSelect<FormValues>
          name="orderCode"
          label={profile.nameLabel}
          options={orderOptions}
          required
          readOnly={Boolean(row) || readOnly}
          displayValue={row?.description}
          allowClear={!row && !readOnly}
          placeholder="Tìm tên thành phẩm…"
          noOptionsText="Không còn đơn nào chưa vào kho"
        />
        <TextInput label={profile.skuLabel} value={orderCode || '—'} readOnly />
      </FormRow>

      <FormRow columns={3}>
        <FormQtyField<FormValues>
          name="qty"
          label="Số lượng"
          required
          readOnly={readOnly}
          rules={{
            validate: (value) => {
              const next = Number(value) || 0
              if (next <= 0) return 'Số lượng phải lớn hơn 0'
              if (!Number.isInteger(next)) return 'Số lượng phải là số nguyên'
              return true
            },
          }}
        />
        <TextInput
          label="Đơn giá"
          value={unitPrice ? formatMoney(unitPrice) : ''}
          readOnly
          helperText={selected || row ? 'Theo giá vốn đơn' : undefined}
        />
        <TextInput label="Thành tiền" value={amount ? formatMoney(amount) : ''} readOnly />
      </FormRow>
    </CrudDialogShell>
  )
}
