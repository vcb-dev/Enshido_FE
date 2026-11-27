import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createToolGroupApi, getToolGroupsApi, updateToolGroupApi, type ToolGroup } from '../../api/tools'
import { DataTable, RowActions, SearchInput, type Column } from '../../components/ui'

/**
 * Nhóm tài sản của kho dụng cụ (màn Danh mục): mã 2 chữ đứng trong mã TS (X + mã nhóm + MMYY + STT).
 * Nhóm đã có tài sản thì không đổi mã (tem đã dán theo mã cũ), chỉ đổi tên hoặc ẩn.
 */
export function ToolGroupsTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ToolGroup | null>(null)
  const [open, setOpen] = useState(false)
  const groups = useQuery({ queryKey: ['tools', 'groups', 'all'], queryFn: () => getToolGroupsApi(true) })

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (groups.data ?? []).filter(
      (row) => !needle || row.code.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle),
    )
  }, [groups.data, search])

  const columns = useMemo<Column<ToolGroup>[]>(
    () => [
      {
        key: 'code',
        header: 'Mã nhóm',
        width: 100,
        card: 'title',
        render: (row) => <Typography sx={{ fontWeight: 700, fontSize: 'inherit' }}>{row.code}</Typography>,
      },
      { key: 'name', header: 'Tên nhóm', render: (row) => row.name },
      {
        key: 'example',
        header: 'Mã TS mẫu',
        width: 130,
        render: (row) => (
          <Typography variant="body2" color="text.secondary">
            X{row.code}0425001
          </Typography>
        ),
      },
      { key: 'count', header: 'Số tài sản', width: 100, numeric: true, render: (row) => row._count.materials },
      {
        key: 'isActive',
        header: 'Trạng thái',
        width: 110,
        render: (row) => (
          <Chip size="small" variant="outlined" color={row.isActive ? 'success' : 'default'} label={row.isActive ? 'Đang dùng' : 'Đã ẩn'} />
        ),
      },
      {
        key: 'actions',
        header: '',
        width: 70,
        card: 'actions',
        render: (row) => (
          <RowActions
            onEdit={() => {
              setEditing(row)
              setOpen(true)
            }}
          />
        ),
      },
    ],
    [],
  )

  return (
    <Stack spacing={1} sx={{ flex: 1, minHeight: 0 }}>
      <Typography variant="body2" color="text.secondary">
        Dùng ở kho dụng cụ. Mã TS = X + mã nhóm + tháng/năm mua + STT (vd XBA0425001). Nhóm đã có tài sản chỉ đổi tên
        hoặc ẩn được, không đổi mã.
      </Typography>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={groups.isLoading}
        errorText={groups.error instanceof Error ? groups.error.message : undefined}
        emptyText={search.trim() ? 'Không có nhóm khớp tìm kiếm.' : 'Chưa có nhóm tài sản.'}
        variant="grid"
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã hoặc tên nhóm…" />
            <Stack sx={{ flex: 1 }} />
            <Button
              variant="contained"
              onClick={() => {
                setEditing(null)
                setOpen(true)
              }}
            >
              Thêm nhóm
            </Button>
          </>
        }
      />
      <ToolGroupDialog
        open={open}
        group={editing}
        onClose={() => setOpen(false)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ['tools', 'groups'] })}
      />
    </Stack>
  )
}

function ToolGroupDialog({
  open,
  group,
  onClose,
  onSaved,
}: {
  open: boolean
  group: ToolGroup | null
  onClose: () => void
  onSaved: () => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setCode(group?.code ?? '')
    setName(group?.name ?? '')
    setIsActive(group?.isActive ?? true)
  }, [open, group])

  const codeLocked = Boolean(group && group._count.materials > 0)
  const ready = /^[A-Z]{2}$/.test(code) && name.trim() !== ''
  const save = useMutation({
    mutationFn: () => {
      const payload = { code, name: name.trim(), isActive }
      return group ? updateToolGroupApi(group.id, payload) : createToolGroupApi(payload)
    },
    onSuccess: (row) => {
      toast.success(group ? `Đã cập nhật nhóm ${row.code}` : `Đã thêm nhóm ${row.code}`)
      onSaved()
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{group ? `Sửa nhóm ${group.code}` : 'Thêm nhóm tài sản'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            size="small"
            label="Mã nhóm (2 chữ)"
            required
            disabled={codeLocked}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
            helperText={codeLocked ? 'Nhóm đã có tài sản — không đổi mã.' : `Mã TS sẽ có dạng X${code || '__'}0425001`}
          />
          <TextField
            size="small"
            label="Tên nhóm"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
          {group ? (
            <FormControlLabel
              control={<Checkbox checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />}
              label="Đang dùng (bỏ tích để ẩn khỏi form Thêm tài sản)"
            />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="contained" disabled={!ready || save.isPending} loading={save.isPending} onClick={() => save.mutate()}>
          Lưu
        </Button>
      </DialogActions>
    </Dialog>
  )
}
