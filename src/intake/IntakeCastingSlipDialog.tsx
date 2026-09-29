import { useEffect, useMemo, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import type { IntakeOrder } from '../api/intakeOrders'
import { formatQty, parseQtyInput, qtyFromApi } from '../api/inventory'
import { QtyTextField } from '../components/ui/QtyTextField'
import type { OrderImage } from '../api/productionOrders'
import type { CreateCastingSlipsPayload } from '../api/castingSlips'
import { ImageUploadField } from '../orders/ImageUploadField'

function todayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function waxWeightLabel(order: IntakeOrder) {
  const raw = order.castingTreeWeightGram ?? order.productWeightGram
  if (raw == null || raw === '') return '—'
  const canonical = qtyFromApi(String(raw)) || String(raw)
  return `${formatQty(canonical)} g`
}

function parseOptionalGram(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = parseQtyInput(trimmed)
  if (!parsed) return NaN
  const n = Number(parsed)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

type FlaskDraft = {
  id: string
  s999: string
  hoi: string
  s925: string
  images: OrderImage[]
}

function emptyFlask(): FlaskDraft {
  return {
    id: crypto.randomUUID(),
    s999: '',
    hoi: '',
    s925: '',
    images: [],
  }
}

function flaskIssueTotal(flask: FlaskDraft) {
  const parts = [flask.s999, flask.hoi, flask.s925].map(parseOptionalGram)
  if (parts.some((n) => n != null && Number.isNaN(n))) return '—'
  const sum = parts.reduce<number>((acc, n) => acc + (n ?? 0), 0)
  return formatQty(String(sum))
}

type IntakeCastingSlipDialogProps = {
  order: IntakeOrder | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CreateCastingSlipsPayload) => void
}

export function IntakeCastingSlipDialog({
  order,
  saving,
  onClose,
  onSave,
}: IntakeCastingSlipDialogProps) {
  const [flasks, setFlasks] = useState<FlaskDraft[]>([emptyFlask()])
  const [uploadingFlaskIds, setUploadingFlaskIds] = useState<Set<string>>(() => new Set())
  const slipDateToday = todayIsoDate()

  useEffect(() => {
    if (order) {
      setFlasks([emptyFlask()])
      setUploadingFlaskIds(new Set())
    }
  }, [order])

  const anyUploading = uploadingFlaskIds.size > 0

  function patchFlask(id: string, patch: Partial<Omit<FlaskDraft, 'id'>>) {
    setFlasks((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function addFlask() {
    setFlasks((prev) => [...prev, emptyFlask()])
  }

  function removeFlask(id: string) {
    setFlasks((prev) => (prev.length <= 1 ? prev : prev.filter((f) => f.id !== id)))
    setUploadingFlaskIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function setFlaskUploading(id: string, uploading: boolean) {
    setUploadingFlaskIds((prev) => {
      const next = new Set(prev)
      if (uploading) next.add(id)
      else next.delete(id)
      if (next.size === prev.size && [...next].every((k) => prev.has(k))) return prev
      return next
    })
  }

  const submitLabel = useMemo(() => {
    if (saving) return 'Đang lưu…'
    if (flasks.length > 1) return `Lên ${flasks.length} phiếu đúc`
    return 'Lên lệnh đúc'
  }, [flasks.length, saving])

  function submit() {
    if (!order?.code) return
    const flasksPayload = flasks.map((flask) => {
      const issueS999Gram = parseOptionalGram(flask.s999)
      const issueMasterAlloyGram = parseOptionalGram(flask.hoi)
      const issueS925Gram = parseOptionalGram(flask.s925)
      if (
        [issueS999Gram, issueMasterAlloyGram, issueS925Gram].some(
          (n) => n != null && Number.isNaN(n),
        )
      ) {
        return null
      }
      return {
        issueS999Gram,
        issueMasterAlloyGram,
        issueS925Gram,
        images: flask.images.map(({ url, publicId, width, height }) => ({
          url,
          publicId,
          width,
          height,
        })),
      }
    })
    if (flasksPayload.some((row) => row == null)) return
    onSave({
      slipDate: todayIsoDate(),
      batchOrderCodes: order.code,
      flasks: flasksPayload as CreateCastingSlipsPayload['flasks'],
    })
  }

  const disabledCell = {
    bgcolor: 'action.hover',
    color: 'text.disabled',
  } as const

  const slipTableSx = {
    border: '2px solid',
    borderColor: 'grey.600',
    borderCollapse: 'collapse' as const,
    '& .MuiTableCell-root': {
      border: '1px solid',
      borderColor: 'grey.500',
      py: 1.25,
      px: 1.5,
    },
    '& .MuiTableHead-root .MuiTableCell-root': {
      bgcolor: 'grey.200',
      fontWeight: 700,
    },
  }

  return (
    <Dialog open={Boolean(order)} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Typography
          component="div"
          sx={{ textAlign: 'center', fontWeight: 800, letterSpacing: 1 }}
        >
          PHIẾU ĐÚC
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={addFlask}
            disabled={saving || anyUploading || flasks.length >= 20}
          >
            Thêm cối
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'space-between' }}
          >
            <TextField
              label="Ngày"
              type="date"
              size="small"
              value={slipDateToday}
              slotProps={{ inputLabel: { shrink: true }, input: { readOnly: true } }}
              disabled
              sx={{ maxWidth: 200 }}
            />
            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Mã phiếu (tự sinh khi lưu)
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {flasks.length > 1 ? `${flasks.length} × Dxxxx` : 'Dxxxx'}
              </Typography>
            </Box>
          </Stack>

          <TextField
            label="Mã đơn hàng trong lô đúc"
            size="small"
            fullWidth
            value={order?.code ?? ''}
            slotProps={{ input: { readOnly: true } }}
            disabled
            helperText="Lấy từ mã đơn hàng — không chỉnh sửa"
          />

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Trọng lượng sáp (cây thông) gia — lấy từ bước đã có sáp
            </Typography>
            <Typography variant="h6" component="p">
              {order ? waxWeightLabel(order) : '—'}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary">
            Mỗi cối = một phiếu đúc.
          </Typography>

          {flasks.map((flask, index) => (
            <Box
              key={flask.id}
              sx={{
                border: '2px solid',
                borderColor: 'grey.400',
                borderRadius: 1,
                p: 2,
                bgcolor: 'grey.50',
              }}
            >
              <Stack
                direction="row"
                sx={{ mb: 1.5, alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Cối {index + 1}
                </Typography>
                {flasks.length > 1 ? (
                  <IconButton
                    size="small"
                    aria-label={`Xóa cối ${index + 1}`}
                    onClick={() => removeFlask(flask.id)}
                    disabled={saving || anyUploading}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Stack>

              <Table size="small" sx={slipTableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell align="center" sx={{ width: '28%' }}>
                      Giao
                    </TableCell>
                    <TableCell align="center" sx={{ width: '28%' }}>
                      Trả
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Trọng lượng bạc S999 (gram)</TableCell>
                    <TableCell>
                      <QtyTextField
                        size="small"
                        fullWidth
                        placeholder="Nhập gram"
                        value={flask.s999}
                        onChange={(next) => patchFlask(flask.id, { s999: next })}
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell align="center" sx={disabledCell}>
                      —
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Trọng lượng Hội (gram)</TableCell>
                    <TableCell>
                      <QtyTextField
                        size="small"
                        fullWidth
                        placeholder="Nhập gram"
                        value={flask.hoi}
                        onChange={(next) => patchFlask(flask.id, { hoi: next })}
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell align="center" sx={disabledCell}>
                      —
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Trọng lượng S925 (gram)</TableCell>
                    <TableCell>
                      <QtyTextField
                        size="small"
                        fullWidth
                        placeholder="Nhập gram"
                        value={flask.s925}
                        onChange={(next) => patchFlask(flask.id, { s925: next })}
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell align="center" sx={disabledCell}>
                      —
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Tổng</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {flaskIssueTotal(flask)} g
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={disabledCell}>
                      (ghi tay trên phiếu)
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Box sx={{ mt: 2 }}>
                <ImageUploadField
                  label={`Ảnh phiếu đúc · cối ${index + 1}`}
                  kind="PRODUCT"
                  value={flask.images}
                  onChange={(images) => patchFlask(flask.id, { images })}
                  onUploadingChange={(up) => setFlaskUploading(flask.id, up)}
                />
              </Box>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving || anyUploading}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
