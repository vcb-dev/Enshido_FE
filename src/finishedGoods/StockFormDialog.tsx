import { useEffect } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import type { FinishedGoodsStockRow, UpsertReceiptPayload } from '../api/finishedGoods'
import { formatMoney, formatQty, moneyDigitsFromApi } from '../api/inventory'
import {
  Form,
  FormMoneyField,
  FormRow,
  FormSelect,
  FormTextField,
} from '../components/ui'
import type { CrudDialogKind } from '../hooks/useCrudDialog'
import { useIsMobile } from '../hooks/useBreakpoint'
import { StockFigureGrid } from '../warehouses/StockFigureGrid'
import { stockProfile, THANH_PHAM_WAREHOUSE } from '../warehouses/catalog'

type FormValues = {
  description: string
  qtyUnit: string
  sizeLabel: string
  mainMaterial: string
  stockUnitPrice: string
  openingQty: string
}

const FG_MATERIALS = ['Bạc', 'Hội Pha', 'Đồng', 'Vàng'] as const

const EMPTY: FormValues = {
  description: '',
  qtyUnit: '',
  sizeLabel: '',
  mainMaterial: '',
  stockUnitPrice: '',
  openingQty: '0',
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
  const profile = stockProfile(THANH_PHAM_WAREHOUSE)
  const fullScreen = useIsMobile()
  const readOnly = kind === 'view'
  const form = useForm<FormValues>({ defaultValues: EMPTY })

  useEffect(() => {
    if (!open) return
    form.reset(
      row
        ? {
            description: row.description,
            qtyUnit: row.qtyUnit ?? '',
            sizeLabel: row.sizeLabel ?? '',
            mainMaterial: row.mainMaterial ?? '',
            stockUnitPrice: moneyDigitsFromApi(row.unitCost),
            openingQty: row.openingQty || '0',
          }
        : EMPTY,
    )
  }, [form, open, row])

  const openingQty = useWatch({ control: form.control, name: 'openingQty' })
  const stockUnitPrice = useWatch({ control: form.control, name: 'stockUnitPrice' })

  const inQty = row?.inQty ?? '0'
  const inAmount = row?.inAmount ?? '0'
  const outQty = row?.outQty ?? '0'
  const outAmount = row?.outAmount ?? '0'
  const openingAmount = String(Math.round((Number(openingQty) || 0) * (Number(stockUnitPrice) || 0)))
  const qty = String((Number(openingQty) || 0) + (Number(inQty) || 0) - (Number(outQty) || 0))
  const amount = String(
    Math.round((Number(openingAmount) || 0) + (Number(inAmount) || 0) - (Number(outAmount) || 0)),
  )

  function submit(values: FormValues) {
    if (readOnly) return
    onSaved({
      orderCode: row?.orderCode,
      description: values.description.trim(),
      mainMaterial: values.mainMaterial.trim() || undefined,
      stockUnitPrice: values.stockUnitPrice || '0',
      qty: row
        ? row.isOpening
          ? Number(values.openingQty) || 0
          : row.receivedQty
        : Number(values.openingQty) || 0,
      receivedAt: row ? row.receivedAt.slice(0, 10) : todayYmd(),
      sizeLabel: values.sizeLabel.trim() || undefined,
      qtyUnit: values.qtyUnit.trim() || undefined,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="md"
    >
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
          />
          <FormRow columns={3}>
            <FormSelect<FormValues>
              name="qtyUnit"
              label="Đơn vị"
              required
              placeholder="Chọn đơn vị…"
              options={[
                { value: 'gram', label: 'Gram' },
                { value: 'viên', label: 'Viên' },
              ]}
            />
            <FormTextField<FormValues> name="sizeLabel" label="Size" placeholder="7, US 10, 16cm…" />
            <FormSelect<FormValues>
              name="mainMaterial"
              label="Chất liệu"
              placeholder="Chọn chất liệu…"
              options={[
                ...FG_MATERIALS.map((value) => ({ value, label: value })),
                ...(row?.mainMaterial &&
                !(FG_MATERIALS as readonly string[]).includes(row.mainMaterial)
                  ? [{ value: row.mainMaterial, label: row.mainMaterial }]
                  : []),
              ]}
            />
            <FormMoneyField<FormValues>
              name="stockUnitPrice"
              label="Đơn giá tồn"
              slotProps={{
                htmlInput: { inputMode: 'numeric', style: { textAlign: 'right' } },
              }}
            />
          </FormRow>

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
    </Dialog>
  )
}
