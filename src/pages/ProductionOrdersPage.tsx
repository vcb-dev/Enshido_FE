import { useMemo, useState, type ReactNode } from 'react'
import { Box, Button, Chip, Link, Stack, Typography } from '@mui/material'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  approveIntakeOrderApi,
  attachIntakeModel3dApi,
  rejectIntakeOrderApi,
  confirmIntakeWarehouseApi,
  submitIntakeCastingTreeSpecsApi,
  submitIntakeProductSpecsApi,
  getIntakePipelineListsApi,
  listIntakeOrdersApi,
  type IntakeOrder,
  type IntakeOrderStatus,
} from '../api/intakeOrders'
import { ApproveIntakeDialog } from '../intake/ApproveIntakeDialog'
import { RejectIntakeDialog } from '../intake/RejectIntakeDialog'
import { IntakeModel3dDialog } from '../intake/IntakeModel3dDialog'
import { IntakeProductSpecsDialog } from '../intake/IntakeProductSpecsDialog'
import { WarehouseConfirmDialog } from '../intake/WarehouseConfirmDialog'
import { IntakeCastingTreeDialog } from '../intake/IntakeCastingTreeDialog'
import {
  intakeNeedsCastingSlip,
  intakeNeedsCastingTreeSpecs,
  intakeNeedsModel3d,
  intakeNeedsProductSpecs,
} from '../intake/intakeActions'
import { canConfirmIntakeWarehouse } from '../intake/intakeWarehouseAccess'
import { intakeProductWeightCaption, intakeShowsProductWeight } from '../intake/intakeDisplay'
import { intakeDetailImages, intakeProductionStageColumn } from '../intake/intakeImages'
import { IntakeImageThumbs } from '../intake/IntakeImageThumbs'
import { IntakeOrderDetailDialog } from '../intake/IntakeOrderDetailDialog'
import {
  afterIntakeApproved,
  afterIntakeModel3dAttached,
  afterIntakeProductSpecsSubmitted,
  afterIntakeWarehouseConfirmed,
  afterIntakeCastingTreeUpdated,
  afterIntakeRejected,
  mergeIntakeQueueItems,
} from '../intake/intakeOrderCache'
import { IntakeStatusChip } from '../intake/IntakeStatusChip'
import { INTAKE_STATUS_META, INTAKE_STATUSES } from '../intake/catalog'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { can, Permission } from '../auth/permissions'
import {
  listProductionOrdersApi,
  type ProductionOrderRow,
  type ProductionRequestType,
  type ProductionStatus,
  type SubTicketSummary,
} from '../api/productionOrders'
import { formatStockedDate } from '../api/inventory'
import {
  ColumnHeaderDate,
  ColumnHeaderFilter,
  ColumnHeaderSearch,
  DataTable,
  PageHeader,
  type Column,
} from '../components/ui'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useTableParams } from '../hooks/useTableParams'
import {
  formatDateShort,
  formatDateTime,
  REQUEST_TYPES,
  REQUEST_TYPE_META,
  STAGE_LABEL,
  STATUS_META,
  STATUS_TABS,
  SUB_TICKET_STATE_META,
} from '../orders/catalog'
import { RequestTypeChip, StatusChip, SubTicketStateChip } from '../orders/OrderChips'
import { deadlineWarning } from '../orders/deadline'
import { ProductionOrderViewDialog } from '../orders/ProductionOrderViewDialog'

type ProductionListRow =
  | { kind: 'intake'; row: IntakeOrder }
  | { kind: 'order'; row: ProductionOrderRow }

const actionTextButtonSx = {
  minWidth: 0,
  maxWidth: '100%',
  width: 112,
  px: 0.5,
  py: 0.25,
  fontSize: '0.75rem',
  lineHeight: 1.35,
  whiteSpace: 'normal',
  textTransform: 'none',
} as const

const INTAKE_STATUS_FILTER_PREFIX = 'intake:'

const PRODUCTION_STATUS_FILTERS: ProductionStatus[] = ['NEW', 'REDO_3D', ...STATUS_TABS]

function parseIntakeStatusFilter(value: string): IntakeOrderStatus | null {
  if (value === 'INTAKE_PENDING') return 'PENDING_APPROVAL'
  if (!value.startsWith(INTAKE_STATUS_FILTER_PREFIX)) return null
  const status = value.slice(INTAKE_STATUS_FILTER_PREFIX.length) as IntakeOrderStatus
  return INTAKE_STATUSES.includes(status) ? status : null
}

function parseProductionStatusFilter(value: string): ProductionStatus | '' {
  return PRODUCTION_STATUS_FILTERS.includes(value as ProductionStatus)
    ? (value as ProductionStatus)
    : ''
}

function isCoolingStatusFilter(value: string) {
  return value === 'WAIT_FILING' || value === `${INTAKE_STATUS_FILTER_PREFIX}WAIT_COOLING`
}

const STATUS_COLUMN_FILTER_OPTIONS = (() => {
  const intakeOptions = INTAKE_STATUSES.filter((status) => status !== 'REJECTED').map((status) => ({
    id: `${INTAKE_STATUS_FILTER_PREFIX}${status}`,
    name: INTAKE_STATUS_META[status].label,
  }))
  const usedLabels = new Set(intakeOptions.map((item) => item.name))
  const productionOptions = PRODUCTION_STATUS_FILTERS.filter((status) => {
    if (status === 'WAIT_FILING') return false
    return !usedLabels.has(STATUS_META[status].label)
  }).map((status) => ({
    id: status,
    name: STATUS_META[status].label,
  }))
  return [...intakeOptions, ...productionOptions]
})()

