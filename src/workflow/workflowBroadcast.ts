const CHANNEL = 'enshido-workflow'

export type WorkflowBroadcast = {
  type: 'changed'
  source?: 'intake' | 'production' | 'casting'
}

type Listener = (message: WorkflowBroadcast) => void

let channel: BroadcastChannel | null = null
const listeners = new Set<Listener>()

function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (event: MessageEvent<WorkflowBroadcast>) => {
      if (event.data?.type === 'changed') {
        for (const listener of listeners) listener(event.data)
      }
    }
  }
  return channel
}

/** Tab khác cùng trình duyệt nhận ngay sau thao tác (duyệt, đúc, cắt…). */
export function notifyWorkflowChanged(source?: WorkflowBroadcast['source']) {
  getChannel()?.postMessage({ type: 'changed', source } satisfies WorkflowBroadcast)
}

export function subscribeWorkflowBroadcast(listener: Listener) {
  getChannel()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
