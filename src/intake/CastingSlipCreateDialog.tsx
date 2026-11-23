import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useController, useWatch } from 'react-hook-form'
import { useAppForm } from '../components/ui/form/useAppForm'
import {
  listCastingSlipCandidatesApi,
  listCastWorkersApi,
  type CastCastWorkerOption,
  type CastingSlipCandidate,
  type CreateCastingSlipPayload,
} from '../api/castingSlips'
import { DialogForm, FormAutocomplete, FormCheckbox, SearchInput } from '../components/ui'
import { CastingSlipMetalTable } from './CastingSlipMetalTable'
import { silverEstimateFromWax } from './castingEstimate'
import { formatQty } from '../api/inventory'
import { useIsMobile } from '../hooks/useBreakpoint'
import { formatDateShort } from '../orders/catalog'
import { ImageLightbox, ZoomThumb } from '../components/ImageLightbox'
import { countPickedTrees, groupCandidatesByTree, type CastingTreeGroup } from './castingTreeGroups'

const TREE_THUMB = 40

type Values = {
  picked: CastingSlipCandidate[]
  assignedUserId: string | null
  isServiceCast: boolean
}

function emptyValues(): Values {
  return {
    picked: [],
    assignedUserId: null,
    isServiceCast: false,
  }
}

/**
 * Bước 7: thủ kho chọn cối (cây thông đã cấy ở bước Cấy cây thông) — tích cối là chọn đủ các đơn
 * trên cây (BE gom theo ảnh cây chụp chung lúc cấy). Đơn không có ảnh cây hiện riêng từng đơn. Gom vào một lần đúc, nhập bạc + hội cấp theo
 * định mức. Lưu xong phiếu ở Chờ cấp vật tư; cấp xong các đơn sang Chờ đúc (F).
 */
