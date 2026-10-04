import { useState } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listCastingSlipsApi, type CastingSlip } from '../api/castingSlips'
import { canCutCastingSlip, getCastingSlipCutBlockedReason } from '../casting/castingCuts'

/** Chọn phiếu qua nhiều trang trước khi nhập số liệu cắt từng cây. */
export function CastingCutSelectionDialog({ initialSelection, onClose, onSelect }: {
  initialSelection: CastingSlip[]
  onClose: () => void
  onSelect: (slips: CastingSlip[]) => void
}) {
  const [selected, setSelected] = useState(initialSelection)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const list = useQuery({
    queryKey: ['casting-slips', 'cut-selection', search, page],
    queryFn: () => listCastingSlipsApi({ status: 'DONE', search, page, pageSize: 25 }),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
  const rows = (list.data?.items ?? []).flatMap((slip) => [slip, ...(slip.redos ?? [])])
    .filter((slip) => slip.status === 'DONE')
  const currentSelection = selected.map((slip) => rows.find((row) => row.id === slip.id) ?? slip)
  const toggle = (slip: CastingSlip) => setSelected((current) =>
    current.some((item) => item.id === slip.id)
      ? current.filter((item) => item.id !== slip.id)
      : current.length < 25 ? [...current, slip] : current,
  )

  return <Dialog open onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>Cắt cây thông — chọn phiếu đúc</DialogTitle>
    <DialogContent>
      <Stack spacing={1.5} sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Chọn một hoặc nhiều phiếu (tối đa 25). Sau khi lưu số liệu cắt, các đơn chuyển sang Chờ nguội.
        </Typography>
        <TextField label="Tìm mã phiếu hoặc mã đơn" value={search} size="small"
          onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
        {list.error ? <Alert severity="error">{list.error.message}</Alert> : null}
        {list.isFetching ? <Typography variant="body2">Đang tải phiếu đúc…</Typography> : null}
        {!list.isFetching && !list.error && !rows.length ? <Typography variant="body2">Chưa có phiếu đúc xong.</Typography> : null}
        {rows.map((slip) => {
          const checked = selected.some((item) => item.id === slip.id)
          const blocked = getCastingSlipCutBlockedReason(slip)
          return <Stack key={slip.id} direction="row" sx={{ alignItems: 'center' }}>
            <Checkbox checked={checked} disabled={list.isFetching || (!checked && (!!blocked || selected.length >= 25))}
              onChange={() => toggle(slip)}
              slotProps={{ input: { 'aria-label': `Chọn phiếu ${slip.code}` } }} />
            <Stack>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Phiếu {slip.code} · {slip.orders.length} đơn</Typography>
              <Typography variant="caption" color="text.secondary">{slip.batchOrderCodes}</Typography>
              {blocked ? <Typography variant="caption" color="text.secondary">{blocked}</Typography> : null}
            </Stack>
          </Stack>
        })}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center' }}>
          <Button disabled={page <= 1 || list.isFetching} onClick={() => setPage(page - 1)}>Trang trước</Button>
          <Typography variant="body2">Trang {page}</Typography>
          <Button disabled={list.isFetching || !list.data || page * 25 >= list.data.total} onClick={() => setPage(page + 1)}>Trang sau</Button>
        </Stack>
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Hủy</Button>
      <Button variant="contained" disabled={list.isFetching || !!list.error || !currentSelection.length || currentSelection.some((slip) => !canCutCastingSlip(slip))}
        onClick={() => onSelect(currentSelection)}>Tiếp tục ({selected.length} phiếu)</Button>
    </DialogActions>
  </Dialog>
}
