import type { QueryClient } from '@tanstack/react-query'

let timer: ReturnType<typeof setTimeout> | undefined

/** Gom invalidate my-tickets — tránh nhiều thao tác liên tiếp kích hoạt refetch API nặng. */
export function scheduleMyTicketsRefresh(queryClient: QueryClient) {
  if (timer !== undefined) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = undefined
    void queryClient.invalidateQueries({ queryKey: ['my-tickets'], refetchType: 'active' })
  }, 600)
}