export function ProductionOrdersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [approveTarget, setApproveTarget] = useState<IntakeOrder | null>(null)
  const [rejectTarget, setRejectTarget] = useState<IntakeOrder | null>(null)
  const [model3dTarget, setModel3dTarget] = useState<IntakeOrder | null>(null)
  const [productSpecsTarget, setProductSpecsTarget] = useState<IntakeOrder | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<IntakeOrder | null>(null)
  const [castingTreeTarget, setCastingTreeTarget] = useState<IntakeOrder | null>(null)
  const [intakeViewTarget, setIntakeViewTarget] = useState<IntakeOrder | null>(null)
  const [productionViewTarget, setProductionViewTarget] = useState<ProductionOrderRow | null>(null)
  const table = useTableParams({
    pageSize: 25,
    filters: {
      status: '',
      requestType: '',
      receivedDate: '',
      dueDate: '',
    },
  })
  const { params } = table
  const intakeStatusFilter = parseIntakeStatusFilter(params.status)
  const isCoolingView = isCoolingStatusFilter(params.status)
  const isIntakeOnlyView = intakeStatusFilter != null && !isCoolingView
  const isAllView = params.status === ''
  const isMergedView = isAllView || isCoolingView
  const statusTab: ProductionStatus | '' = isCoolingView
    ? 'WAIT_FILING'
    : parseProductionStatusFilter(params.status)
  const statusFilterValue = isCoolingView
    ? `${INTAKE_STATUS_FILTER_PREFIX}WAIT_COOLING`
    : params.status === 'INTAKE_PENDING'
      ? `${INTAKE_STATUS_FILTER_PREFIX}PENDING_APPROVAL`
      : params.status
  const search = useDebouncedValue(params.search, 300)

  const listBaseParams = {
    status: statusTab,
    requestType: params.requestType as ProductionRequestType | '',
    search,
    receivedDate: params.receivedDate,
    dueDate: params.dueDate,
    sort: params.sort || undefined,
    dir: params.sort ? params.dir : undefined,
  }

  const intakePipelineLists = useQuery({
    queryKey: ['intake-orders', 'pipeline-lists', search, params.requestType],
    queryFn: () =>
      getIntakePipelineListsApi({
        requestType: params.requestType as ProductionRequestType | '',
        search,
        pageSize: 120,
      }),
    placeholderData: keepPreviousData,
    enabled: isAllView,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const pendingTotal = intakePipelineLists.data?.PENDING_APPROVAL?.total ?? 0
  const pendingItems = intakePipelineLists.data?.PENDING_APPROVAL?.items ?? []
  const approvedTotal = intakePipelineLists.data?.APPROVED?.total ?? 0
  const approvedItems = intakePipelineLists.data?.APPROVED?.items ?? []
  const readyTotal = intakePipelineLists.data?.READY_FOR_PRODUCTION?.total ?? 0
  const readyItems = intakePipelineLists.data?.READY_FOR_PRODUCTION?.items ?? []
  const warehousePendingTotal = intakePipelineLists.data?.PENDING_WAREHOUSE_CONFIRMATION?.total ?? 0
  const warehousePendingItems = intakePipelineLists.data?.PENDING_WAREHOUSE_CONFIRMATION?.items ?? []
  const waxTotal = intakePipelineLists.data?.WAX_PRINTED?.total ?? 0
  const waxItems = intakePipelineLists.data?.WAX_PRINTED?.items ?? []
  const waxConfirmedTotal = intakePipelineLists.data?.WAX_CONFIRMED?.total ?? 0
  const waxConfirmedItems = intakePipelineLists.data?.WAX_CONFIRMED?.items ?? []
  const waitCastingTotal = intakePipelineLists.data?.WAIT_CASTING?.total ?? 0
  const waitCastingItems = intakePipelineLists.data?.WAIT_CASTING?.items ?? []
  const castingTotal = intakePipelineLists.data?.CASTING?.total ?? 0
  const castingItems = intakePipelineLists.data?.CASTING?.items ?? []
  const castPendingTotal = intakePipelineLists.data?.CAST_PENDING_CONFIRMATION?.total ?? 0
  const castPendingItems = intakePipelineLists.data?.CAST_PENDING_CONFIRMATION?.items ?? []
  const castDoneTotal = intakePipelineLists.data?.CAST_DONE?.total ?? 0
  const castDoneItems = intakePipelineLists.data?.CAST_DONE?.items ?? []
  const waitCoolingTotal = intakePipelineLists.data?.WAIT_COOLING?.total ?? 0
  const waitCoolingItems = intakePipelineLists.data?.WAIT_COOLING?.items ?? []
  const intakeQueueItems = useMemo(
    () =>
      mergeIntakeQueueItems(
        pendingItems,
        approvedItems,
        readyItems,
        warehousePendingItems,
        waxItems,
        waxConfirmedItems,
        waitCastingItems,
        castingItems,
        castPendingItems,
        castDoneItems,
        waitCoolingItems,
      ),
    [
      pendingItems,
      approvedItems,
      readyItems,
      warehousePendingItems,
      waxItems,
      waxConfirmedItems,
      waitCastingItems,
      castingItems,
      castPendingItems,
      castDoneItems,
      waitCoolingItems,
    ],
  )
  const intakeQueueTotal =
    pendingTotal +
    approvedTotal +
    readyTotal +
    warehousePendingTotal +
    waxTotal +
    waxConfirmedTotal +
    waitCastingTotal +
    castingTotal +
    castPendingTotal +
    castDoneTotal +
    waitCoolingTotal
  const intakeListStatus: IntakeOrderStatus | null = isCoolingView
    ? 'WAIT_COOLING'
    : intakeStatusFilter
  const intakeStatusList = useQuery({
    queryKey: [
      'intake-orders',
      'status-list',
      intakeListStatus,
      isCoolingView ? 1 : params.page,
      isCoolingView ? 120 : params.pageSize,
      search,
      params.requestType,
    ],
    queryFn: () =>
      listIntakeOrdersApi({
        status: intakeListStatus!,
        requestType: params.requestType as ProductionRequestType | '',
        search,
        page: isCoolingView ? 1 : params.page,
        pageSize: isCoolingView ? 120 : params.pageSize,
      }),
    placeholderData: keepPreviousData,
    enabled: isIntakeOnlyView || isCoolingView,
    staleTime: 15_000,
  })
  const mergeSlice = useMemo(
    () =>
      sliceMergedPage(
        params.page,
        params.pageSize,
        isCoolingView ? (intakeStatusList.data?.items ?? []) : intakeQueueItems,
        isCoolingView ? (intakeStatusList.data?.total ?? 0) : intakeQueueTotal,
      ),
    [
      isCoolingView,
      intakeStatusList.data?.items,
      intakeStatusList.data?.total,
      params.page,
      params.pageSize,
      intakeQueueItems,
      intakeQueueTotal,
    ],
  )

  const productionListParams = useMemo(() => {
    if (isIntakeOnlyView) return null
    if (!isMergedView) {
      return {
        ...listBaseParams,
        page: params.page,
        pageSize: params.pageSize,
      }
    }
    if (mergeSlice.prodTake <= 0) return null
    return {
      ...listBaseParams,
      page: 1,
      pageSize: mergeSlice.prodTake,
      offset: mergeSlice.prodStart,
    }
  }, [
    isIntakeOnlyView,
    isMergedView,
    listBaseParams,
    mergeSlice.prodStart,
    mergeSlice.prodTake,
    params.page,
    params.pageSize,
  ])

  const list = useQuery({
    queryKey: ['production-orders', productionListParams],
    queryFn: () =>
      listProductionOrdersApi({ ...productionListParams!, includeCounts: false }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: !isIntakeOnlyView && productionListParams !== null,
  })
  const isIntakeWarehouseKeeper = canConfirmIntakeWarehouse(user)
  const approveIntake = useMutation({
    mutationFn: ({ id, hasMold }: { id: string; hasMold: boolean }) =>
      approveIntakeOrderApi(id, { hasMold }),
    onSuccess: (order) => {
      setApproveTarget(null)
      afterIntakeApproved(queryClient, order)
      toast.success(`Đã duyệt đơn ${order.code}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const attachModel3d = useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string
      model3dUrl: string
      stoneCount3d: number | null
      stoneWeight3dGram: number | null
    }) => attachIntakeModel3dApi(id, payload),
    onSuccess: (order) => {
      setModel3dTarget(null)
      afterIntakeModel3dAttached(queryClient, order)
      toast.success(`Đã cập nhật 3D — ${order.code}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const rejectIntake = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectIntakeOrderApi(id, { reason }),
    onSuccess: (order) => {
      setRejectTarget(null)
      afterIntakeRejected(queryClient, order)
      toast.success(`Đã từ chối đơn ${order.code}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const submitProductSpecs = useMutation({
    mutationFn: ({
      id,
      productWeightGram,
      castingTreeWeightGram,
      images,
      stoneCount3d,
      stoneWeight3dGram,
    }: {
      id: string
      productWeightGram: number
      castingTreeWeightGram?: number
      images: IntakeOrder['images']
      stoneCount3d: number | null
      stoneWeight3dGram: number | null
    }) =>
      submitIntakeProductSpecsApi(id, {
        productWeightGram,
        castingTreeWeightGram,
        images,
        stoneCount3d,
        stoneWeight3dGram,
      }),
    onSuccess: (order) => {
      setProductSpecsTarget(null)
      afterIntakeProductSpecsSubmitted(queryClient, order)
      toast.success(
        order.status === 'PENDING_WAREHOUSE_CONFIRMATION'
          ? `Đã gửi số liệu — chờ thủ kho (${order.code})`
          : `Đã in sáp — ${order.code}`,
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const confirmWarehouse = useMutation({
    mutationFn: (id: string) => confirmIntakeWarehouseApi(id),
    onSuccess: (order) => {
      setConfirmTarget(null)
      afterIntakeWarehouseConfirmed(queryClient, order)
      toast.success(`Đã có sáp — ${order.code}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
  function goCastingIssue(order: IntakeOrder) {
    const code = order.castingSlip?.code
    if (!code) return
    navigate(`/casting?issue=${encodeURIComponent(code)}`)
  }
  const submitCastingTree = useMutation({
    mutationFn: ({
      id,
      castingTreeWeightGram,
      images,
    }: {
      id: string
      castingTreeWeightGram: number
      images: IntakeOrder['images']
    }) => submitIntakeCastingTreeSpecsApi(id, { castingTreeWeightGram, images }),
    onSuccess: (order) => {
      setCastingTreeTarget(null)
      afterIntakeCastingTreeUpdated(queryClient, order)
      toast.success(`Đã gửi số liệu — chờ thủ kho (${order.code})`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const requestTypeOptions = useMemo(
    () => REQUEST_TYPES.map((type) => ({ id: type, name: REQUEST_TYPE_META[type].label })),
    [],
  )

  const columns = useMemo(
    () =>
      orderColumns(
        {
          onView: (row) => setProductionViewTarget(row),
          onIntakeApprove: (row) => setApproveTarget(row),
          onIntakeReject: (row) => setRejectTarget(row),
          onIntakeUpdate: (row) => setModel3dTarget(row),
          onIntakeProductSpecs: (row) => setProductSpecsTarget(row),
          onIntakeCastingTree: (row) => setCastingTreeTarget(row),
          // Bước 7 lên phiếu cho nhiều đơn cùng lúc ở màn Lệnh đúc — tích sẵn đơn này.
          onIntakeCastingSlip: (row) => navigate(`/casting?new=${row.id}`),
          onIntakeCastingSlipIssue: goCastingIssue,
          onIntakeView: (row) => setIntakeViewTarget(row),
          onIntakeWarehouseConfirm: (row) => setConfirmTarget(row),
          warehouseConfirmLoadingId: confirmWarehouse.isPending
            ? (confirmWarehouse.variables ?? null)
            : null,
          canConfirmIntakeWarehouse: isIntakeWarehouseKeeper,
          can: {
            approve: can(user, Permission.INTAKE_APPROVE),
            model3d: can(user, Permission.PRODUCTION_MODEL3D),
            wax: can(user, Permission.PRODUCTION_WAX),
            keeper: isIntakeWarehouseKeeper,
            cast: can(user, Permission.PRODUCTION_CAST),
            qc: can(user, Permission.PRODUCTION_QC),
          },
        },
        {
          search: (
            <ColumnHeaderSearch
              value={params.search}
              onChange={table.setSearch}
              placeholder="Tìm mã SX, mô tả…"
            />
          ),
          status: {
            valueId: statusFilterValue,
            options: STATUS_COLUMN_FILTER_OPTIONS,
            onChange: (id) => table.setFilter({ status: id }),
          },
          requestType: {
            valueId: params.requestType,
            options: requestTypeOptions,
            onChange: (id) => table.setFilter({ requestType: id }),
          },
          receivedDate: (
            <ColumnHeaderDate
              value={params.receivedDate}
              onChange={(value) => table.setFilter({ receivedDate: value })}
            />
          ),
          dueDate: (
            <ColumnHeaderDate
              value={params.dueDate}
              onChange={(value) => table.setFilter({ dueDate: value })}
            />
          ),
        },
      ),
    [
      confirmWarehouse.isPending,
      confirmWarehouse.variables,
      isIntakeWarehouseKeeper,
      user,
      navigate,
      params.dueDate,
      params.receivedDate,
      params.requestType,
      params.search,
      statusFilterValue,
      requestTypeOptions,
      table.setSearch,
      table.setFilter,
    ],
  )
  const prodPageItems = useMemo(() => {
    if (!isMergedView) return list.data?.items ?? []
    if (productionListParams === null || !list.data?.items) return []
    if (mergeSlice.prodTake <= 0) return []
    return list.data.items
  }, [isMergedView, list.data?.items, mergeSlice.prodTake, productionListParams])
  const tableRows: ProductionListRow[] = useMemo(() => {
    if (isIntakeOnlyView) {
      return (intakeStatusList.data?.items ?? []).map((row) => ({ kind: 'intake' as const, row }))
    }
    if (!isMergedView) return (list.data?.items ?? []).map((row) => ({ kind: 'order' as const, row }))
    return [
      ...mergeSlice.pendingOnPage.map((row) => ({ kind: 'intake' as const, row })),
      ...prodPageItems.map((row) => ({ kind: 'order' as const, row })),
    ]
  }, [
    isIntakeOnlyView,
    isMergedView,
    intakeStatusList.data?.items,
    list.data?.items,
    mergeSlice.pendingOnPage,
    prodPageItems,
  ])
  const tableTotal = isIntakeOnlyView
    ? (intakeStatusList.data?.total ?? 0)
    : isMergedView
      ? (isCoolingView ? (intakeStatusList.data?.total ?? 0) : intakeQueueTotal) +
        (list.data?.total ?? 0)
      : (list.data?.total ?? 0)
  const columnFiltered = Boolean(
    params.status ||
      params.requestType ||
      params.search.trim() ||
      params.receivedDate ||
      params.dueDate,
  )

  return (
    <Stack
      spacing={1.25}
      sx={{ flex: { md: 1 }, minHeight: { md: 0 }, height: { md: '100%' }, overflow: { xs: 'visible', md: 'hidden' } }}
    >
      <PageHeader
        title="Lệnh sản xuất"
        subtitle="Lên đơn, theo dõi trạng thái và in phiếu cho thợ."
        compactSubtitle
      />

      <DataTable
        columns={columns}
        rows={tableRows}
        rowKey={(row) => (row.kind === 'intake' ? `intake-${row.row.id}` : row.row.id)}
        onRowClick={(row) =>
          row.kind === 'intake'
            ? setIntakeViewTarget(row.row)
            : navigate(`/orders/${row.row.code}`)
        }
        onSubRowClick={(sub) => navigate(`/tickets/${sub.code}`)}
        subRows={{
          get: (row) =>
            row.kind === 'intake'
              ? []
              : statusTab
                ? row.row.subTickets.filter((sub) => {
                    const subStatus = subTicketListStatus(sub)
                    return (
                      subStatus === statusTab ||
                      (subStatus == null && row.row.status === statusTab)
                    )
                  })
                : row.row.subTickets,
          key: (sub) => sub.code,
          label: (count) => `${count} phiếu con`,
          autoExpandKey: statusTab || undefined,
        }}
        loading={
          (list.isLoading && !list.data) ||
          (isAllView && intakePipelineLists.isLoading && !intakePipelineLists.data) ||
          ((isIntakeOnlyView || isCoolingView) &&
            intakeStatusList.isLoading &&
            !intakeStatusList.data)
        }
        errorText={
          (list.error ?? intakePipelineLists.error ?? intakeStatusList.error) instanceof Error
            ? (list.error ?? intakePipelineLists.error ?? intakeStatusList.error)!.message
            : undefined
        }
        emptyText={columnFiltered ? 'Không có đơn khớp bộ lọc.' : 'Chưa có lệnh sản xuất.'}
        variant="grid"
        fixedLayout
        minWidth={1596}
        sort={isMergedView || isIntakeOnlyView ? undefined : table.sortState}
        onSortChange={isMergedView || isIntakeOnlyView ? undefined : table.toggleSort}
        page={params.page}
        pageSize={params.pageSize}
        total={tableTotal}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        rowsLabel="đơn"
        sx={{ flex: { md: 1 } }}
        toolbar={
          columnFiltered ? (
            <Button
              size="small"
              onClick={() => {
                table.setSearch('')
                table.setFilter({
                  status: '',
                  requestType: '',
                  receivedDate: '',
                  dueDate: '',
                })
              }}
            >
              Xóa lọc
            </Button>
          ) : null
        }
      />

      <ApproveIntakeDialog
        order={approveTarget}
        saving={approveIntake.isPending}
        onClose={() => setApproveTarget(null)}
        onConfirm={(hasMold) => {
          if (!approveTarget) return
          void approveIntake.mutateAsync({ id: approveTarget.id, hasMold })
        }}
      />
      <RejectIntakeDialog
        order={rejectTarget}
        saving={rejectIntake.isPending}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          if (!rejectTarget) return
          void rejectIntake.mutateAsync({ id: rejectTarget.id, reason: reason || undefined })
        }}
      />
      <IntakeModel3dDialog
        order={model3dTarget}
        saving={attachModel3d.isPending}
        onClose={() => setModel3dTarget(null)}
        onSave={(payload) => {
          if (!model3dTarget) return
          void attachModel3d.mutateAsync({ id: model3dTarget.id, ...payload })
        }}
      />
      <WarehouseConfirmDialog
        order={confirmTarget}
        saving={confirmWarehouse.isPending}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => confirmTarget && confirmWarehouse.mutate(confirmTarget.id)}
      />
      <IntakeProductSpecsDialog
        order={productSpecsTarget}
        saving={submitProductSpecs.isPending}
        onClose={() => setProductSpecsTarget(null)}
        onSave={(payload) => {
          if (!productSpecsTarget) return
          void submitProductSpecs.mutateAsync({ id: productSpecsTarget.id, ...payload })
        }}
      />
      <IntakeCastingTreeDialog
        order={castingTreeTarget}
        saving={submitCastingTree.isPending}
        onClose={() => setCastingTreeTarget(null)}
        onSave={(payload) => {
          if (!castingTreeTarget) return
          void submitCastingTree.mutateAsync({ id: castingTreeTarget.id, ...payload })
        }}
      />
      <IntakeOrderDetailDialog
        order={intakeViewTarget}
        onClose={() => setIntakeViewTarget(null)}
      />
      <ProductionOrderViewDialog
        row={productionViewTarget}
        onClose={() => setProductionViewTarget(null)}
      />
    </Stack>
  )
}

function renderIntakeWorkflowAction(
  order: IntakeOrder,
  actions: {
    onIntakeApprove: (row: IntakeOrder) => void
    onIntakeReject: (row: IntakeOrder) => void
    onIntakeUpdate: (row: IntakeOrder) => void
    onIntakeProductSpecs: (row: IntakeOrder) => void
    onIntakeCastingTree: (row: IntakeOrder) => void
    onIntakeCastingSlip: (row: IntakeOrder) => void
    onIntakeCastingSlipIssue: (row: IntakeOrder) => void
    onIntakeWarehouseConfirm: (row: IntakeOrder) => void
    warehouseConfirmLoadingId: string | null
    canConfirmIntakeWarehouse: boolean
    /** Quyền theo việc của người đang đăng nhập — không có quyền thì chỉ hiện "Chờ …". */
    can: { approve: boolean; model3d: boolean; wax: boolean; keeper: boolean; cast: boolean; qc: boolean }
  },
) {
  // Chưa đến lượt người này: nói rõ đang chờ vai trò nào thay vì hiện nút bấm sẽ bị BE từ chối.
  const waiting = (role: string) => (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ whiteSpace: 'normal', lineHeight: 1.35, display: 'block', maxWidth: 112, mx: 'auto', textAlign: 'center' }}
    >
      Chờ {role}
    </Typography>
  )
  if (order.status === 'PENDING_APPROVAL') {
    if (!actions.can.approve) return waiting('thủ kho duyệt')
    return (
      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button size="small" variant="contained" onClick={() => actions.onIntakeApprove(order)}>
          Duyệt
        </Button>
        <Button size="small" variant="outlined" color="error" onClick={() => actions.onIntakeReject(order)}>
          Từ chối
        </Button>
      </Stack>
    )
  }
  if (intakeNeedsModel3d(order)) {
    if (!actions.can.model3d) return waiting('thợ 3D')
    return (
      <Button size="small" variant="outlined" onClick={() => actions.onIntakeUpdate(order)}>
        Cập nhật link 3D
      </Button>
    )
  }
  if (intakeNeedsProductSpecs(order)) {
    // Không khuôn = in sáp (thợ 3D); có khuôn = bơm sáp (thợ sáp).
    if (order.hasMold ? !actions.can.wax : !actions.can.model3d) {
      return waiting(order.hasMold ? 'thợ sáp' : 'thợ 3D')
    }
    return (
      <Button
        size="small"
        variant="outlined"
        onClick={() => actions.onIntakeProductSpecs(order)}
        sx={{ minWidth: 0, maxWidth: '100%', width: 112, px: 0.75, py: 0.5 }}
      >
        <Typography
          variant="caption"
          component="span"
          sx={{ whiteSpace: 'normal', lineHeight: 1.35, display: 'block', textAlign: 'center' }}
        >
          {order.hasMold ? 'Cập nhật số liệu cây thông' : 'Cập nhật số liệu sáp'}
        </Typography>
      </Button>
    )
  }
  if (order.status === 'PENDING_WAREHOUSE_CONFIRMATION') {
    if (actions.canConfirmIntakeWarehouse) {
      return (
        <Button
          size="small"
          variant="contained"
          disabled={actions.warehouseConfirmLoadingId === order.id}
          onClick={() => actions.onIntakeWarehouseConfirm(order)}
          sx={{ minWidth: 0, maxWidth: '100%', width: 112, whiteSpace: 'normal', lineHeight: 1.35 }}
        >
          {actions.warehouseConfirmLoadingId === order.id ? 'Đang xác nhận…' : 'Xác nhận'}
        </Button>
      )
    }
    return (
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ whiteSpace: 'normal', lineHeight: 1.35, display: 'block', maxWidth: 112, mx: 'auto', textAlign: 'center' }}
      >
        Chờ thủ kho xác nhận
      </Typography>
    )
  }
  if (intakeNeedsCastingTreeSpecs(order)) {
    if (!actions.can.wax) return waiting('thợ sáp')
    return (
      <Button
        size="small"
        variant="outlined"
        onClick={() => actions.onIntakeCastingTree(order)}
        sx={{ minWidth: 0, maxWidth: '100%', width: 112, px: 0.75, py: 0.5 }}
      >
        <Typography
          variant="caption"
          component="span"
          sx={{ whiteSpace: 'normal', lineHeight: 1.35, display: 'block', textAlign: 'center' }}
        >
          Cập nhật số liệu cây thông
        </Typography>
      </Button>
    )
  }
  if (intakeNeedsCastingSlip(order) && order.castingSlip) {
    // Đã lên + in phiếu — chuyển sang màn Lệnh đúc và mở form cấp vật tư.
    if (!actions.can.keeper) return waiting('thủ kho cấp vật tư')
    return (
      <Button
        size="small"
        variant="outlined"
        onClick={() => actions.onIntakeCastingSlipIssue(order)}
        sx={{ minWidth: 0, maxWidth: '100%', width: 112, px: 0.75, py: 0.5, whiteSpace: 'normal', lineHeight: 1.35 }}
      >
        Phiếu {order.castingSlip.code} · chờ cấp vật tư
      </Button>
    )
  }
  if (intakeNeedsCastingSlip(order)) {
    if (!actions.can.keeper) return waiting('thủ kho lên phiếu đúc')
    return (
      <Button
        size="small"
        variant="contained"
        onClick={() => actions.onIntakeCastingSlip(order)}
        sx={{
          minWidth: 0,
          maxWidth: '100%',
          width: 112,
          px: 0.75,
          py: 0.5,
          whiteSpace: 'normal',
          lineHeight: 1.35,
        }}
      >
        Lên lệnh đúc
      </Button>
    )
  }
  if (
    order.status === 'WAIT_CASTING' ||
    order.status === 'CASTING' ||
    order.status === 'CAST_PENDING_CONFIRMATION'
  ) {
    if (!actions.can.cast && !actions.can.keeper) return waiting('thợ đúc')
    return (
      <Button
        size="small"
        variant="outlined"
        component={RouterLink}
        to="/casting"
        sx={{ minWidth: 0, maxWidth: '100%', width: 112, px: 0.75, py: 0.5, whiteSpace: 'normal', lineHeight: 1.35 }}
      >
        Xem Lệnh đúc
      </Button>
    )
  }
  if (order.status === 'CAST_DONE') {
    if (!actions.can.keeper) return waiting('thủ kho cắt cây thông')
    return (
      <Button
        size="small"
        variant="contained"
        component={RouterLink}
        to={order.castingSlip?.code ? `/casting?cut=${encodeURIComponent(order.castingSlip.code)}` : '/casting'}
        sx={{ minWidth: 0, maxWidth: '100%', width: 112, px: 0.75, py: 0.5, whiteSpace: 'normal', lineHeight: 1.35 }}
      >
        Cắt cây thông
      </Button>
    )
  }
  if (order.status === 'WAIT_COOLING') {
    if (order.productionOrderCode) {
      return (
        <Button
          size="small"
          variant="outlined"
          component={RouterLink}
          to={`/orders/${order.productionOrderCode}`}
          sx={{ minWidth: 0, maxWidth: '100%', width: 112, px: 0.75, py: 0.5, whiteSpace: 'normal', lineHeight: 1.35 }}
        >
          Xem lệnh SX
        </Button>
      )
    }
    return (
      <Typography variant="caption" color="text.secondary">
        Chờ nguội
      </Typography>
    )
  }
  return (
    <Typography variant="caption" color="text.secondary">
      —
    </Typography>
  )
}

function orderColumns(
  actions: {
    onView: (row: ProductionOrderRow) => void
    onIntakeApprove: (row: IntakeOrder) => void
    onIntakeReject: (row: IntakeOrder) => void
    onIntakeUpdate: (row: IntakeOrder) => void
    onIntakeProductSpecs: (row: IntakeOrder) => void
    onIntakeCastingTree: (row: IntakeOrder) => void
    onIntakeCastingSlip: (row: IntakeOrder) => void
    onIntakeCastingSlipIssue: (row: IntakeOrder) => void
    onIntakeView: (row: IntakeOrder) => void
    onIntakeWarehouseConfirm: (row: IntakeOrder) => void
    warehouseConfirmLoadingId: string | null
    canConfirmIntakeWarehouse: boolean
    can: { approve: boolean; model3d: boolean; wax: boolean; keeper: boolean; cast: boolean; qc: boolean }
  },
  filters: {
    search: ReactNode
    status: {
      valueId: string
      options: Array<{ id: string; name: string }>
      onChange: (id: string) => void
    }
    requestType: {
      valueId: string
      options: Array<{ id: string; name: string }>
      onChange: (id: string) => void
    }
    receivedDate: ReactNode
    dueDate: ReactNode
  },
): Column<ProductionListRow, SubTicketSummary>[] {
  return [
    {
      key: 'code',
      header: 'Mã SX',
      width: 104,
      sortable: true,
      card: 'title',
      cellSx: { fontWeight: 700 },
      filter: filters.search,
      render: (row) => {
        if (row.kind === 'intake') {
          return row.row.sxCode
        }
        const order = row.row
        const body = order.subTickets.length ? (
          <>
            {order.code}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
              {order.subTickets.length} phiếu con
            </Typography>
          </>
        ) : (
          order.code
        )
        return (
          <Link
            component={RouterLink}
            to={`/orders/${order.code}`}
            underline="hover"
            color="inherit"
            sx={{ fontWeight: 700 }}
            onClick={(event) => event.stopPropagation()}
          >
            {body}
          </Link>
        )
      },
      renderSub: (sub) => (
        <>
          <Link
            component={RouterLink}
            to={`/tickets/${sub.code}`}
            underline="none"
            color="inherit"
            sx={{ fontWeight: 600 }}
          >
            {sub.code}
          </Link>
          {sub.workerName ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
              thợ {sub.workerName}
            </Typography>
          ) : null}
        </>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      width: 136,
      sortable: true,
      card: 'meta',
      render: (row) =>
        row.kind === 'intake'
          ? formatDateShort(row.row.createdAt)
          : formatDateTime(row.row.createdAt),
      renderSub: (sub) => formatDateTime(sub.createdAt),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: 220,
      sortable: true,
      card: 'meta',
      filter: <ColumnHeaderFilter {...filters.status} />,
      render: (row) =>
        row.kind === 'intake' ? (
          <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            <IntakeStatusChip status={row.row.status} />
            {row.row.status === 'APPROVED' && row.row.hasMold != null ? (
              <Typography variant="caption" color="text.secondary">
                {row.row.hasMold ? 'Đã có khuôn' : 'Cần vẽ 3D in resin'}
              </Typography>
            ) : null}
            {row.row.status === 'READY_FOR_PRODUCTION' && row.row.hasMold === true ? (
              <Typography variant="caption" color="text.secondary">
                Đã có khuôn
              </Typography>
            ) : null}
            {row.row.status === 'READY_FOR_PRODUCTION' && row.row.model3dUrl ? (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                {row.row.model3dUrl}
              </Typography>
            ) : null}
            {row.kind === 'intake' &&
            intakeShowsProductWeight(row.row) &&
            intakeProductWeightCaption(row.row) ? (
              <Typography variant="caption" color="text.secondary">
                {intakeProductWeightCaption(row.row)}
              </Typography>
            ) : null}
          </Stack>
        ) : (
          <OrderStatus row={row.row} />
        ),
      renderSub: (sub) => <SubTicketStatus sub={sub} />,
    },
    {
      key: 'productName',
      header: 'Tên sản phẩm',
      width: 180,
      ellipsis: true,
      render: (row) =>
        row.kind === 'intake'
          ? row.row.productName?.trim() || '—'
          : row.row.btpName?.trim() || '—',
    },
    {
      key: 'requestType',
      header: 'Yêu cầu làm hàng',
      width: 148,
      filter: <ColumnHeaderFilter {...filters.requestType} />,
      render: (row) => <RequestTypeChip type={row.row.requestType} />,
    },
    {
      key: 'qty',
      header: 'SL cần làm',
      width: 128,
      numeric: true,
      sortable: true,
      render: (row) =>
        row.kind === 'intake'
          ? String(row.row.qty)
          : `${row.row.qty}${row.row.qtyUnit ? ` ${row.row.qtyUnit}` : ''}`,
      renderSub: (sub, row) => {
        if (row.kind === 'intake') return null
        const order = row.row
        return (
          <>
            {sub.qty}
            {order.qtyUnit ? ` ${order.qtyUnit}` : ''}
          </>
        )
      },
    },
    {
      key: 'returnedQty',
      header: 'Đã trả',
      width: 68,
      numeric: true,
      render: (row) => (row.kind === 'intake' ? '—' : row.row.returnedQty),
    },
    {
      key: 'intakeOrderCode',
      header: 'Mã đơn hàng',
      width: 100,
      ellipsis: true,
      render: (row) =>
        row.kind === 'intake' ? row.row.code : row.row.intakeOrderCode?.trim() || '—',
    },
    {
      key: 'trackingCode',
      header: 'Mã sản phẩm',
      width: 96,
      ellipsis: true,
      render: (row) => row.row.trackingCode?.trim() || '—',
    },
    {
      key: 'closedBy',
      header: 'Người chốt',
      width: 120,
      ellipsis: true,
      sortable: true,
      render: (row) => (row.kind === 'intake' ? row.row.placedBy : row.row.closedBy),
    },
    {
      key: 'description',
      header: 'Mô tả / Yêu cầu sản phẩm',
      width: 260,
      ellipsis: true,
      render: (row) => row.row.description || '—',
      renderSub: (sub) => sub.note,
    },
    {
      key: 'detailImages',
      header: 'Ảnh chi tiết',
      width: 108,
      render: (row) =>
        row.kind === 'intake' ? (
          <IntakeImageThumbs
            label="Ảnh chi tiết"
            images={intakeDetailImages(row.row.images)}
          />
        ) : (
          '—'
        ),
    },
    {
      key: 'stageImages',
      header: 'Ảnh công đoạn',
      width: 108,
      render: (row) => {
        if (row.kind !== 'intake') return '—'
        const stage = intakeProductionStageColumn(row.row)
        return (
          <IntakeImageThumbs label={stage.label} images={stage.images} />
        )
      },
    },
    {
      key: 'receivedDate',
      header: 'Ngày đặt đơn',
      width: 148,
      sortable: true,
      filter: filters.receivedDate,
      render: (row) =>
        row.kind === 'intake' ? formatDateShort(row.row.createdDate) : formatStockedDate(row.row.receivedDate),
    },
    {
      key: 'dueDate',
      header: 'Ngày cần trả',
      width: 156,
      filter: filters.dueDate,
      render: (row) =>
        row.kind === 'intake' ? (
          row.row.dueDate ? formatDateShort(row.row.dueDate) : '—'
        ) : (
          <DeadlineCell row={row.row} />
        ),
    },
    {
      key: 'actions',
      header: 'Hành động',
      width: 152,
      align: 'center',
      card: 'actions',
      cellSx: { overflow: 'visible' },
      render: (row) => (
        <Box onClick={(event) => event.stopPropagation()}>
          {row.kind === 'intake' ? (
            <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
              {renderIntakeWorkflowAction(row.row, actions)}
              <Button
                size="small"
                variant="text"
                onClick={() => actions.onIntakeView(row.row)}
                sx={actionTextButtonSx}
              >
                Xem chi tiết
              </Button>
            </Stack>
          ) : (
            <Button
              size="small"
              variant="text"
              onClick={() => actions.onView(row.row)}
              sx={actionTextButtonSx}
            >
              Xem chi tiết
            </Button>
          )}
        </Box>
      ),
      renderSub: (sub) => (
        <Button
          size="small"
          variant="text"
          component={RouterLink}
          to={`/tickets/${sub.code}`}
          sx={actionTextButtonSx}
        >
          Xem chi tiết
        </Button>
      ),
    },
  ]
}

function sliceMergedPage(
  page: number,
  pageSize: number,
  pendingItems: IntakeOrder[],
  pendingTotal: number,
): { pendingOnPage: IntakeOrder[]; prodStart: number; prodTake: number } {
  const slotStart = (page - 1) * pageSize
  const slotEnd = page * pageSize
  const pendingStart = Math.min(slotStart, pendingTotal)
  const pendingEnd = Math.min(slotEnd, pendingTotal)
  const pendingOnPage = pendingItems.slice(pendingStart, pendingEnd)
  const prodTake = pageSize - pendingOnPage.length
  const prodStart = Math.max(0, slotStart - pendingTotal)
  return { pendingOnPage, prodStart, prodTake }
}

/**
 * Trạng thái của một phiếu con: khâu đang ở (cùng màu chip với trạng thái đơn ở dòng cha, để
 * dò cột là thấy tiến độ), bên dưới là bước trong khâu — chờ thợ nhận, đang làm, chờ QC…
 */
function SubTicketStatus({ sub }: { sub: SubTicketSummary }) {
  if (sub.state === 'FINISH') return <StatusChip status="FINISHING" />
  if (sub.state === 'DEFECT') return <StatusChip status="DEFECT" />
  if (!sub.stage) return <StatusChip status={sub.status} />
  return (
    <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      <StatusChip status={sub.status} label={orderStatusLabel(sub.status, sub.state, sub.stage)} />
      {sub.state === 'IDLE' ? null : <SubTicketStateChip state={sub.state} />}
    </Stack>
  )
}

function OrderStatus({ row }: { row: ProductionOrderRow }) {
  if (row.subTickets.length) {
    const counts = new Map<string, { status: ProductionStatus; label: string; count: number }>()
    for (const ticket of row.subTickets) {
      const status = subTicketListStatus(ticket)
      if (status) {
        const label = orderStatusLabel(status, ticket.state, ticket.stage)
        const key = `${status}:${label}`
        const current = counts.get(key)
        counts.set(key, { status, label, count: (current?.count ?? 0) + 1 })
      }
    }
    if (counts.size) {
      return (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {[...counts.values()].map(({ status, label, count }) => (
            <StatusChip
              key={`${status}:${label}`}
              status={status}
              label={`${label} · ${count}`}
            />
          ))}
        </Stack>
      )
    }
  }
  const label = orderStatusLabel(row.status, row.workState, row.workStage)
  return (
    <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      <StatusChip status={row.status} label={label} />
      {row.workState && row.workStage && row.workState !== 'FINISH' && row.workState !== 'DEFECT' ? (
        <SubTicketStateChip
          state={row.workState}
          label={row.workState === 'IDLE' ? 'QC đã nhận lại' : SUB_TICKET_STATE_META[row.workState].label}
        />
      ) : null}
    </Stack>
  )
}

function orderStatusLabel(
  status: ProductionStatus,
  state: SubTicketSummary['state'] | ProductionOrderRow['workState'],
  stage: SubTicketSummary['stage'] | ProductionOrderRow['workStage'],
) {
  const stageName = stage ? STAGE_LABEL[stage] : STATUS_META[status].label
  const stageStatus = status === 'FILING' || status === 'STONE_SETTING' ||
    status === 'ENGRAVING' || status === 'POLISHING' || status === 'PLATING'
  if (!stageStatus) return STATUS_META[status].label
  const lowerStage = stageName.toLocaleLowerCase('vi')
  if (state === 'WORKING') return `Đang ${lowerStage}`
  if (state === 'CLAIMED') return `Đã nhận ${lowerStage}`
  if (state === 'SUBMITTED') return `Chờ QC ${lowerStage}`
  return `Chờ ${lowerStage}`
}

function subTicketListStatus(sub: SubTicketSummary): ProductionStatus | null {
  if (sub.state === 'FINISH') return 'FINISHING'
  if (sub.state === 'DEFECT') return 'DEFECT'
  return sub.status
}

const DEADLINE_TONE = {
  overdue: { bg: '#fdecea', fg: '#b3261e', border: '#ef9a9a' },
  today: { bg: '#ffebee', fg: '#b71c1c', border: '#e57373' },
  soon: { bg: '#fff4d6', fg: '#8a6100', border: '#f0c36d' },
} as const

function DeadlineCell({ row }: { row: ProductionOrderRow }) {
  const warning = deadlineWarning(row.dueDate, row.status)
  if (!row.dueDate) return '—'
  const tone = warning ? DEADLINE_TONE[warning.tone] : null
  return (
    <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="body2" sx={{ fontWeight: warning ? 700 : 400, color: tone?.fg }}>
        {formatStockedDate(row.dueDate)}
      </Typography>
      {warning && tone ? (
        <Chip
          size="small"
          label={warning.label}
          sx={{
            height: 22,
            bgcolor: tone.bg,
            color: tone.fg,
            border: '1px solid',
            borderColor: tone.border,
            fontWeight: 700,
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      ) : null}
    </Stack>
  )
}
