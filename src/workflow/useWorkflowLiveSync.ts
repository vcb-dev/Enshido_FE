import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getWorkflowIntakeLiveApi, getWorkflowRevisionApi, type WorkflowRevision } from '../api/workflow'
import { applyIntakeLiveSnapshot } from '../intake/intakeOrderCache'
import { scheduleMyTicketsRefresh } from '../orders/myTicketsRefresh'
import { subscribeWorkflowBroadcast } from './workflowBroadcast'

const EMPTY: WorkflowRevision = { intake: '', production: '', casting: '' }

function applyRevisionDelta(
  queryClient: ReturnType<typeof useQueryClient>,
  prev: WorkflowRevision,
  next: WorkflowRevision,
) {
  if (prev.intake !== next.intake) {
    const watchingIntake = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['intake-orders'], type: 'active' }).length
    if (watchingIntake) {
      void getWorkflowIntakeLiveApi()
        .then((live) => applyIntakeLiveSnapshot(queryClient, live.items))
        .catch(() => undefined)
      void queryClient.invalidateQueries({
        queryKey: ['intake-orders', 'status-list'],
        refetchType: 'active',
      })
    }
  }
  if (prev.production !== next.production) {
    // Chi tiết đơn đã vá cache lúc bấm nút; poll không GET lại (ảnh QC nặng).
    // Tab khác đang mở đơn thì liveRefresh trên tab Sản xuất / phiếu thợ tự làm mới.
    void queryClient.invalidateQueries({ queryKey: ['production-orders'], refetchType: 'active' })
    scheduleMyTicketsRefresh(queryClient)
    const watchingRequests = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['material-requests'], type: 'active' }).length
    if (watchingRequests) {
      void queryClient.invalidateQueries({ queryKey: ['material-requests'], refetchType: 'active' })
    }
  }
  if (prev.casting !== next.casting) {
    void queryClient.invalidateQueries({ queryKey: ['casting-slips'], refetchType: 'active' })
    scheduleMyTicketsRefresh(queryClient)
  }
}

/** Poll revision nhẹ + vá trạng thái; tab khác broadcast thì làm mới ngay. */
export function useWorkflowLiveSync(enabled: boolean) {
  const queryClient = useQueryClient()
  const last = useRef<WorkflowRevision | null>(null)

  const revision = useQuery({
    queryKey: ['workflow-revision'],
    queryFn: getWorkflowRevisionApi,
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 20_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!enabled) return
    return subscribeWorkflowBroadcast(() => {
      void queryClient.invalidateQueries({ queryKey: ['workflow-revision'] })
    })
  }, [enabled, queryClient])

  useEffect(() => {
    if (!enabled || !revision.data) return
    const prev = last.current
    last.current = revision.data
    if (!prev) {
      const hasIntakeCache = queryClient
        .getQueryCache()
        .findAll({ queryKey: ['intake-orders', 'pipeline-lists'] }).length
      if (hasIntakeCache) applyRevisionDelta(queryClient, EMPTY, { ...revision.data, production: '', casting: '' })
      return
    }
    applyRevisionDelta(queryClient, prev, revision.data)
  }, [enabled, queryClient, revision.data])
}
