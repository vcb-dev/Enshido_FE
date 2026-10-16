import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  createCatalogApi,
  deleteCatalogApi,
  listCatalogsApi,
  updateCatalogApi,
  type CatalogItem,
  type CatalogKind,
} from '../api/catalogs'
import {
  CrudDialogShell,
  DataTable,
  FormEditReasonBlock,
  Form,
  FormTextField,
  RowActions,
  SearchInput,
  type Column,
} from '../components/ui'
import { useCrudDialog } from '../hooks/useCrudDialog'
import { useDeleteRowDialog } from '../hooks/useDeleteRowDialog'
import { paginate, useTableParams } from '../hooks/useTableParams'
import { ConfirmDeleteDialog } from '../warehouses/ConfirmDeleteDialog'

const BRAND = '#6b4513'
const BORDER = '#ded3c3'

type FormValues = { name: string; editReason?: string }
const EMPTY: FormValues = { name: '' }

type Copy = {
  kind: CatalogKind
  title: string
  chip: string
  hint: string
  addParent: string
  search: string
  empty: string
  notFound: string
  parentName: string
  childSection: string
  childName: string
  addChild: string
  searchChild: string
  emptyChild: string
  editTitle: (name: string) => string
  addedParent: string
  savedParent: string
  deletedParent: string
  addedChild: string
  savedChild: string
  deletedChild: string
  deleteParentHint: (name: string) => string
  deleteChildHint: (name: string) => string
}

const NVL_COPY: Copy = {
  kind: 'CATALOG',
  title: 'Danh mục NVL',
  chip: 'Danh mục to',
  hint: 'Dùng trên kho NVL. Bấm bút chì để đổi tên danh mục to và quản lý danh mục con.',
  addParent: 'Thêm danh mục',
  search: 'Tìm danh mục to hoặc danh mục con…',
  empty: 'Chưa có danh mục. Bấm Thêm danh mục để tạo danh mục to.',
  notFound: 'Không tìm thấy danh mục.',
  parentName: 'Tên danh mục to',
  childSection: 'Danh mục con',
  childName: 'Tên danh mục con',
  addChild: 'Thêm danh mục con',
  searchChild: 'Tìm danh mục con…',
  emptyChild: 'Chưa có danh mục con. Bấm Thêm danh mục con.',
  editTitle: (name) => `Sửa danh mục ${name}`,
  addedParent: 'Đã thêm danh mục',
  savedParent: 'Đã cập nhật danh mục',
  deletedParent: 'Đã xóa danh mục',
  addedChild: 'Đã thêm danh mục con',
  savedChild: 'Đã cập nhật danh mục con',
  deletedChild: 'Đã xóa danh mục con',
  deleteParentHint: (name) => `Xóa “${name}”? Cần xóa hết danh mục con trước.`,
  deleteChildHint: (name) => `Xóa “${name}”? NVL đang dùng sẽ để trống trường này.`,
}

const BTP_COPY: Copy = {
  ...NVL_COPY,
  kind: 'OTHER',
  title: 'Danh mục BTP',
  hint: 'Dùng trên kho BTP: Chất liệu, Danh mục BTP, Phân loại sản phẩm. Bấm bút chì để quản lý danh mục con.',
  deleteChildHint: (name) => `Xóa “${name}”? BTP đang dùng sẽ để trống trường này.`,
}