export function CastingSlipCreateDialog({
  open,
  preselectId,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  /** Mở từ nút "Lên lệnh đúc" trên một dòng đơn — tích sẵn đơn đó. */
  preselectId?: string | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CreateCastingSlipPayload) => void
}) {
  const fullScreen = useIsMobile()
  // Ô lọc danh sách đơn — không phải dữ liệu của phiếu nên không nằm trong form.
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [viewingTree, setViewingTree] = useState<CastingTreeGroup | null>(null)
  const form = useAppForm<Values>({ defaultValues: emptyValues() })
  const pickedField = useController({
    control: form.control,
    name: 'picked',
    rules: { validate: (value) => (value.length ? true : 'Chọn ít nhất một đơn đi đúc') },
  })

  const castWorkers = useQuery({
    queryKey: ['cast-workers'],
    queryFn: listCastWorkersApi,
    enabled: open,
    staleTime: 60_000,
  })

  const candidates = useQuery({
    queryKey: ['casting-slip-candidates', search],
    queryFn: () => listCastingSlipCandidatesApi(search),
    enabled: open,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!open) return
    setSearch('')
    setExpanded(new Set())
    setViewingTree(null)
    form.reset(emptyValues())
  }, [open, form])

  const rows = useMemo(() => candidates.data ?? [], [candidates.data])
  const groups = useMemo(() => groupCandidatesByTree(rows), [rows])

  // Tích sẵn cả cối chứa đơn được mở từ dòng Lệnh sản xuất khi danh sách tải về.
  useEffect(() => {
    if (!open || !preselectId || !candidates.data) return
    const group = groupCandidatesByTree(candidates.data).find((item) =>
      item.rows.some((row) => row.id === preselectId || (row.orderIds ?? []).includes(preselectId)),
    )
    if (!group) return
    const current = form.getValues('picked')
    const missing = group.rows.filter((row) => !current.some((item) => item.id === row.id))
    if (missing.length) form.setValue('picked', [...current, ...missing])
  }, [open, preselectId, candidates.data, form])

  const [picked, assignedUserId, isServiceCast] = useWatch({
    control: form.control,
    name: ['picked', 'assignedUserId', 'isServiceCast'],
  })
  useEffect(() => {
    if (isServiceCast && assignedUserId) form.setValue('assignedUserId', null)
  }, [isServiceCast, assignedUserId, form])
  const selected = useMemo(() => new Set(picked.map((row) => row.id)), [picked])
  const waxTotal = useMemo(
    () => picked.reduce((sum, row) => sum + Number(row.waxWeightGram ?? 0), 0),
    [picked],
  )
  const estimate = silverEstimateFromWax(waxTotal)
  const gramText = (value: number) => (value > 0 ? String(value) : null)
  const allVisibleChecked = rows.length > 0 && rows.every((row) => selected.has(row.id))
  const pickedTrees = countPickedTrees(picked)
  const formError = pickedField.fieldState.error?.message ?? form.formState.errors.root?.message

  function setPicked(next: CastingSlipCandidate[]) {
    pickedField.field.onChange(next)
  }

  /** Cả cối đúc chung một lần — tích / bỏ cối là tích / bỏ mọi đơn trên cây. */
  function toggleGroup(group: CastingTreeGroup, checked: boolean) {
    const ids = new Set(group.rows.map((row) => row.id))
    const rest = picked.filter((item) => !ids.has(item.id))
    setPicked(checked ? [...rest, ...group.rows] : rest)
  }

  function toggleExpanded(key: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    const ids = new Set(rows.map((row) => row.id))
    const rest = picked.filter((item) => !ids.has(item.id))
    setPicked(checked ? [...rest, ...rows] : rest)
  }

  function submit(values: Values) {
    const picked = silverEstimateFromWax(
      values.picked.reduce((sum, row) => sum + Number(row.waxWeightGram ?? 0), 0),
    )
    onSave({
      intakeOrderIds: values.picked.flatMap((row) => row.orderIds ?? [row.id]),
      isServiceCast: values.isServiceCast,
      assignedUserId: values.isServiceCast ? undefined : values.assignedUserId!,
      estimateS999Gram: picked.s999 || undefined,
      estimateMasterAlloyGram: picked.masterAlloy || undefined,
      estimateS925Gram: picked.s925 || undefined,
    })
  }

  const busy = saving
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="lg"
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            maxHeight: '90dvh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        },
      }}
    >
      <DialogTitle sx={{ flexShrink: 0 }}>Lên lệnh đúc</DialogTitle>
      <DialogForm form={form} onSubmit={submit}>
        <DialogContent
          dividers
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', minHeight: 0, flex: 1 }}
        >
          {/* Dòng cối cao hai dòng chữ — giữ khung danh sách đủ thấy vài cối, phần dưới cuộn theo dialog. */}
          <Stack spacing={1} sx={{ flex: 1, minHeight: { xs: 420, sm: 320 } }}>
            <Typography variant="subtitle2" sx={{ flexShrink: 0 }}>
              Chọn cối đã cấy cây thông
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, mt: '0 !important' }}>
              Tích một cối là chọn đủ các đơn trên cây đó — cả cối đúc chung một lần. Bấm mũi tên để xem từng đơn.
            </Typography>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Mã đơn, mã SX, mã SP, tên sản phẩm…"
              sx={{ maxWidth: 420, flexShrink: 0 }}
            />
            <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <Table size="small" stickyHeader sx={{ '& td, & th': { px: 1 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={{ bgcolor: 'background.paper' }}>
                      <Checkbox
                        size="small"
                        checked={allVisibleChecked}
                        indeterminate={!allVisibleChecked && rows.some((row) => selected.has(row.id))}
                        onChange={(event) => toggleAll(event.target.checked)}
                        disabled={!rows.length}
                        slotProps={{ input: { 'aria-label': 'Chọn tất cả cối' } }}
                      />
                    </TableCell>
                    <TableCell sx={{ bgcolor: 'background.paper' }}>Cối</TableCell>
                    <TableCell sx={{ bgcolor: 'background.paper' }}>Ảnh cây</TableCell>
                    <TableCell sx={{ bgcolor: 'background.paper' }}>Đơn trong cối</TableCell>
                    <TableCell align="right" sx={{ bgcolor: 'background.paper' }}>
                      SL
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: 'background.paper' }}>
                      TL sáp (g)
                    </TableCell>
                    <TableCell sx={{ bgcolor: 'background.paper' }}>Cần trả</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map((group) => {
                    const checkedCount = group.rows.filter((row) => selected.has(row.id)).length
                    const checked = checkedCount === group.rows.length
                    const isOpen = expanded.has(group.key)
                    const single = !group.tree
                    const first = group.rows[0]
                    return (
                      <Fragment key={group.key}>
                        <TableRow
                          hover
                          selected={checked}
                          onClick={() => toggleGroup(group, !checked)}
                          sx={{ cursor: 'pointer', '& > td': isOpen ? { borderBottom: 0 } : undefined }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={checked}
                              indeterminate={checkedCount > 0 && !checked}
                              slotProps={{
                                input: {
                                  'aria-label': group.tree ? `Chọn cối ${group.tree.no}` : `Chọn đơn ${first?.code}`,
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {group.tree ? (
                              <>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  Cối {group.tree.no}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {group.rows.length} đơn · cấy {formatDateShort(group.tree.graftedAt)}
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                Chưa có ảnh cây
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            {group.tree ? (
                              <ZoomThumb
                                url={group.tree.imageUrl}
                                size={TREE_THUMB}
                                label={`Xem ảnh cây cối ${group.tree.no}`}
                                onClick={() => setViewingTree(group)}
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {single && first ? (
                              <Typography variant="body2">
                                <Box component="span" sx={{ fontWeight: 700 }}>
                                  {first.code}
                                </Box>
                                {' · '}
                                {first.productName || '—'}
                              </Typography>
                            ) : (
                              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                                  {group.rows.map((row) => row.code).join(', ')}
                                </Typography>
                                <IconButton
                                  size="small"
                                  aria-label={isOpen ? 'Ẩn đơn trong cối' : 'Xem đơn trong cối'}
                                  aria-expanded={isOpen}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    toggleExpanded(group.key)
                                  }}
                                >
                                  {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                </IconButton>
                              </Stack>
                            )}
                          </TableCell>
                          <TableCell align="right">{group.qty}</TableCell>
                          <TableCell align="right">
                            {group.waxGram > 0 ? formatQty(String(group.waxGram)) : '—'}
                          </TableCell>
                          <TableCell>{group.dueDate ? formatDateShort(group.dueDate) : '—'}</TableCell>
                        </TableRow>
                        {isOpen
                          ? group.rows.map((row, index) => (
                              <TableRow
                                key={row.id}
                                sx={{
                                  bgcolor: 'action.hover',
                                  '& > td': {
                                    py: 0.5,
                                    borderBottom: index === group.rows.length - 1 ? undefined : 0,
                                  },
                                }}
                              >
                                <TableCell padding="checkbox" />
                                <TableCell colSpan={2} sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                  {row.sxCode}
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    <Box component="span" sx={{ fontWeight: 700 }}>
                                      {row.code}
                                    </Box>
                                    {row.trackingCode ? ` · ${row.trackingCode}` : ''}
                                    {' · '}
                                    {row.productName || '—'}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">{row.qty}</TableCell>
                                <TableCell align="right">
                                  {row.waxWeightGram ? formatQty(row.waxWeightGram) : '—'}
                                </TableCell>
                                <TableCell>{row.dueDate ? formatDateShort(row.dueDate) : '—'}</TableCell>
                              </TableRow>
                            ))
                          : null}
                      </Fragment>
                    )
                  })}
                  {!groups.length ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 2 }}>
                        {candidates.isFetching ? 'Đang tải…' : 'Không có cối nào đã cấy chờ đúc'}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="body2" sx={{ flexShrink: 0 }}>
              Đã chọn <strong>{pickedTrees}</strong> cối · <strong>{picked.length}</strong> đơn · Trọng lượng sáp
              (cây thông) giao: <strong>{formatQty(String(waxTotal))} g</strong>
            </Typography>
          </Stack>

          <FormCheckbox<Values>
            name="isServiceCast"
            label="Đúc dịch vụ"
            disabled={busy}
            helperText="Gửi ngoài xưởng — không giao thợ đúc trong hệ thống."
          />

          {isServiceCast ? null : (
            <FormAutocomplete<Values, CastCastWorkerOption>
              name="assignedUserId"
              valueKey="id"
              label="Giao cho thợ"
              required
              rules={{ required: isServiceCast ? false : 'Chọn thợ đúc được giao phiếu' }}
              options={castWorkers.data ?? []}
              getOptionLabel={(option) => option.fullName}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              loading={castWorkers.isLoading}
              disabled={busy}
              helperText={
                castWorkers.isError
                  ? 'Không tải được danh sách thợ đúc'
                  : !castWorkers.isLoading && (castWorkers.data?.length ?? 0) === 0
                    ? 'Chưa có tài khoản thợ đúc — tick quyền Thợ đúc ở Nhân sự.'
                    : 'Chỉ hiện nhân sự vai trò Thợ đúc (Nhân sự).'
              }
              noOptionsText="Không có thợ đúc"
            />
          )}

          <CastingSlipMetalTable
            estimateS999Gram={gramText(estimate.s999)}
            estimateMasterAlloyGram={gramText(estimate.masterAlloy)}
            estimateS925Gram={gramText(estimate.s925)}
            estimateTotalGram={gramText(estimate.total)}
          />
          <Typography variant="caption" color="text.secondary">
            Lưu và in phiếu trước. Thủ kho nhập trọng lượng thực xuất lúc cấp vật tư — để trống thì lấy số ước tính.
          </Typography>

          {formError ? <Alert severity="error">{formError}</Alert> : null}
        </DialogContent>
        <DialogActions sx={{ flexShrink: 0 }}>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={busy || (!isServiceCast && !assignedUserId)}>
            {saving ? 'Đang lưu…' : `Lưu và in phiếu (${picked.length} đơn)`}
          </Button>
        </DialogActions>
      </DialogForm>
      {viewingTree?.tree ? (
        <ImageLightbox
          images={[{ id: viewingTree.key, url: viewingTree.tree.imageUrl }]}
          index={0}
          title={`Ảnh cây thông — cối ${viewingTree.tree.no}`}
          onIndexChange={() => undefined}
          onClose={() => setViewingTree(null)}
        />
      ) : null}
    </Dialog>
  )
}
