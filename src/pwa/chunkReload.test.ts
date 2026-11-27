import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('chunkReload — tự tải lại khi file trang của bản cũ không còn', () => {
  let store: Record<string, string>
  let reload: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    store = {}
    reload = vi.fn()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
    })
    vi.stubGlobal('window', { location: { reload } })
  })

  it('nhận ra lỗi tải file trang trên Chrome, Firefox, Safari', async () => {
    const { isChunkLoadError } = await import('./chunkReload')
    expect(
      isChunkLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://sanxuat.enshido.com/assets/IntakeOrdersPage-abc.js',
        ),
      ),
    ).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true)
  })

  it('lỗi code bình thường không bị coi là lỗi tải file', async () => {
    const { isChunkLoadError } = await import('./chunkReload')
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'code')"))).toBe(
      false,
    )
    expect(isChunkLoadError(null)).toBe(false)
  })

  it('tải lại một lần, lỗi lặp lại ngay sau đó thì không tải lại nữa', async () => {
    const first = await import('./chunkReload')
    expect(first.reloadForNewVersion(1_000_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)

    // Trang tải lại → module nạp mới, sessionStorage vẫn giữ mốc lần trước.
    vi.resetModules()
    const second = await import('./chunkReload')
    expect(second.reloadForNewVersion(1_010_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)

    // Để lâu rồi lại gặp (deploy lần sau) thì vẫn tự tải lại được.
    expect(second.reloadForNewVersion(1_100_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