export function CatalogsPage() {
  const [tab, setTab] = useState<CatalogKind>('CATALOG')
  const copy = tab === 'OTHER' ? BTP_COPY : NVL_COPY
  return (
    <Stack spacing={2} sx={{ minHeight: 0, flex: 1 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5">Danh mục</Typography>
        <Typography variant="body2" color="text.secondary">
          Tách riêng danh mục NVL và danh mục BTP vì hai kho dùng bộ giá trị khác nhau.
        </Typography>
      </Stack>
      <Tabs
        value={tab}
        onChange={(_event, next: CatalogKind) => setTab(next)}
        sx={{
          minHeight: 36,
          borderBottom: `1px solid ${BORDER}`,
          '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontWeight: 600 },
        }}
      >
        <Tab value="CATALOG" label="Danh mục NVL" />
        <Tab value="OTHER" label="Danh mục BTP" />
      </Tabs>
      <CatalogTreePage key={tab} copy={copy} />
    </Stack>
  )
}

function CatalogTreePage({ copy }: { copy: Copy }) {
  const queryClient = useQueryClient()
  const table = useTableParams({ pageSize: 25, sort: 'name' })
  const { params } = table
  const [editId, setEditId] = useState<string | null>(null)
  const createParent = useCrudDialog<CatalogItem>()
  const parentForm = useForm<FormValues>({ defaultValues: EMPTY })

  const list = useQuery({
    queryKey: ['catalogs', copy.kind],
    queryFn: () => listCatalogsApi(copy.kind),
    staleTime: 5 * 60_000,
  })

  const parents = list.data ?? []
  const editing = parents.find((row) => row.id === editId) ?? null

  const visibleParents = useMemo(() => {
    const q = params.search.trim().toLowerCase()
    const matched = q
      ? parents.filter(
          (row) =>
            row.name.toLowerCase().includes(q) ||
            (row.children ?? []).some((child) => child.name.toLowerCase().includes(q)),
        )
      : parents
    const direction = params.dir === 'desc' ? -1 : 1
    return [...matched].sort((a, b) => {
      if (params.sort === 'childCount') {
        return ((a.children?.length ?? 0) - (b.children?.length ?? 0)) * direction
      }
      return a.name.localeCompare(b.name, 'vi') * direction
    })
  }, [parents, params.search, params.sort, params.dir])

  const pageCount = Math.max(1, Math.ceil(visibleParents.length / params.pageSize))
  const page = Math.min(params.page, pageCount)

  useEffect(() => {
    if (!createParent.open) return
    parentForm.reset(EMPTY)
  }, [createParent.open, parentForm])

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['catalogs', copy.kind] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-lookups'] }),
    ])
  }

  const addParent = useMutation({
    mutationFn: (name: string) => createCatalogApi({ name, kind: copy.kind }),
    onMutate: () => {
      createParent.close()
      toast.success(copy.addedParent)
    },
    onSuccess: (row) => {
      void refresh()
      setEditId(row.id)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const delParent = useDeleteRowDialog({
    mutationFn: (row: CatalogItem) => deleteCatalogApi(row.id),
    successMessage: copy.deletedParent,
    queryKeys: [['catalogs', copy.kind]],
    invalidateKeys: [['catalogs', copy.kind], ['inventory-lookups']],
    onRemoved: (row) => {
      queryClient.setQueryData(['catalogs', copy.kind], (current: CatalogItem[] | undefined) =>
        current?.filter((item) => item.id !== row.id),
      )
    },
  })

  const columns = useMemo<Column<CatalogItem>[]>(
    () => [
      { key: 'name', header: copy.parentName, sortable: true },
      {
        key: 'childCount',
        header: 'Số danh mục con',
        width: 160,
        sortable: true,
        render: (row) => row.children?.length ?? 0,
      },
      {
        key: 'children',
        header: copy.childSection,
        render: (row) => {
          const kids = row.children ?? []
          if (!kids.length) return '—'
          const preview = kids
            .slice(0, 4)
            .map((item) => item.name)
            .join(', ')
          return kids.length > 4 ? `${preview}…` : preview
        },
      },
      {
        key: 'actions',
        header: 'Hành động',
        width: 120,
        align: 'center',
        card: 'actions',
        render: (row) => (
          <RowActions onEdit={() => setEditId(row.id)} onDelete={() => delParent.request(row)} />
        ),
      },
    ],
    [copy.childSection, copy.parentName, delParent.request],
  )

  return (
    <Stack spacing={1.25} sx={{ minHeight: 0, flex: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {copy.hint}
      </Typography>
      <DataTable
        columns={columns}
        rows={paginate(visibleParents, page, params.pageSize)}
        rowKey={(row) => row.id}
        loading={list.isLoading}
        errorText={list.error instanceof Error ? list.error.message : undefined}
        emptyText={params.search.trim() ? copy.notFound : copy.empty}
        variant="grid"
        fixedLayout
        cardBreakpoint={false}
        showIndex
        indexOffset={(page - 1) * params.pageSize}
        minWidth={720}
        page={page}
        pageSize={params.pageSize}
        total={visibleParents.length}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        onRowClick={(row) => setEditId(row.id)}
        sort={table.sortState}
        onSortChange={table.toggleSort}
        rowsLabel="danh mục"
        sx={{ flex: 1 }}
        toolbar={
          <>
            <SearchInput
              value={params.search}
              onChange={table.setSearch}
              placeholder={copy.search}
              sx={{ width: { xs: '100%', sm: 320 } }}
            />
            <Button variant="contained" sx={{ ml: { sm: 'auto' } }} onClick={createParent.openCreate}>
              {copy.addParent}
            </Button>
          </>
        }
      />

      <CrudDialogShell<FormValues>
        open={createParent.open}
        kind="create"
        titles={{ create: copy.addParent, edit: copy.title, view: copy.title }}
        form={parentForm}
        saving={false}
        onSubmit={(values) => {
          createParent.close()
          addParent.mutate(values.name.trim())
        }}
        onClose={createParent.close}
        onExited={createParent.clear}
        maxWidth="xs"
      >
        <FormTextField<FormValues> name="name" label={copy.parentName} required autoFocus sx={{ mt: 1 }} />
      </CrudDialogShell>

      <ParentEditorDialog
        parent={editing}
        copy={copy}
        onClose={() => setEditId(null)}
        onRefresh={refresh}
      />

      <ConfirmDeleteDialog
        open={Boolean(delParent.row)}
        title={copy.title}
        description={delParent.row ? copy.deleteParentHint(delParent.row.name) : ''}
        deleting={delParent.deleting}
        onClose={delParent.cancel}
        onConfirm={delParent.confirm}
      />
    </Stack>
  )
}

function ParentEditorDialog({
  parent,
  copy,
  onClose,
  onRefresh,
}: {
  parent: CatalogItem | null
  copy: Copy
  onClose: () => void
  onRefresh: () => Promise<void>
}) {
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({ defaultValues: EMPTY })
  const childDialog = useCrudDialog<CatalogItem>()
  const childForm = useForm<FormValues>({ defaultValues: EMPTY })
  const [childSearch, setChildSearch] = useState('')

  useEffect(() => {
    if (!parent) {
      setChildSearch('')
      return
    }
    form.reset({ name: parent.name, editReason: '' })
  }, [parent, form])

  useEffect(() => {
    if (!childDialog.open) return
    childForm.reset(childDialog.row ? { name: childDialog.row.name } : EMPTY)
  }, [childDialog.open, childDialog.row, childForm])

  const children = useMemo(() => {
    const rows = parent?.children ?? []
    const q = childSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => row.name.toLowerCase().includes(q))
  }, [parent?.children, childSearch])

  const saveParent = useMutation({
    mutationFn: ({ name, editReason }: { name: string; editReason: string }) =>
      updateCatalogApi(parent!.id, { name, editReason }),
    onMutate: () => toast.success(copy.savedParent),
    onSuccess: () => {
      void onRefresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const saveChild = useMutation({
    mutationFn: ({ id, name, editReason }: { id?: string; name: string; editReason?: string }) =>
      id
        ? updateCatalogApi(id, { name, editReason })
        : createCatalogApi({ name, kind: copy.kind, parentId: parent!.id }),
    onMutate: (input) => {
      childDialog.close()
      toast.success(input.id ? copy.savedChild : copy.addedChild)
    },
    onSuccess: () => {
      void onRefresh()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const delChild = useDeleteRowDialog({
    mutationFn: (row: CatalogItem) => deleteCatalogApi(row.id),
    successMessage: copy.deletedChild,
    queryKeys: [['catalogs', copy.kind]],
    invalidateKeys: [['catalogs', copy.kind], ['inventory-lookups']],
    onRemoved: (row) => {
      const parentId = parent?.id
      queryClient.setQueryData(['catalogs', copy.kind], (current: CatalogItem[] | undefined) =>
        current?.map((item) =>
          item.id === parentId
            ? { ...item, children: (item.children ?? []).filter((child) => child.id !== row.id) }
            : item,
        ),
      )
    },
  })

  const columns: Column<CatalogItem>[] = [
    { key: 'name', header: copy.childName },
    {
      key: 'actions',
      header: 'Hành động',
      width: 120,
      align: 'center',
      render: (row) => (
        <RowActions onEdit={() => childDialog.openEdit(row)} onDelete={() => delChild.request(row)} />
      ),
    },
  ]

  return (
    <>
      <Dialog
        open={Boolean(parent)}
        onClose={onClose}
        fullWidth
        maxWidth="lg"
        slotProps={{ paper: { sx: { height: 'min(860px, 92vh)' } } }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>
          {parent ? copy.editTitle(parent.name) : copy.title}
        </DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 1,
            minHeight: 0,
            '& .MuiFormLabel-asterisk': { color: 'error.main' },
          }}
        >
          <Form
            form={form}
            onSubmit={(values) =>
              saveParent.mutate({ name: values.name.trim(), editReason: (values.editReason ?? '').trim() })
            }
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'flex-start' }, mt: 1 }}>
              <FormTextField<FormValues>
                name="name"
                label={copy.parentName}
                required
                autoFocus
                sx={{ flex: 1 }}
              />
              <Button type="submit" variant="contained" sx={{ mt: { sm: 0.5 } }}>
                Lưu tên
              </Button>
            </Stack>
            <FormEditReasonBlock<FormValues> name="editReason" entityType="catalog" entityId={parent?.id} required />
          </Form>

          <Stack spacing={1} sx={{ minHeight: 0, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: BRAND }}>
              {copy.childSection}
            </Typography>
            <DataTable
              columns={columns}
              rows={children}
              rowKey={(row) => row.id}
              emptyText={childSearch ? copy.notFound : copy.emptyChild}
              rowsLabel="danh mục con"
              maxHeight="100%"
              sx={{ flex: 1, minHeight: 360 }}
              toolbar={
                <>
                  <SearchInput
                    value={childSearch}
                    onChange={setChildSearch}
                    placeholder={copy.searchChild}
                  />
                  <Button variant="contained" sx={{ ml: 'auto' }} onClick={childDialog.openCreate}>
                    {copy.addChild}
                  </Button>
                </>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} variant="contained">
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      <CrudDialogShell<FormValues>
        open={childDialog.open}
        kind={childDialog.kind}
        titles={{ create: copy.addChild, edit: copy.childName, view: copy.childSection }}
        form={childForm}
        saving={false}
        onSubmit={(values) => {
          childDialog.close()
          saveChild.mutate({
            id: childDialog.row?.id,
            name: values.name.trim(),
            editReason: values.editReason,
          })
        }}
        onClose={childDialog.close}
        onExited={childDialog.clear}
        maxWidth="xs"
        editLog={
          childDialog.row ? { entityType: 'catalog', entityId: childDialog.row.id } : undefined
        }
      >
        <FormTextField<FormValues> name="name" label={copy.childName} required autoFocus sx={{ mt: 1 }} />
      </CrudDialogShell>

      <ConfirmDeleteDialog
        open={Boolean(delChild.row)}
        title={copy.childSection}
        description={delChild.row ? copy.deleteChildHint(delChild.row.name) : ''}
        deleting={delChild.deleting}
        onClose={delChild.cancel}
        onConfirm={delChild.confirm}
      />
    </>
  )
}
