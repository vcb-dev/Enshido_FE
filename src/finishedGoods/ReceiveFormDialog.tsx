import { useEffect, useMemo } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import {
  listFinishedGoodsOrderOptionsApi,
  type FinishedGoodsReceiptRow,
  type FinishedGoodsStockRow,
  type UpsertReceiptPayload,
} from '../api/finishedGoods'
import { formatMoney, formatQty, formatStockedDate } from '../api/inventory'
import {
  CrudDialogShell,
  FormQtyField,
  FormRow,
  FormSearchSelect,
  FormSelect,
  TextInput,
} from '../components/ui'
import { useIsMobile } from '../hooks/useBreakpoint'
import type { CrudDialogKind } from '../hooks/useCrudDialog'
import { useOperatorName } from '../hooks/useOperatorName'
import { DETAIL_GRID, DetailFact, DetailSection } from '../warehouses/detailView'
import { finishedGoodsQtyUnitOptions, stockProfile, THANH_PHAM_WAREHOUSE } from '../warehouses/catalog'

type FormValues = {
  orderCode: string
  qtyUnit: string
  qty: string
  receivedAt: string
  editReason?: string
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
  const fullScreen = useIsMobile()
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
    staleTime: 60_000,
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
    form.setValue('qty', '')
  }, [form, open, options.data?.items, orderCode, row])

  const selected = options.data?.items.find((item) => item.code === orderCode)
  const orderOptions = useMemo(() => {
    if (row) {
      return [{ id: row.orderCode, name: row.description || row.orderCode, secondary: row.orderCode }]
    }
    return (options.data?.items ?? []).map((item) => ({
      id: item.code,
      name: item.description || item.code,
      secondary: `${item.code} · tồn ${item.remainingQty ?? item.qty}`,
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
      receivedAt: todayYmd(),
      sizeLabel: (row?.sizeLabel ?? item?.sizeLabel)?.trim() || undefined,
      weight: row?.weight ?? item?.weight ?? undefined,
      qtyUnit: values.qtyUnit.trim() || undefined,
      editReason: values.editReason?.trim() || undefined,
    })
  }

  if (readOnly && row) {
    const qty = String('receivedQty' in row ? row.receivedQty : row.qty)
    const price = unitPriceOf(row)
    const amount = Number(qty) && Number(price) ? String(Math.round(Number(qty) * Number(price))) : row && 'amount' in row ? row.amount : ''
    return (
      <Dialog open={open} onClose={onClose} fullWidth fullScreen={fullScreen} maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>
          <Typography component="span" variant="h6" sx={{ fontWeight: 700, display: 'block' }}>
            Chi tiết phiếu nhập
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {row.orderCode} — {row.description}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 0.5 }}>
          <Paper variant="outlined" sx={{ p: 1.75 }}>
            <DetailSection>Phiếu nhập</DetailSection>
            <Box sx={DETAIL_GRID}>
              <DetailFact
                label={'status' in row && row.status === 'PENDING' ? 'Ngày tạo phiếu' : 'Ngày nhập'}
                value={formatStockedDate(row.receivedAt)}
              />
              <DetailFact
                label={'status' in row && row.status === 'PENDING' ? 'Người hoàn thiện' : 'Người nhập'}
                value={row.receivedByName}
              />
              {'status' in row ? (
                <DetailFact
                  label="Trạng thái"
                  value={row.status === 'PENDING' ? 'Chờ vào tồn' : 'Đã vào tồn'}
                />
              ) : null}
            </Box>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.75 }}>
            <DetailSection>Thành phẩm</DetailSection>
            <Box sx={DETAIL_GRID}>
              <DetailFact label={profile.skuLabel} value={row.orderCode} />
              <DetailFact label={profile.nameLabel} value={row.description} />
              <DetailFact label="Đơn vị" value={row.qtyUnit} />
              <DetailFact label="Size" value={row.sizeLabel} />
              <DetailFact label="Trọng lượng (g)" value={row.weight ? formatQty(row.weight) : ''} />
              <DetailFact label="Số lượng" value={formatQty(qty)} />
              {'pendingQty' in row && row.pendingQty > 0 ? (
                <DetailFact label="Chờ vào tồn" value={formatQty(String(row.pendingQty))} />
              ) : null}
              <DetailFact label="Đơn giá" value={price ? formatMoney(price) : ''} />
              <DetailFact label="Thành tiền" value={amount ? formatMoney(amount) : ''} />
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} variant="contained">
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    )
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
      editLog={row ? { entityType: 'fg_receipt', entityId: row.id } : undefined}
    >
      <FormRow columns={2} sx={{ mt: 1 }}>
        <FormSelect<FormValues>
          name="qtyUnit"
          label="Đơn vị tính"
          required
          readOnly={readOnly}
          placeholder="Chọn đơn vị…"
          options={finishedGoodsQtyUnitOptions(row?.qtyUnit ?? selected?.qtyUnit)}
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
          placeholder="Tìm thành phẩm trên Tồn…"
          noOptionsText="Chưa có hàng trên Tồn. Tạo trên tab Tồn trước."
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
