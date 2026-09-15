const TEMP_PREFIX = 'tmp-'

type Slot = {
  promise: Promise<string>
  resolve: (id: string) => void
  reject: (error: unknown) => void
}

const pending = new Map<string, Slot>()

export function isTempId(id: string) {
  return id.startsWith(TEMP_PREFIX)
}

export function newTempId() {
  return `${TEMP_PREFIX}${crypto.randomUUID()}`
}

export function registerTempId(tempId: string) {
  let resolve!: (id: string) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<string>((res, rej) => {
    resolve = res
    reject = rej
  })
  pending.set(tempId, { promise, resolve, reject })
}

export function resolveTempId(tempId: string, realId: string) {
  pending.get(tempId)?.resolve(realId)
  pending.delete(tempId)
}

export function rejectTempId(tempId: string, error: unknown) {
  pending.get(tempId)?.reject(error)
  pending.delete(tempId)
}

export async function resolveRowId(id: string) {
  if (!isTempId(id)) return id
  const slot = pending.get(id)
  if (!slot) throw new Error('Dòng này chưa lưu xong.')
  return slot.promise
}

/** Xóa: nếu dòng còn id tạm thì đợi POST xong rồi xóa bằng UUID thật. */
export async function deleteWhenReady(id: string, remove: (id: string) => Promise<unknown>) {
  if (!isTempId(id)) return remove(id)
  try {
    return await remove(await resolveRowId(id))
  } catch {
    return { success: true }
  }
}
