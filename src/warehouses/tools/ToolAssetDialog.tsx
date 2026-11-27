import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatMoney, getInventoryLookupsApi } from '../../api/inventory'
import {
  createToolAssetApi,
  getNextAssetCodeApi,
  getToolGroupsApi,
  TOOL_DEPARTMENTS,
  updateToolAssetApi,
  type ToolAsset,
  type ToolDepartment,
  type ToolGroup,
} from '../../api/tools'
import { AutocompleteInput, DateField } from '../../components/ui'
import { useIsMobile } from '../../hooks/useBreakpoint'
import { stockProfile, unitsForProfile } from '../catalog'
import { vnToday } from '../warehousePeriod'
import { invalidateToolQueries, TOOL_WAREHOUSE_CODE } from './toolQueries'

const decimalOf = (raw: string) => Number(raw.replace(',', '.'))
const digitsOf = (raw: string) => raw.replace(/\D/g, '')

/**
 * Thêm / sửa một tài sản của kho dụng cụ theo sổ tài sản xưởng: nhóm, ngày mua, mã TS (bỏ trống thì
 * hệ thống tự sinh X + mã nhóm + MMYY + STT), tên + hãng + cấu hình, đơn vị, SL, đơn giá mua, phòng
 * ban, đã dán mã, phân bổ Cty, ghi chú. SL / đơn giá khoá khi tài sản đã có phiếu.
 */
