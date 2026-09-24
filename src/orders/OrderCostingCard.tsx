import { useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Link,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link as RouterLink } from 'react-router-dom'
import { toast } from 'sonner'
import { formatMoney, formatQty, formatStockedDate, moneyDigitsFromApi } from '../api/inventory'
import {
  addOrderCostApi,
  deleteOrderCostApi,
  getOrderCostingApi,
  updateOrderCostApi,
  updateStageLaborApi,
  type OrderCosting,
  type OrderCostPayload,
} from '../api/productionOrders'
import {
  CrudDialogShell,
  FormMoneyField,
  FormTextField,
  RowActions,
  StatRowSkeleton,
  SummaryStat,
  TableRowsSkeleton,
} from '../components/ui'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'

type OtherCost = OrderCosting['others'][number]
type LaborRow = OrderCosting['labor'][number]

const NUM = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as const

/**
 * Chi phí sản xuất của đơn: NVL xuất gắn đơn − bạc/BTP thu hồi + tiền công + chi phí khác.
 * Hao hụt bạc chỉ hiển thị để theo dõi — đã nằm trong bạc xuất.
 */
export function OrderCostingCard({ code, editable }: { code: string; editable: boolean }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<OtherCost | 'new' | null>(null)
  const [deleting, setDeleting] = useState<OtherCost | null>(null)
  const [editingLabor, setEditingLabor] = useState<LaborRow | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 0)
    return () => window.clearTimeout(id)
  }, [code])

  const costing = useQuery({
    queryKey: ['production-order-costing', code],
    queryFn: () => getOrderCostingApi(code),
    staleTime: 60_000,
    enabled: ready,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['production-order-costing', code] })

  const save = useMutation({
    mutationFn: (payload: OrderCostPayload) =>
      editing && editing !== 'new'
        ? updateOrderCostApi(code, editing.id, payload)
        : addOrderCostApi(code, payload),
    onSuccess: async () => {
      toast.success('Đã lưu chi phí')
      setEditing(null)
      await refresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const saveLabor = useMutation({
    mutationFn: ({
      row,
      amount,
      editReason,
    }: {
      row: LaborRow
      amount: string | null
      editReason?: string
    }) => updateStageLaborApi(code, row.stageEntryId, amount, editReason),
    onSuccess: async () => {
      toast.success('Đã lưu tiền công')
      setEditingLabor(null)
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['production-order', code] })])
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (cost: OtherCost) => deleteOrderCostApi(code, cost.id),
    onSuccess: async () => {
      toast.success('Đã xóa chi phí')
      setDeleting(null)
      await refresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const data = costing.data

  return (
    <Paper sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.25, gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Chi phí sản xuất
        </Typography>
        {editable ? (
          <Button size="small" variant="outlined" onClick={() => setEditing('new')}>
            Thêm chi phí khác
          </Button>
        ) : null}
      </Stack>

      {costing.error instanceof Error ? <Alert severity="error">{costing.error.message}</Alert> : null}
      {!data ? (
        costing.error ? null : (
          <Stack spacing={1.5}>
            <StatRowSkeleton />
            <TableRowsSkeleton rows={3} columns={5} />
            <TableRowsSkeleton rows={2} columns={5} />
          </Stack>
        )
      ) : (
        <Stack spacing={1.5}>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' } }}>
            <SummaryStat label="NVL xuất cho đơn" value={formatMoney(data.materialTotal)} tone="out" />
            <SummaryStat label="Tiền công" value={formatMoney(data.laborTotal)} />
            <SummaryStat label="Tổng chi phí" value={formatMoney(data.total)} tone="stock" />
            <SummaryStat label={`Giá vốn / sản phẩm (SL ${data.qty})`} value={formatMoney(data.unitCost)} tone="stock" />
          </Box>

          {data.warnings.map((warning) => (
            <Alert key={warning} severity="warning" sx={{ py: 0 }}>
              {warning}
            </Alert>
          ))}

          <Block title="NVL xuất cho đơn">
            {data.materials.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có phiếu xuất NVL gắn đơn này. Gắn ở{' '}
                <Link component={RouterLink} to="/warehouses/nvl-chinh/outbound">
                  Kho → Xuất
                </Link>{' '}
                bằng ô "Mã đơn SX".
              </Typography>
            ) : (
              <SimpleTable
                head={['Ngày', 'Kho', 'NVL', 'SL', 'Đơn giá', 'Thành tiền']}
                numericFrom={3}
                rows={data.materials.map((item) => [
                  formatStockedDate(item.issuedAt),
                  item.warehouseName,
                  `${item.name}${item.isSilver ? ' (bạc)' : ''}`,
                  `${formatQty(item.qty)} ${item.unit}`,
                  formatMoney(item.unitPrice),
                  formatMoney(item.amount),
                ])}
                footer={['Cộng NVL', formatMoney(data.materialTotal)]}
              />
            )}
          </Block>

          <Block title="Bạc">
            <Stack spacing={0.5}>
              <Line
                label={`Bạc xuất: ${formatQty(data.silver.grams)} g`}
                value={
                  data.silver.unitPrice ? `giá bình quân ${formatMoney(data.silver.unitPrice)} đ/g` : 'chưa có giá bạc'
                }
              />
              <Line
                label={`Trừ bạc + BTP thu hồi: ${formatQty(data.recovered.grams)} g`}
                value={Number(data.recovered.amount) > 0 ? `− ${formatMoney(data.recovered.amount)}` : '0'}
                strong
              />
              <Line
                label={`Hao hụt bạc (theo dõi, đã nằm trong bạc xuất): ${formatQty(data.silverLoss.grams)} g`}
                value={data.silverLoss.amount != null ? `≈ ${formatMoney(data.silverLoss.amount)}` : '—'}
                muted
              />
            </Stack>
          </Block>

          <Block title="Tiền công cho thợ">
            {data.labor.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có tiền công — nhập khi KCS nhận lại từng khâu.
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 280px' } }}>
                <TableContainer>
                  <Table size="small" sx={{ '& td, & th': { px: 1 } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Khâu</TableCell>
                        <TableCell>Thợ</TableCell>
                        <TableCell sx={NUM}>Tiền công</TableCell>
                        {editable ? <TableCell sx={{ width: 56 }} /> : null}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.labor.map((item) => (
                        <TableRow key={item.stageEntryId}>
                          <TableCell>
                            {item.stageLabel}
                            {item.attempt > 1 ? ` (lần ${item.attempt})` : ''}
                            {item.ticketCode ? ` · ${item.ticketCode}` : ''}
                          </TableCell>
                          <TableCell>{item.craftsmanName}</TableCell>
                          <TableCell sx={NUM}>{formatMoney(item.amount)}</TableCell>
                          {editable ? (
                            <TableCell>
                              <RowActions onEdit={() => setEditingLabor(item)} />
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={2} sx={{ fontWeight: 700 }}>
                          Cộng tiền công
                        </TableCell>
                        <TableCell sx={{ ...NUM, fontWeight: 700 }}>{formatMoney(data.laborTotal)}</TableCell>
                        {editable ? <TableCell /> : null}
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Cộng theo thợ
                  </Typography>
                  <SimpleTable
                    head={['Thợ', 'Số khâu', 'Tiền công']}
                    numericFrom={1}
                    rows={byCraftsman(data.labor).map((item) => [
                      item.name,
                      String(item.stages),
                      formatMoney(item.amount),
                    ])}
                    footer={['Cộng', formatMoney(data.laborTotal)]}
                  />
                </Box>
              </Box>
            )}
          </Block>

          <Block title="Chi phí khác">
            {data.others.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có (đúc thuê, 3D, thuê ngoài…).
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small" sx={{ '& td, & th': { px: 1 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Khoản</TableCell>
                      <TableCell>Ghi chú</TableCell>
                      <TableCell sx={NUM}>Số tiền</TableCell>
                      {editable ? <TableCell sx={{ width: 90 }} /> : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.others.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{item.note ?? '—'}</TableCell>
                        <TableCell sx={NUM}>{formatMoney(item.amount)}</TableCell>
                        {editable ? (
                          <TableCell>
                            <RowActions onEdit={() => setEditing(item)} onDelete={() => setDeleting(item)} />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={2} sx={{ fontWeight: 700 }}>
                        Cộng chi phí khác
                      </TableCell>
                      <TableCell sx={{ ...NUM, fontWeight: 700 }}>{formatMoney(data.otherTotal)}</TableCell>
                      {editable ? <TableCell /> : null}
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Block>

          <Box sx={{ p: 1.25, bgcolor: '#f8f3eb', borderRadius: 1 }}>
            <Typography variant="body2">
              Tổng chi phí = NVL {formatMoney(data.materialTotal)} − thu hồi {formatMoney(data.recovered.amount)} + tiền
              công {formatMoney(data.laborTotal)} + chi phí khác {formatMoney(data.otherTotal)} ={' '}
              <b>{formatMoney(data.total)}</b>
            </Typography>
          </Box>
        </Stack>
      )}

      <LaborCostDialog
        row={editingLabor}
        saving={saveLabor.isPending}
        onClose={() => setEditingLabor(null)}
        onSave={(amount, editReason) =>
          editingLabor && saveLabor.mutate({ row: editingLabor, amount, editReason })
        }
      />

      <OtherCostDialog
        cost={editing}
        saving={save.isPending}
        onClose={() => setEditing(null)}
        onSave={(payload) => save.mutate(payload)}
      />
      <ConfirmDeleteDialog
        open={deleting != null}
        title="Xóa chi phí"
        description={deleting ? `Xóa khoản "${deleting.name}" (${formatMoney(deleting.amount)})?` : ''}
        deleting={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </Paper>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="body2" color={muted ? 'text.secondary' : 'text.primary'}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        color={muted ? 'text.secondary' : 'text.primary'}
        sx={{ fontWeight: strong ? 700 : 400, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Stack>
  )
}

function SimpleTable({
  head,
  rows,
  footer,
  numericFrom,
}: {
  head: string[]
  rows: string[][]
  footer: [string, string]
  numericFrom: number
}) {
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ '& td, & th': { px: 1 } }}>
        <TableHead>
          <TableRow>
            {head.map((label, index) => (
              <TableCell key={label} sx={index >= numericFrom ? NUM : undefined}>
                {label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((cells, rowIndex) => (
            <TableRow key={rowIndex}>
              {cells.map((cell, index) => (
                <TableCell key={index} sx={index >= numericFrom ? NUM : undefined}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={head.length - 1} sx={{ fontWeight: 700 }}>
              {footer[0]}
            </TableCell>
            <TableCell sx={{ ...NUM, fontWeight: 700 }}>{footer[1]}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/** Gộp tiền công theo tên thợ — một thợ có thể làm nhiều khâu trên cùng đơn. */
function byCraftsman(labor: LaborRow[]) {
  const map = new Map<string, { name: string; stages: number; amount: number }>()
  for (const item of labor) {
    const current = map.get(item.craftsmanName)
    if (current) {
      current.stages += 1
      current.amount += Number(item.amount) || 0
    } else {
      map.set(item.craftsmanName, {
        name: item.craftsmanName,
        stages: 1,
        amount: Number(item.amount) || 0,
      })
    }
  }
  return [...map.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({ ...item, amount: String(item.amount) }))
}

type LaborValues = { amount: string; editReason?: string }

/** Sửa tiền công một khâu sau khi KCS đã nhận lại. Để trống = bỏ tiền công khâu đó. */
function LaborCostDialog({
  row,
  saving,
  onClose,
  onSave,
}: {
  row: LaborRow | null
  saving: boolean
  onClose: () => void
  onSave: (amount: string | null, editReason?: string) => void
}) {
  const form = useForm<LaborValues>({ defaultValues: { amount: '' } })

  useEffect(() => {
    if (!row) return
    form.reset({ amount: moneyDigitsFromApi(row.amount) })
  }, [row, form])

  return (
    <CrudDialogShell<LaborValues>
      open={row != null}
      kind="edit"
      titles={{
        create: 'Tiền công',
        edit: row ? `Tiền công — ${row.stageLabel} (${row.craftsmanName})` : 'Tiền công',
        view: 'Tiền công',
      }}
      form={form}
      onSubmit={(values) => onSave(values.amount || null, values.editReason)}
      saving={saving}
      maxWidth="xs"
      onClose={onClose}
      onExited={() => undefined}
      editLog={row ? { entityType: 'stage_labor', entityId: row.stageEntryId } : undefined}
    >
      <FormMoneyField<LaborValues> name="amount" label="Tiền công khâu (đ)" sx={{ mt: 1 }} />
      <Typography variant="caption" color="text.secondary">
        Để trống nếu khâu này chưa chốt tiền công.
      </Typography>
    </CrudDialogShell>
  )
}

type CostValues = { name: string; amount: string; note: string; editReason?: string }

function OtherCostDialog({
  cost,
  saving,
  onClose,
  onSave,
}: {
  cost: OtherCost | 'new' | null
  saving: boolean
  onClose: () => void
  onSave: (payload: OrderCostPayload) => void
}) {
  const form = useForm<CostValues>({ defaultValues: { name: '', amount: '', note: '' } })
  const editing = cost && cost !== 'new' ? cost : null

  useEffect(() => {
    if (!cost) return
    form.reset(
      editing
        ? { name: editing.name, amount: moneyDigitsFromApi(editing.amount), note: editing.note ?? '' }
        : { name: '', amount: '', note: '' },
    )
  }, [cost, editing, form])

  return (
    <CrudDialogShell<CostValues>
      open={cost != null}
      kind={editing ? 'edit' : 'create'}
      titles={{ create: 'Thêm chi phí khác', edit: 'Sửa chi phí', view: 'Chi phí' }}
      form={form}
      onSubmit={(values) =>
        onSave({
          name: values.name.trim(),
          amount: values.amount,
          note: values.note.trim() || undefined,
          editReason: values.editReason,
        })
      }
      saving={saving}
      maxWidth="xs"
      onClose={onClose}
      onExited={() => undefined}
      editLog={editing ? { entityType: 'order_cost', entityId: editing.id } : undefined}
    >
      <FormTextField<CostValues> name="name" label="Khoản chi phí" required placeholder="Đúc thuê, 3D…" sx={{ mt: 1 }} />
      <FormMoneyField<CostValues>
        name="amount"
        label="Số tiền"
        required
        rules={{ validate: (value) => Number(value) > 0 || 'Số tiền phải lớn hơn 0' }}
      />
      <FormTextField<CostValues> name="note" label="Ghi chú" multiline minRows={2} />
    </CrudDialogShell>
  )
}
