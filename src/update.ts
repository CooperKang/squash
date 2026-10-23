import { useEffect, useState } from 'react'

/** 빌드마다 다른 값(vite.config.ts에서 git 커밋 해시를 넣는다) */
declare const __BUILD_ID__: string

/** 이보다 짧은 간격의 확인 요청은 건너뛴다 */
const MIN_GAP = 60_000
/** 화면이 보이는 동안 이 간격으로 확인한다 */
const PERIOD = 10 * 60_000

type Fetcher = (url: string, init: RequestInit) => Promise<Response>

/**
 * 배포된 version.json을 읽어 지금 실행 중인 빌드와 다른지 알려 준다.
 * 요청은 ETag로 바뀐 게 없으면 304(본문 없음)로 끝나고, 1분 안에 다시 부르면 요청하지 않는다.
 */
export function createUpdateChecker(current: string, fetcher: Fetcher = fetch, now: () => number = Date.now) {
  let etag: string | null = null
  let last = -Infinity
  return async () => {
    const t = now()
    if (t - last < MIN_GAP) return false
    last = t
    try {
      const res = await fetcher('version.json', { cache: 'no-store', headers: etag ? { 'If-None-Match': etag } : {} })
      if (res.status === 304 || !res.ok) return false
      etag = res.headers.get('ETag')
      const { id } = (await res.json()) as { id?: string }
      return typeof id === 'string' && id !== current
    } catch {
      return false
    }
  }
}

/** 새 배포가 올라왔으면 true. 처음 열 때, 다시 보일 때, 10분마다 확인하고 한 번 찾으면 멈춘다 */
export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    if (typeof __BUILD_ID__ === 'undefined' || !__BUILD_ID__) return
    const check = createUpdateChecker(__BUILD_ID__, (url, init) => fetch(import.meta.env.BASE_URL + url, init))
    let timer = 0
    const stop = () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
    const run = () =>
      void check().then((found) => {
        if (found) {
          setAvailable(true)
          stop()
        }
      })
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    run()
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') run()
    }, PERIOD)
    document.addEventListener('visibilitychange', onVisible)
    return stop
  }, [])
  return available
}