export function ToolAssetDialog({
  open,
  asset,
  onClose,
}: {
  open: boolean
  /** null = thêm mới. */
  asset: ToolAsset | null
  onClose: () => void
}) {
  const fullScreen = useIsMobile()
  const queryClient = useQueryClient()
  const today = vnToday()
  const [group, setGroup] = useState<ToolGroup | null>(null)
  const [purchasedAt, setPurchasedAt] = useState(today)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [unitId, setUnitId] = useState('')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [department, setDepartment] = useState<ToolDepartment | ''>('')
  const [labelStuck, setLabelStuck] = useState(false)
  const [allocation, setAllocation] = useState('')
  const [note, setNote] = useState('')

  const groups = useQuery({ queryKey: ['tools', 'groups'], queryFn: () => getToolGroupsApi(), enabled: open })
  const lookups = useQuery({
    queryKey: ['inventory-lookups'],
    queryFn: getInventoryLookupsApi,
    staleTime: 30 * 60_000,
    enabled: open,
  })
  const units = useMemo(
    () => unitsForProfile(stockProfile(TOOL_WAREHOUSE_CODE), lookups.data?.units ?? []),
    [lookups.data?.units],
  )

  useEffect(() => {
    if (!open) return
    setPurchasedAt(asset?.purchasedAt ?? vnToday())
    setCode(asset?.code ?? '')
    setName(asset?.name ?? '')
    setUnitId(asset?.unit.id ?? '')
    setQty(asset ? String(Number(asset.openingQty)) : '1')
    setPrice(asset && Number(asset.openingUnitPrice) ? String(Math.round(Number(asset.openingUnitPrice))) : '')
    setDepartment(asset?.department ?? '')
    setLabelStuck(asset?.labelStuck ?? false)
    setAllocation(asset?.companyAllocation ?? '')
    setNote(asset?.note ?? '')
  }, [open, asset])

  // Nhóm / đơn vị chọn sẵn khi danh sách về.
  useEffect(() => {
    if (!open) return
    setGroup(groups.data?.find((item) => item.id === asset?.group?.id) ?? null)
  }, [open, asset, groups.data])
  useEffect(() => {
    if (!open || unitId || units.length === 0) return
    setUnitId(units[0].id)
  }, [open, unitId, units])

  // Mã sẽ được cấp nếu để trống ô mã (chỉ khi thêm mới).
  const preview = useQuery({
    queryKey: ['tools', 'next-code', group?.id ?? '', purchasedAt],
    queryFn: () => getNextAssetCodeApi(group!.id, purchasedAt),
    enabled: open && !asset && Boolean(group) && Boolean(purchasedAt),
  })

  const qtyNumber = decimalOf(qty)
  const qtyValid = qty.trim() !== '' && Number.isFinite(qtyNumber) && qtyNumber > 0
  const priceNumber = price ? Number(price) : 0
  const ready = Boolean(group) && Boolean(purchasedAt) && name.trim() !== '' && Boolean(unitId) && qtyValid
  const locked = Boolean(asset?.locked)

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        groupId: group!.id,
        purchasedAt,
        code: code.trim() || null,
        name: name.trim(),
        unitId,
        qty: String(qtyNumber),
        unitPrice: price ? String(priceNumber) : null,
        department: department || null,
        labelStuck,
        companyAllocation: allocation.trim() || null,
        note: note.trim() || null,
      }
      return asset ? updateToolAssetApi(asset.id, payload) : createToolAssetApi(payload)
    },
    onSuccess: (row) => {
      toast.success(asset ? `Đã cập nhật tài sản ${row.code}` : `Đã thêm tài sản ${row.code}`)
      invalidateToolQueries(queryClient)
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle>{asset ? `Sửa tài sản ${asset.code ?? ''}` : 'Thêm tài sản'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '3fr 2fr' } }}>
            <AutocompleteInput
              label="Nhóm tài sản"
              required
              placeholder="Chọn nhóm"
              options={groups.data ?? []}
              value={group}
              onChange={setGroup}
              getOptionLabel={(option) => `${option.code} — ${option.name}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={groups.isLoading}
              noOptionsText="Chưa có nhóm — thêm ở Cấu hình › Danh mục › Nhóm tài sản"
            />
            <DateField
              size="small"
              label="Ngày mua"
              required
              value={purchasedAt}
              onChange={(next) => next && setPurchasedAt(next)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
            />
          </Box>
          <TextField
            size="small"
            label="Mã TS"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder={asset ? undefined : preview.data?.code ?? 'Chọn nhóm + ngày mua'}
            helperText={
              asset
                ? 'Đổi mã chỉ khi tem dán sai. Đổi nhóm / ngày mua không tự đổi mã.'
                : preview.data
                  ? `Để trống: hệ thống cấp ${preview.data.code}. Đồ cũ đã dán tem thì gõ đúng mã trên tem.`
                  : 'Để trống để hệ thống tự cấp. Đồ cũ đã dán tem thì gõ đúng mã trên tem.'
            }
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 30 } }}
          />
          <TextField
            size="small"
            label="Tên thiết bị + hãng + cấu hình"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            multiline
            slotProps={{ htmlInput: { maxLength: 300 } }}
          />
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1.4fr 1.4fr' } }}>
            <TextField
              select
              size="small"
              label="Đơn vị"
              required
              value={units.some((unit) => unit.id === unitId) ? unitId : ''}
              onChange={(event) => setUnitId(event.target.value)}
            >
              {units.map((unit) => (
                <MenuItem key={unit.id} value={unit.id}>
                  {unit.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Số lượng"
              required
              disabled={locked}
              value={qty}
              onChange={(event) => setQty(event.target.value.replace(/[^\d.,]/g, ''))}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
            <TextField
              size="small"
              label="Đơn giá mua"
              disabled={locked}
              value={price ? formatMoney(price) : ''}
              onChange={(event) => setPrice(digitsOf(event.target.value))}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
            <TextField
              size="small"
              label="Thành tiền"
              disabled
              value={qtyValid && priceNumber ? formatMoney(String(Math.round(qtyNumber * priceNumber))) : ''}
            />
          </Box>
          {locked ? (
            <Alert severity="info">
              Tài sản đã có phiếu nhập / xuất / giao người giữ nên SL và đơn giá ban đầu bị khoá. Mua thêm thì ghi ở
              tab Nhập.
            </Alert>
          ) : null}
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField
              select
              size="small"
              label="Phòng ban quản lý"
              value={department}
              onChange={(event) => setDepartment(event.target.value as ToolDepartment | '')}
            >
              <MenuItem value="">
                <Typography color="text.secondary">— Chưa chọn —</Typography>
              </MenuItem>
              {TOOL_DEPARTMENTS.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Phân bổ Cty"
              value={allocation}
              onChange={(event) => setAllocation(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
          </Box>
          <FormControlLabel
            control={<Checkbox checked={labelStuck} onChange={(event) => setLabelStuck(event.target.checked)} />}
            label="Đã dán tem mã TS lên tài sản"
          />
          <TextField
            size="small"
            label="Ghi chú"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="contained" disabled={!ready || save.isPending} loading={save.isPending} onClick={() => save.mutate()}>
          {asset ? 'Lưu' : 'Thêm tài sản'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
