import { describe, expect, it, vi } from 'vitest'
import { createUpdateChecker } from './update'

const response = (status: number, body?: unknown, etag?: string) =>
  ({ ok: status < 400, status, headers: { get: (k: string) => (k === 'ETag' ? (etag ?? null) : null) }, json: async () => body }) as unknown as Response

describe('createUpdateChecker', () => {
  it('배포된 버전이 지금 실행 중인 것과 다르면 알린다', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, { id: 'b' }))
    const check = createUpdateChecker('a', fetcher)
    expect(await check()).toBe(true)
    expect(fetcher).toHaveBeenCalledWith('version.json', expect.objectContaining({ cache: 'no-store' }))
  })

  it('같은 버전이면 알리지 않는다', async () => {
    const check = createUpdateChecker('a', vi.fn().mockResolvedValue(response(200, { id: 'a' })))
    expect(await check()).toBe(false)
  })

  it('실패하면 조용히 넘어간다', async () => {
    expect(await createUpdateChecker('a', vi.fn().mockRejectedValue(new Error('offline')))()).toBe(false)
    expect(await createUpdateChecker('a', vi.fn().mockResolvedValue(response(404)))()).toBe(false)
  })

  it('받은 ETag를 다음 요청에 보내고, 304면 바뀐 게 없다고 본다', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(200, { id: 'a' }, '"v1"')).mockResolvedValueOnce(response(304))
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValue(120_000)
    const check = createUpdateChecker('a', fetcher, now)
    await check()
    expect(await check()).toBe(false)
    expect(fetcher.mock.calls[1][1].headers).toEqual({ 'If-None-Match': '"v1"' })
  })

  it('짧은 간격으로 다시 부르면 요청하지 않는다', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, { id: 'a' }))
    const now = vi.fn().mockReturnValue(0)
    const check = createUpdateChecker('a', fetcher, now)
    await check()
    now.mockReturnValue(30_000)
    await check()
    expect(fetcher).toHaveBeenCalledTimes(1)
    now.mockReturnValue(61_000)
    await check()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
