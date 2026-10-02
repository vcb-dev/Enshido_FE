import type { QueryClient } from '@tanstack/react-query'
import type { MaterialRequestQueueItem, MaterialRequestStatus } from '../api/productionOrders'

export function removeMaterialRequestFromCache(
  queryClient: QueryClient,
  requestId: string,
  fromStatus: MaterialRequestStatus,
) {
  queryClient.setQueryData<MaterialRequestQueueItem[]>(
    ['material-requests', fromStatus],
    (old) => old?.filter((row) => row.id !== requestId),
  )
}
