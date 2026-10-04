import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getWorkflowIntakeLiveApi, getWorkflowRevisionApi, type WorkflowRevision } from '../api/workflow'
import { applyIntakeLiveSnapshot } from '../intake/intakeOrderCache'
import { subscribeWorkflowBroadcast } from './workflowBroadcast'

const EMPTY: WorkflowRevision = { intake: '', production: '', casting: '' }

function applyRevisionDelta(
  queryClient: ReturnType<typeof useQueryClient>,
  prev: WorkflowRevision,
  next: WorkflowRevision,
) {
  if (prev.intake !== next.intake) {
    void getWorkflowIntakeLiveApi()
      .then((live) => applyIntakeLiveSnapshot(queryClient, live.items))
      .catch(() => undefined)
    void queryClient.invalidateQueries({
      queryKey: ['intake-orders', 'pipeline-counts'],
      refetchType: 'active',
    })
    void queryClient.invalidateQueries({
      queryKey: ['intake-orders', 'pending-list'],
      refetchType: 'active',
    })
  }
  if (prev.production !== next.production) {
    void queryClient.invalidateQueries({ queryKey: ['production-orders'], refetchType: 'active' })
    void queryClient.invalidateQueries({ queryKey: ['my-tickets'], refetchType: 'active' })
    void queryClient.invalidateQueries({ queryKey: ['material-requests'], refetchType: 'active' })
    void queryClient.invalidateQueries({ queryKey: ['production-order'], refetchType: 'active' })
  }
  if (prev.casting !== next.casting) {
    void queryClient.invalidateQueries({ queryKey: ['casting-slips'], refetchType: 'active' })
    void queryClient.invalidateQueries({ queryKey: ['my-tickets'], refetchType: 'active' })
    void queryClient.invalidateQueries({ queryKey: ['production-orders'], refetchType: 'active' })
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
    staleTime: 4_000,
    refetchInterval: enabled ? 6_000 : false,
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
